import * as path from 'path';
import { AppDataSource } from '../../config/database.config';
import { seedVocabulariesAndLessons } from './vocabulary.seeder';

async function main() {
  const start = Date.now();
  const excelPath = path.resolve(__dirname, '../../../../tools/oxford_3000_vocabulary.xlsx');

  await AppDataSource.initialize();
  try {
    const result = await seedVocabulariesAndLessons(AppDataSource, excelPath);
    const elapsedMs = Date.now() - start;
    console.log(
      `[SEED_SUCCESS] Loaded ${result.totalVocabularies} vocabularies and ${result.totalLessons} lessons in ${elapsedMs}ms (${(elapsedMs / 1000).toFixed(2)}s).`,
    );
  } finally {
    await AppDataSource.destroy();
  }
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
