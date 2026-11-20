import { useState } from 'react'
import { RANK_ORDER } from '../data/pots'
import { CROPS, formatGrow, seedImage, type Crop } from '../data/crops'
import { DragScroll } from './DragScroll'
import { LIST_H, RankFilter, type RankFilterValue } from './PotUi'
import { ItemTile } from './ItemTile'

// Danh sách hạt giống (GĐ4): dải cuộn ngang ở đáy giống danh sách chậu. Mỗi ô: tag hạng (B / A / S, màu như chậu),
// ảnh túi hạt, tên cây, số hạt đang có, thời gian lớn; cây chưa đủ cấp thì mờ + "Cấp n".
export function SeedList({ seeds, level, onSelect }: {
  seeds: Record<string, number> // số hạt đang có (đã trừ các chậu vừa gieo)
  level: number
  onSelect: (crop: Crop) => void
}) {
  const [filter, setFilter] = useState<RankFilterValue>('ALL') // mở danh sách: mặc định ALL
  const list = CROPS.filter((c) => (seeds[c.id] ?? 0) > 0).sort((a, b) => RANK_ORDER[a.rank] - RANK_ORDER[b.rank] || Number(a.level > level) - Number(b.level > level) || a.level - b.level) // S → A → B
  const shown = filter === 'ALL' ? list : list.filter((c) => c.rank === filter)
  return (
    <div
      className="absolute bottom-0 z-30 flex gap-2 border-t border-white/20 bg-indigo-950/55 pt-2 pb-2 shadow-2xl shadow-black/50 backdrop-blur-xl"
      style={{ height: LIST_H, left: 0, right: 0, paddingLeft: 'calc(var(--safe-l) + 10px)', paddingRight: 'calc(var(--safe-r) + 10px)' }}
    >
      {list.length > 0 && <RankFilter value={filter} onChange={setFilter} />}
      {shown.length === 0 ? (
        <p className="flex h-full min-w-0 flex-1 items-center justify-center px-6 text-center text-sm text-white/75">
          {list.length === 0 ? 'Túi chưa có hạt giống nào. Mua hạt ở Cửa hàng (nút xe đẩy góc phải trên) hoặc quay gacha để nhận thêm hạt.' : `Không có hạt hạng ${filter} trong túi.`}
        </p>
      ) : (
        <DragScroll key={filter} axis="x" className="h-full min-w-0 flex-1">
          {shown.map((c) => {
            const locked = c.level > level
            return (
              <ItemTile key={c.id} className="mr-2 w-[100px] shrink-0" img={seedImage(c.id)} emoji={c.icon} name={c.name} qty={seeds[c.id]} rank={c.rank}
                tr={locked ? `Cần cấp ${c.level}` : formatGrow(c.minutes)} dim={locked} disabled={locked} onClick={() => onSelect(c)} />
            )
          })}
        </DragScroll>
      )}
    </div>
  )
}
