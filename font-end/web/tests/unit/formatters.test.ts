import { describe, expect, it } from 'vitest';
import {
  clampResponseTimeMs,
  formatXp,
  getInitials,
  stripVietnameseDiacritics,
} from '@/utils/formatters';

describe('formatters', () => {
  it('formats XP numbers with thousands separator', () => {
    expect(formatXp(2450)).toBe('2,450');
    expect(formatXp(-10)).toBe('0');
    expect(formatXp(Number.NaN)).toBe('0');
  });

  it('extracts uppercase initials from Vietnamese full names', () => {
    expect(getInitials('Nguyễn An')).toBe('NA');
    expect(getInitials('Trần Minh Hoàng')).toBe('TH');
    expect(getInitials('An')).toBe('AN');
    expect(getInitials('')).toBe('NA');
  });

  it('strips Vietnamese diacritics and đ accurately for search', () => {
    expect(stripVietnameseDiacritics('Môi trường & Đời sống')).toBe('moi truong & doi song');
    expect(stripVietnameseDiacritics('Hạnh phúc')).toBe('hanh phuc');
  });

  it('clamps responseTimeMs within [0, 300000]', () => {
    expect(clampResponseTimeMs(-50)).toBe(0);
    expect(clampResponseTimeMs(4321.6)).toBe(4322);
    expect(clampResponseTimeMs(999_999)).toBe(300_000);
    expect(clampResponseTimeMs(Number.POSITIVE_INFINITY)).toBe(0);
  });
});
