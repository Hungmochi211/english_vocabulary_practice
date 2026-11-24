const UTC7_OFFSET_MS = 7 * 60 * 60 * 1000;

export function toUtc7DateString(date: Date = new Date()): string {
  const shifted = new Date(date.getTime() + UTC7_OFFSET_MS);
  const year = shifted.getUTCFullYear();
  const month = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const day = String(shifted.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getTodayUtc7Date(now: Date = new Date()): string {
  return toUtc7DateString(now);
}

export function addDaysUtc7(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const utc = Date.UTC(y, m - 1, d + days);
  const dt = new Date(utc);
  const year = dt.getUTCFullYear();
  const month = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const day = String(dt.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getLast7DaysUtc7(now: Date = new Date()): string[] {
  const today = getTodayUtc7Date(now);
  const days: string[] = [];
  for (let i = 6; i >= 0; i--) {
    days.push(addDaysUtc7(today, -i));
  }
  return days;
}

export function getUtc7HourMinute(now: Date = new Date()): { hour: number; minute: number } {
  const shifted = new Date(now.getTime() + UTC7_OFFSET_MS);
  return {
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
  };
}
