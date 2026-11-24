import { Injectable } from '@nestjs/common';
import { fisherYatesShuffle } from './fisher-yates.util';

export function stratifiedSample<T>(
  bucketsByTopic: Map<number, T[]>,
  totalQuestions: number,
): T[] {
  const topicIds = fisherYatesShuffle(Array.from(bucketsByTopic.keys())).filter(
    (id) => (bucketsByTopic.get(id)?.length ?? 0) > 0,
  );
  if (topicIds.length === 0 || totalQuestions <= 0) return [];

  const shuffledBuckets = new Map<number, T[]>();
  for (const tid of topicIds) {
    shuffledBuckets.set(tid, fisherYatesShuffle(bucketsByTopic.get(tid)!));
  }

  const numTopics = topicIds.length;
  const baseQuota = Math.floor(totalQuestions / numTopics);
  const remainder = totalQuestions % numTopics;

  const selected: T[] = [];
  const leftovers: T[] = [];

  topicIds.forEach((tid, idx) => {
    const bucket = shuffledBuckets.get(tid)!;
    const quota = baseQuota + (idx < remainder ? 1 : 0);
    const take = Math.min(quota, bucket.length);
    selected.push(...bucket.slice(0, take));
    if (bucket.length > take) {
      leftovers.push(...bucket.slice(take));
    }
  });

  if (selected.length < totalQuestions && leftovers.length > 0) {
    const extra = fisherYatesShuffle(leftovers).slice(0, totalQuestions - selected.length);
    selected.push(...extra);
  }

  return fisherYatesShuffle(selected);
}

@Injectable()
export class StratifiedSamplingService {
  sample<T>(bucketsByTopic: Map<number, T[]>, totalQuestions: number): T[] {
    return stratifiedSample(bucketsByTopic, totalQuestions);
  }
}
