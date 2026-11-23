import type { CefrLevel, LeaderboardMember } from '@/types/models';

export type UnrankedLeaderboardMember = Omit<LeaderboardMember, 'rank'>;

function svgDataUri(svg: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

const PEER_AVATARS = {
  khoi: svgDataUri(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><defs><linearGradient id="g1" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#38bdf8"/><stop offset="100%" stop-color="#1d4ed8"/></linearGradient></defs><rect width="80" height="80" fill="url(#g1)"/><circle cx="40" cy="31" r="15" fill="#fde68a"/><path d="M18 76c3-17 13-25 22-25s19 8 22 25" fill="#1e293b"/><path d="M26 27c2-9 10-13 18-11 7 2 11 7 11 13-6-3-16-4-29-2z" fill="#0f172a"/><circle cx="35" cy="32" r="2.2" fill="#0f172a"/><circle cx="45" cy="32" r="2.2" fill="#0f172a"/><path d="M36 39c2.5 2.2 5.5 2.2 8 0" stroke="#92400e" stroke-width="2.2" stroke-linecap="round" fill="none"/></svg>`,
  ),
  ha: svgDataUri(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><defs><linearGradient id="g2" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#fda4af"/><stop offset="100%" stop-color="#e11d48"/></linearGradient></defs><rect width="80" height="80" fill="url(#g2)"/><path d="M21 36c0-14 8-22 19-22s19 8 19 22v14H21V36z" fill="#312e81"/><circle cx="40" cy="34" r="14" fill="#fef3c7"/><path d="M18 76c3-16 12-23 22-23s19 7 22 23" fill="#fff1f2"/><circle cx="35" cy="34" r="2" fill="#1e1b4b"/><circle cx="45" cy="34" r="2" fill="#1e1b4b"/><path d="M36 41c2.5 2 5.5 2 8 0" stroke="#be123c" stroke-width="2.2" stroke-linecap="round" fill="none"/></svg>`,
  ),
  nam: svgDataUri(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><defs><linearGradient id="g3" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#34d399"/><stop offset="100%" stop-color="#047857"/></linearGradient></defs><rect width="80" height="80" fill="url(#g3)"/><circle cx="40" cy="32" r="14.5" fill="#fed7aa"/><path d="M25 28c3-10 27-12 30 0-7-5-23-5-30 0z" fill="#1e293b"/><rect x="30" y="30" width="8" height="5" rx="2" fill="none" stroke="#0f172a" stroke-width="2"/><rect x="42" y="30" width="8" height="5" rx="2" fill="none" stroke="#0f172a" stroke-width="2"/><line x1="38" y1="32.5" x2="42" y2="32.5" stroke="#0f172a" stroke-width="2"/><path d="M18 76c4-16 12-24 22-24s18 8 22 24" fill="#064e3b"/></svg>`,
  ),
  lan: svgDataUri(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><defs><linearGradient id="g4" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#c084fc"/><stop offset="100%" stop-color="#6d28d9"/></linearGradient></defs><rect width="80" height="80" fill="url(#g4)"/><circle cx="24" cy="24" r="7" fill="#fde047" opacity="0.85"/><path d="M10 62l18-20 14 14 12-12 16 18v18H10V62z" fill="#4c1d95"/><path d="M28 42l8 8 4-4-8-8-4 4z" fill="#ede9fe" opacity="0.6"/></svg>`,
  ),
  bao: svgDataUri(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><defs><linearGradient id="g5" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#fbbf24"/><stop offset="100%" stop-color="#ea580c"/></linearGradient></defs><rect width="80" height="80" fill="url(#g5)"/><circle cx="40" cy="42" r="18" fill="#fffbeb"/><circle cx="33" cy="39" r="3" fill="#1e293b"/><circle cx="47" cy="39" r="3" fill="#1e293b"/><path d="M36 47l4 4 4-4" stroke="#ea580c" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/><path d="M24 28l6-10 6 8M56 28l-6-10-6 8" fill="#fffbeb"/></svg>`,
  ),
};

const SEED_PEERS: UnrankedLeaderboardMember[] = [
  {
    userId: 'peer-1',
    fullName: 'Minh Khôi',
    avatarUrl: PEER_AVATARS.khoi,
    level: 'B2',
    weeklyXp: 3120,
    wordsThisWeek: 148,
    streakDays: 21,
    badges: ['Bền bỉ 21 ngày', 'Top 1 Tuần'],
    isCurrentUser: false,
  },
  {
    userId: 'peer-2',
    fullName: 'Thu Hà',
    avatarUrl: PEER_AVATARS.ha,
    level: 'B1',
    weeklyXp: 2840,
    wordsThisWeek: 126,
    streakDays: 14,
    badges: ['Tốc độ', 'Siêng năng'],
    isCurrentUser: false,
  },
  {
    userId: 'peer-3',
    fullName: 'Hoàng Nam',
    avatarUrl: PEER_AVATARS.nam,
    level: 'A2',
    weeklyXp: 2190,
    wordsThisWeek: 92,
    streakDays: 9,
    badges: ['Nghe chuẩn'],
    isCurrentUser: false,
  },
  {
    userId: 'peer-4',
    fullName: 'Lan Anh',
    avatarUrl: PEER_AVATARS.lan,
    level: 'B1',
    weeklyXp: 1940,
    wordsThisWeek: 84,
    streakDays: 6,
    badges: ['Chăm chỉ'],
    isCurrentUser: false,
  },
  {
    userId: 'peer-5',
    fullName: 'Quốc Bảo',
    avatarUrl: PEER_AVATARS.bao,
    level: 'A2',
    weeklyXp: 1620,
    wordsThisWeek: 71,
    streakDays: 5,
    badges: ['Bứt phá'],
    isCurrentUser: false,
  },
];

export function rankLeaderboardMembers(
  members: UnrankedLeaderboardMember[],
): LeaderboardMember[] {
  return [...members]
    .sort(
      (a, b) =>
        b.weeklyXp - a.weeklyXp ||
        b.streakDays - a.streakDays ||
        a.fullName.localeCompare(b.fullName),
    )
    .map((member, index) => ({
      ...member,
      rank: index + 1,
    }));
}

export function formatRankBadgeLabel(rank: number): string {
  if (rank === 1) return 'Hạng Vàng • Rank #1 nhóm';
  if (rank === 2) return 'Hạng Bạc • Rank #2 nhóm';
  if (rank === 3) return 'Hạng Đồng • Rank #3 nhóm';
  return `Thành viên tích cực • Rank #${rank} nhóm`;
}

export const leaderboardAdapter = {
  async getWeeklyGroupLeaderboard(currentUser: {
    fullName: string;
    avatarUrl: string | null;
    targetLevel: CefrLevel;
    totalXp: number;
    currentStreak: number;
  }): Promise<LeaderboardMember[]> {
    const me: UnrankedLeaderboardMember = {
      userId: 'current-user',
      fullName: currentUser.fullName || 'Học viên',
      avatarUrl: currentUser.avatarUrl,
      level: currentUser.targetLevel || 'B2',
      weeklyXp: Math.max(0, Math.round(currentUser.totalXp)),
      wordsThisWeek: Math.max(12, Math.round(currentUser.totalXp / 24)),
      streakDays: currentUser.currentStreak,
      badges: currentUser.currentStreak >= 7 ? ['Streak 7+ ngày', 'Học viên tích cực'] : ['Học viên mới'],
      isCurrentUser: true,
    };

    return rankLeaderboardMembers([...SEED_PEERS, me]);
  },
};
