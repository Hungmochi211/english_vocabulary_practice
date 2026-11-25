import type { LeitnerDistribution } from '@/types/models';

const BOX_META: Array<{
  box: 1 | 2 | 3 | 4 | 5;
  key: keyof LeitnerDistribution;
  title: string;
  intervalLabel: string;
  accentClass: string;
}> = [
  {
    box: 1,
    key: 'box1',
    title: 'Hộp 1',
    intervalLabel: 'Mới / Cần ôn ngay',
    accentClass: 'border-rose-200 bg-rose-50/70 text-rose-800',
  },
  {
    box: 2,
    key: 'box2',
    title: 'Hộp 2',
    intervalLabel: 'Nhắc lại sau 1 ngày',
    accentClass: 'border-amber-200 bg-amber-50/70 text-amber-800',
  },
  {
    box: 3,
    key: 'box3',
    title: 'Hộp 3',
    intervalLabel: 'Nhắc lại sau 3 ngày',
    accentClass: 'border-sky-200 bg-sky-50/70 text-sky-800',
  },
  {
    box: 4,
    key: 'box4',
    title: 'Hộp 4',
    intervalLabel: 'Nhắc lại sau 7 ngày',
    accentClass: 'border-indigo-200 bg-indigo-50/70 text-indigo-800',
  },
  {
    box: 5,
    key: 'box5',
    title: 'Hộp 5',
    intervalLabel: 'Ghi nhớ dài hạn',
    accentClass: 'border-emerald-200 bg-emerald-50/70 text-emerald-800',
  },
];

export function LeitnerBoxesBar({
  distribution,
  selectedBox,
  onSelectBox,
}: {
  distribution: LeitnerDistribution;
  selectedBox: number | null;
  onSelectBox?: (box: number | null) => void;
}) {
  return (
    <section aria-label="Phân bổ 5 Hộp ghi nhớ" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-heading text-base font-extrabold text-slate-900">
            5 Hộp ghi nhớ từ vựng
          </h2>
          <p className="text-xs text-slate-500">
            Trả lời đúng đẩy từ lên hộp cao hơn; trả lời sai đưa về Hộp 1 để củng cố ngay.
          </p>
        </div>
        {selectedBox !== null && onSelectBox && (
          <button
            type="button"
            onClick={() => onSelectBox(null)}
            className="text-xs font-bold text-indigo-700 hover:underline"
          >
            Xem tất cả hộp
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-5">
        {BOX_META.map((item) => {
          const count = distribution[item.key] ?? 0;
          const active = selectedBox === item.box;
          return (
            <button
              key={item.box}
              type="button"
              onClick={() => onSelectBox?.(active ? null : item.box)}
              aria-pressed={active}
              className={`flex flex-col items-start rounded-2xl border p-3.5 text-left transition ${
                active
                  ? 'border-slate-900 bg-slate-900 text-white shadow-sm'
                  : `${item.accentClass} hover:brightness-97`
              }`}
            >
              <span className={`text-xs font-extrabold ${active ? 'text-slate-200' : ''}`}>
                {item.title}
              </span>
              <strong className="mt-1 font-heading text-2xl font-extrabold">{count}</strong>
              <span className={`mt-0.5 text-[11px] font-medium ${active ? 'text-slate-300' : 'opacity-80'}`}>
                {item.intervalLabel}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
