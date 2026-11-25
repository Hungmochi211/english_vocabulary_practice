import { formatRankBadgeLabel } from '@/services/adapters/leaderboard.adapter';

export interface RankBadgeProps {
  rank: number;
  label?: string;
  size?: 'sm' | 'md';
  className?: string;
}

function RankIcon({ rank }: { rank: number }) {
  if (rank === 1) {
    return (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zm14 3c0 .6-.4 1-1 1H6c-.6 0-1-.4-1-1v-1h14v1z" />
      </svg>
    );
  }
  if (rank === 2) {
    return (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M12 2l2.9 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l7.1-1.01L12 2z" />
      </svg>
    );
  }
  if (rank === 3) {
    return (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M12 2a7 7 0 0 0-4 12.74V22l4-2 4 2v-7.26A7 7 0 0 0 12 2zm0 10a3 3 0 1 1 0-6 3 3 0 0 1 0 6z" />
      </svg>
    );
  }
  return <span aria-hidden="true">{rank}</span>;
}

export function RankBadge({ rank, label, size = 'md', className = '' }: RankBadgeProps) {
  const tierClass =
    rank === 1
      ? 'lt-rank-gold lt-rank-shimmer'
      : rank === 2
        ? 'lt-rank-silver lt-rank-shimmer'
        : rank === 3
          ? 'lt-rank-bronze lt-rank-shimmer'
          : 'lt-rank-default';

  const sizeClass = size === 'sm' ? 'lt-rank-sm' : '';
  const text = label ?? formatRankBadgeLabel(rank);

  return (
    <span className={`lt-rank-badge ${tierClass} ${sizeClass} ${className}`.trim()}>
      <span className="lt-rank-icon">
        <RankIcon rank={rank} />
      </span>
      <span className="lt-rank-label">{text}</span>
    </span>
  );
}
