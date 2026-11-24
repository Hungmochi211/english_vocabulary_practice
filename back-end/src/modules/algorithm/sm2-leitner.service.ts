import { Injectable } from '@nestjs/common';
import { GradingStatus } from './damerau-levenshtein.util';
import { addDaysUtc7 } from '../../common/utils/timezone.util';

export type QualityRating = 0 | 1 | 2 | 3 | 4 | 5;

export interface Sm2State {
  easinessFactor: number;
  repetitions: number;
  intervalDays: number;
}

export interface Sm2NextState extends Sm2State {
  leitnerBox: 1 | 2 | 3 | 4 | 5;
  nextReviewDate: string;
}

export function roundHalfUp(value: number, decimals = 0): number {
  const factor = Math.pow(10, decimals);
  return Math.floor(value * factor + 0.5 + Number.EPSILON) / factor;
}

export function deriveQualityRating(
  gradingStatus: GradingStatus,
  responseTimeMs: number,
  rawUserAnswer: string | null | undefined,
): QualityRating {
  const isBlank =
    rawUserAnswer === null ||
    rawUserAnswer === undefined ||
    rawUserAnswer.replace(/\u00A0/g, ' ').trim().length === 0;

  if (isBlank) return 0;

  switch (gradingStatus) {
    case 'exact':
      if (responseTimeMs <= 5000) return 5;
      if (responseTimeMs <= 12000) return 4;
      return 3;
    case 'near_match':
      return 3;
    case 'phonetic_match':
      return 2;
    case 'incorrect':
    default:
      return 1;
  }
}

export function mapRepetitionsToLeitnerBox(repetitions: number): 1 | 2 | 3 | 4 | 5 {
  if (repetitions <= 0) return 1;
  if (repetitions === 1) return 2;
  if (repetitions === 2) return 3;
  if (repetitions <= 4) return 4;
  return 5;
}

export function calculateNextSm2State(
  current: Sm2State,
  q: QualityRating,
  todayUtc7: string,
): Sm2NextState {
  const rawEf = current.easinessFactor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
  const easinessFactor = Math.max(1.3, roundHalfUp(rawEf, 2));

  let repetitions: number;
  let intervalDays: number;

  if (q < 3) {
    repetitions = 0;
    intervalDays = 1;
  } else {
    repetitions = current.repetitions + 1;
    if (repetitions === 1) {
      intervalDays = 1;
    } else if (repetitions === 2) {
      intervalDays = 6;
    } else {
      intervalDays = Math.max(1, roundHalfUp(current.intervalDays * easinessFactor, 0));
    }
  }

  const leitnerBox = mapRepetitionsToLeitnerBox(repetitions);
  const nextReviewDate = addDaysUtc7(todayUtc7, intervalDays);

  return {
    easinessFactor,
    repetitions,
    intervalDays,
    leitnerBox,
    nextReviewDate,
  };
}

@Injectable()
export class Sm2LeitnerService {
  deriveQualityRating = deriveQualityRating;
  mapRepetitionsToLeitnerBox = mapRepetitionsToLeitnerBox;
  calculateNextSm2State = calculateNextSm2State;
  roundHalfUp = roundHalfUp;
}
