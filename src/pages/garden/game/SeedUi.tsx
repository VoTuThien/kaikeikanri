import { CROPS, formatGrow, seedImage, type Crop } from '../data/crops'
import { DragScroll } from './DragScroll'
import { LIST_H, RankBadge } from './PotUi'

// Danh sách hạt giống (GĐ4): dải cuộn ngang ở đáy giống danh sách chậu. Mỗi ô: tag hạng (B / A / S, màu như chậu),
// ảnh túi hạt, tên cây, số hạt đang có, thời gian lớn; cây chưa đủ cấp thì mờ + "Cấp n".
export function SeedList({ seeds, level, onSelect }: {
  seeds: Record<string, number> // số hạt đang có (đã trừ các chậu vừa gieo)
  level: number
  onSelect: (crop: Crop) => void
}) {
  const list = CROPS.filter((c) => (seeds[c.id] ?? 0) > 0).sort((a, b) => Number(a.level > level) - Number(b.level > level) || a.level - b.level)
  return (
    <div
      className="absolute bottom-0 z-30 border-t border-white/20 bg-indigo-950/55 pt-2 pb-2 shadow-2xl shadow-black/50 backdrop-blur-xl"
      style={{ height: LIST_H, left: 0, right: 0, paddingLeft: 'calc(var(--safe-l) + 10px)', paddingRight: 'calc(var(--safe-r) + 10px)' }}
    >
      {list.length === 0 ? (
        <p className="flex h-full items-center justify-center px-6 text-center text-sm text-white/75">
          Túi chưa có hạt giống nào. Mua hạt ở Cửa hàng (nút xe đẩy góc phải trên) hoặc quay gacha để nhận thêm hạt.
        </p>
      ) : (
        <DragScroll axis="x" className="h-full">
          {list.map((c) => {
            const locked = c.level > level
            return (
              <button
                key={c.id}
                type="button"
                disabled={locked}
                onClick={() => onSelect(c)}
                className={`relative mr-2 flex h-[112px] w-[104px] shrink-0 flex-col items-center border px-1 pt-1 text-center transition active:scale-95 ${
                  locked ? 'border-white/10 bg-white/5 opacity-45' : 'border-white/20 bg-white/10'
                }`}
              >
                <RankBadge rank={c.rank} className="absolute top-1 left-1" />
                <span className="absolute top-1 right-1 text-[11px] leading-4 font-bold">×{seeds[c.id]}</span>
                <img src={seedImage(c.id)} alt="" draggable={false} className="h-14 w-14 object-contain" />
                <span className="mt-0.5 text-[11px] leading-[13px] font-semibold">{c.name}</span>
                <span className="text-[10px] leading-3 text-white/70">{locked ? `Cần cấp ${c.level}` : `Lớn ${formatGrow(c.minutes)}`}</span>
              </button>
            )
          })}
        </DragScroll>
      )}
    </div>
  )
}
