import * as fs from 'fs';
import * as ExcelJS from 'exceljs';
import { DataSource } from 'typeorm';
import { VALID_PARTS_OF_SPEECH } from '../../modules/vocabulary/entities/vocabulary.entity';
import { chunkVocabulariesIntoLessons } from './chunking.util';
import { seedTopics } from './topic.seeder';

export interface RawVocabRow {
  word: string;
  cefrLevel: 'A1' | 'A2' | 'B1' | 'B2';
  partOfSpeech: string;
  phonetic: string;
  vietnameseMeaning: string;
  exampleEn: string;
  exampleVi: string;
  topicName: string;
  audioUrl?: string | null;
}

export interface NumberedVocabRow extends RawVocabRow {
  senseNumber: number;
}

export interface SeedOptions {
  simulateFailureAfterFirstSheet?: boolean;
}

const VALID_LEVELS = new Set(['A1', 'A2', 'B1', 'B2']);
const VALID_POS_SET = new Set<string>(VALID_PARTS_OF_SPEECH);
const PHONETIC_REGEX = /^\/.+\/$/;

export function sanitizeWord(rawWord: string): string {
  return rawWord
    .replace(/\u00A0/g, ' ')
    .replace(/\([^)]*\)/g, '')
    .replace(/[0-9]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function sanitizeText(raw: string): string {
  return raw.replace(/\u00A0/g, ' ').replace(/\s+/g, ' ').trim();
}

export function assignSenseNumbers(rows: RawVocabRow[]): NumberedVocabRow[] {
  const counters = new Map<string, number>();
  return rows.map((row) => {
    const key = `${row.word.toLowerCase()}||${row.cefrLevel}||${row.partOfSpeech}`;
    const nextSense = (counters.get(key) ?? 0) + 1;
    counters.set(key, nextSense);
    return {
      ...row,
      senseNumber: nextSense,
    };
  });
}

function cellToString(val: ExcelJS.CellValue): string {
  if (val === null || val === undefined) return '';
  if (typeof val === 'object') {
    if ('richText' in val && Array.isArray(val.richText)) {
      return val.richText.map((rt) => rt.text).join('');
    }
    if ('text' in val && typeof val.text === 'string') {
      return val.text;
    }
    if ('result' in val && val.result !== undefined && val.result !== null) {
      return String(val.result);
    }
  }
  return String(val);
}

export async function seedVocabulariesAndLessons(
  dataSource: DataSource,
  excelPath: string,
  options: SeedOptions = {},
): Promise<{ totalVocabularies: number; totalLessons: number; warnings: string[] }> {
  if (!fs.existsSync(excelPath)) {
    throw new Error(`[SEED_ERROR] Không tìm thấy file nguồn Excel tại: ${excelPath}`);
  }

  const topicsMap = await seedTopics(dataSource);

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(excelPath);

  const sheets = ['A1', 'A2', 'B1', 'B2'] as const;
  const rawRows: RawVocabRow[] = [];

  for (const sheetName of sheets) {
    const sheet = workbook.getWorksheet(sheetName);
    if (!sheet) {
      throw new Error(`[SEED_ERROR] Thiếu sheet bắt buộc '${sheetName}' trong file Excel`);
    }

    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // header

      const rawWord = cellToString(row.getCell(2).value);
      const rawLevel = sanitizeText(cellToString(row.getCell(3).value)) || sheetName;
      const rawPos = sanitizeText(cellToString(row.getCell(4).value));
      const rawPhonetic = sanitizeText(cellToString(row.getCell(5).value)).replace(/\*/g, '');
      const rawMeaning = sanitizeText(cellToString(row.getCell(6).value));
      const rawExampleEn = sanitizeText(cellToString(row.getCell(7).value));
      const rawExampleVi = sanitizeText(cellToString(row.getCell(8).value));
      const rawTopic = sanitizeText(cellToString(row.getCell(9).value));

      const word = sanitizeWord(rawWord);

      if (!word || !rawPhonetic || !rawMeaning || !rawExampleEn || !rawExampleVi || !rawTopic) {
        throw new Error(
          `[SEED_ERROR] Sheet ${sheetName} dòng ${rowNumber}: thiếu trường bắt buộc (word='${word}', phonetic='${rawPhonetic}', meaning='${rawMeaning}')`,
        );
      }

      if (!VALID_LEVELS.has(rawLevel)) {
        throw new Error(`[SEED_ERROR] Sheet ${sheetName} dòng ${rowNumber}: cefr_level không hợp lệ '${rawLevel}'`);
      }

      if (!VALID_POS_SET.has(rawPos)) {
        throw new Error(`[SEED_ERROR] Sheet ${sheetName} dòng ${rowNumber}: part_of_speech không hợp lệ '${rawPos}'`);
      }

      let phonetic = rawPhonetic;
      if (!phonetic.startsWith('/')) phonetic = '/' + phonetic;
      if (!phonetic.endsWith('/')) phonetic = phonetic + '/';

      if (!PHONETIC_REGEX.test(phonetic) || phonetic.includes('*')) {
        throw new Error(`[SEED_ERROR] Sheet ${sheetName} dòng ${rowNumber}: phonetic không đúng chuẩn IPA '${phonetic}'`);
      }

      if (!topicsMap.has(rawTopic)) {
        throw new Error(`[SEED_ERROR] Sheet ${sheetName} dòng ${rowNumber}: topic '${rawTopic}' không thuộc 16 chủ đề chuẩn`);
      }

      rawRows.push({
        word,
        cefrLevel: rawLevel as 'A1' | 'A2' | 'B1' | 'B2',
        partOfSpeech: rawPos,
        phonetic,
        vietnameseMeaning: rawMeaning.slice(0, 255),
        exampleEn: rawExampleEn,
        exampleVi: rawExampleVi,
        topicName: rawTopic,
        audioUrl: null,
      });
    });
  }

  const numberedRows = assignSenseNumbers(rawRows);
  const warnings: string[] = [];

  const queryRunner = dataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();

  try {
    const batchSize = 100;
    for (let i = 0; i < numberedRows.length; i += batchSize) {
      const batch = numberedRows.slice(i, i + batchSize);
      const valuesSql: string[] = [];
      const params: unknown[] = [];

      batch.forEach((item, idx) => {
        const topic = topicsMap.get(item.topicName)!;
        const base = idx * 10;
        valuesSql.push(
          `($${base + 1}, $${base + 2}::cefr_level_enum, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8}, $${base + 9}, $${base + 10})`,
        );
        params.push(
          item.word,
          item.cefrLevel,
          item.partOfSpeech,
          item.senseNumber,
          item.phonetic,
          item.vietnameseMeaning,
          item.exampleEn,
          item.exampleVi,
          topic.id,
          item.audioUrl ?? null,
        );
      });

      await queryRunner.query(
        `
        INSERT INTO vocabularies (
          word, cefr_level, part_of_speech, sense_number,
          phonetic, vietnamese_meaning, example_en, example_vi,
          topic_id, audio_url
        )
        VALUES ${valuesSql.join(', ')}
        ON CONFLICT (word, cefr_level, part_of_speech, sense_number)
        DO UPDATE SET
          phonetic = EXCLUDED.phonetic,
          vietnamese_meaning = EXCLUDED.vietnamese_meaning,
          example_en = EXCLUDED.example_en,
          example_vi = EXCLUDED.example_vi,
          topic_id = EXCLUDED.topic_id,
          audio_url = COALESCE(EXCLUDED.audio_url, vocabularies.audio_url),
          updated_at = NOW();
        `,
        params,
      );

      if (options.simulateFailureAfterFirstSheet && i >= batchSize) {
        throw new Error('[SIMULATED_SEED_FAILURE] Giả lập lỗi giữa chừng để kiểm tra Transaction Rollback');
      }
    }

    // Tạo lại lessons và lesson_vocabularies theo từng cặp (cefr_level, topic_id) với ID ổn định từ 1..N
    await queryRunner.query(`TRUNCATE TABLE lesson_vocabularies, lessons RESTART IDENTITY CASCADE;`);

    const allVocabs: Array<{
      id: number;
      word: string;
      cefr_level: string;
      topic_id: number;
    }> = await queryRunner.query(
      `SELECT id, word, cefr_level, topic_id FROM vocabularies ORDER BY id ASC;`,
    );

    const grouped = new Map<string, Array<{ id: number; word: string; cefr_level: string; topic_id: number }>>();
    for (const v of allVocabs) {
      const gKey = `${v.cefr_level}||${v.topic_id}`;
      if (!grouped.has(gKey)) grouped.set(gKey, []);
      grouped.get(gKey)!.push(v);
    }

    const topicById = new Map<number, { code: string; name: string }>();
    for (const t of topicsMap.values()) {
      topicById.set(t.id, { code: t.code, name: t.name });
    }

    let totalLessons = 0;

    for (const [gKey, groupWords] of grouped.entries()) {
      const [cefrLevel, topicIdStr] = gKey.split('||');
      const topicId = Number(topicIdStr);
      const topicInfo = topicById.get(topicId)!;

      const chunked = chunkVocabulariesIntoLessons(
        groupWords,
        cefrLevel,
        topicInfo.code,
        topicInfo.name,
      );

      if (!chunked.isValid) {
        if (chunked.warning) {
          warnings.push(chunked.warning);
          console.warn(chunked.warning);
        }
        continue;
      }

      for (const lessonChunk of chunked.lessons) {
        const insertedLesson = await queryRunner.query(
          `
          INSERT INTO lessons (topic_id, cefr_level, title, order_index, word_count)
          VALUES ($1, $2::cefr_level_enum, $3, $4, $5)
          RETURNING id;
          `,
          [topicId, cefrLevel, lessonChunk.title, lessonChunk.orderIndex, lessonChunk.wordCount],
        );
        const lessonId: number = insertedLesson[0].id;
        totalLessons++;

        const lvValues: string[] = [];
        const lvParams: unknown[] = [];
        lessonChunk.words.forEach((w, idx) => {
          const base = idx * 3;
          lvValues.push(`($${base + 1}, $${base + 2}, $${base + 3})`);
          lvParams.push(lessonId, w.id, idx + 1);
        });

        await queryRunner.query(
          `
          INSERT INTO lesson_vocabularies (lesson_id, vocabulary_id, order_in_lesson)
          VALUES ${lvValues.join(', ')};
          `,
          lvParams,
        );
      }
    }

    await queryRunner.commitTransaction();
    return {
      totalVocabularies: numberedRows.length,
      totalLessons,
      warnings,
    };
  } catch (err) {
    await queryRunner.rollbackTransaction();
    throw err;
  } finally {
    await queryRunner.release();
  }
}
