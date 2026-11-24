export interface PartitionResult {
  lessonSizes: number[];
  isValid: boolean;
  warning?: string;
}

export interface ChunkedLesson<T> {
  title: string;
  orderIndex: number;
  wordCount: number;
  words: T[];
}

export interface ChunkingResult<T> {
  isValid: boolean;
  warning?: string;
  lessons: ChunkedLesson<T>[];
}

export function calculateLessonPartition(
  n: number,
  cefrLevel: string,
  topicCode: string,
): PartitionResult {
  if (n < 15) {
    return {
      lessonSizes: [],
      isValid: false,
      warning: `[SEED_WARNING] Nhóm ${cefrLevel} - ${topicCode} chỉ có ${n} từ (< 15 từ). Cần tối thiểu 15 từ để tạo bài học.`,
    };
  }

  const minK = Math.max(1, Math.ceil((n - 2) / 18));
  const maxK = Math.floor(n / 15);

  for (let k = minK; k <= maxK; k++) {
    if (k === 1) {
      if (n >= 15 && n <= 20) {
        return { lessonSizes: [n], isValid: true };
      }
      continue;
    }

    const base = Math.floor(n / k);
    const rem = n % k;
    if (base >= 15 && base + (rem > 0 ? 1 : 0) <= 18) {
      const sizes = Array(k - rem)
        .fill(base)
        .concat(Array(rem).fill(base + 1));
      return { lessonSizes: sizes, isValid: true };
    }

    for (let last = 15; last <= 20; last++) {
      const remN = n - last;
      if (remN >= (k - 1) * 15 && remN <= (k - 1) * 18) {
        const b = Math.floor(remN / (k - 1));
        const r = remN % (k - 1);
        const sizes = Array(k - 1 - r)
          .fill(b)
          .concat(Array(r).fill(b + 1))
          .concat([last]);
        return { lessonSizes: sizes, isValid: true };
      }
    }
  }

  return {
    lessonSizes: [],
    isValid: false,
    warning: `[SEED_WARNING] Nhóm ${cefrLevel} - ${topicCode} có ${n} từ không thể phân hoạch hợp lệ thành các bài 15-18 từ (bài cuối <= 20 từ).`,
  };
}

export function chunkVocabulariesIntoLessons<T>(
  words: T[],
  cefrLevel: string,
  topicCode: string,
  topicName = topicCode,
): ChunkingResult<T> {
  const partition = calculateLessonPartition(words.length, cefrLevel, topicCode);
  if (!partition.isValid) {
    return {
      isValid: false,
      warning: partition.warning,
      lessons: [],
    };
  }

  const lessons: ChunkedLesson<T>[] = [];
  let offset = 0;

  partition.lessonSizes.forEach((size, idx) => {
    const orderIndex = idx + 1;
    const slice = words.slice(offset, offset + size);
    offset += size;
    lessons.push({
      title: `Lesson ${orderIndex}: ${topicName} (${cefrLevel})`,
      orderIndex,
      wordCount: slice.length,
      words: slice,
    });
  });

  return {
    isValid: true,
    lessons,
  };
}
