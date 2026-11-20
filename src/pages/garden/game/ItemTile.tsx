import type { ReactNode } from 'react'
import { RANK_GRADIENT, type ItemRank } from './BuyDialog'
import { ItemImg } from './ItemImg'
import { RankBadge } from './PotUi'

// Ô vật phẩm dùng chung trong game (giống thẻ ở Cửa hàng): ảnh ở giữa, tên trên dải tối ở đáy ("tên x số lượng", số lượng 1 thì không ghi),
// nền kính màu theo hạng (B xanh biển, A tím, S vàng), chữ hạng B / A / S ở góc trái trên, nhãn nhỏ góc phải trên (vd "Lv2", "MỚI!", "Còn 2/5").
// `footer` = ô riêng bên dưới (vd giá ở Cửa hàng, "+3%" khi chọn chậu bỏ vào). Mặc định ô vuông; `fill` = cao theo ô cha (vd lưới kết quả gacha).
export const qtyName = (name: string, qty = 1) => (qty > 1 ? `${name} x ${qty.toLocaleString('vi-VN')}` : name)

export function ItemTile({ img, emoji = '🎁', name, qty, rank, tr, footer, dim, selected, fill, big, glow = '', className = '', onClick, disabled, label }: {
  img?: string
  emoji?: string
  name: string
  qty?: number
  rank: ItemRank
  tr?: ReactNode
  footer?: ReactNode
  dim?: boolean
  selected?: boolean
  fill?: boolean
  big?: boolean
  glow?: string // bóng sáng thêm quanh ô (vd ra vàng / tím ở gacha)
  className?: string
  onClick?: () => void
  disabled?: boolean
  label?: string
}) {
  const box = (
    <span className={`relative flex w-full flex-col overflow-hidden border border-b-[3px] shadow-lg shadow-black/40 inset-shadow-[0_1px_0_rgba(255,255,255,0.25)] backdrop-blur-md ${RANK_GRADIENT[rank]} ${
      fill ? 'min-h-0 flex-1' : 'aspect-square'} ${selected ? 'border-amber-200 outline-2 outline-offset-2 outline-amber-200/80' : 'border-white/20'} ${glow}`}>
      <RankBadge rank={rank} className={`absolute z-10 ${big ? 'top-2 left-2 h-5 w-5 text-xs' : 'top-1 left-1'}`} />
      {tr && <span className={`absolute z-10 bg-black/55 font-semibold ${big ? 'top-2 right-2 px-2 text-xs leading-5' : 'top-1 right-1 px-1 text-[10px] leading-4'}`}>{tr}</span>}
      <span className="flex min-h-0 flex-1 items-center justify-center pt-3">
        <ItemImg img={img} emoji={emoji} className={`${big ? 'h-[62%] w-[62%]' : 'h-[78%] w-[78%]'} object-contain drop-shadow-[0_2px_6px_rgba(0,0,0,0.45)]`} />
      </span>
      <span className={`flex shrink-0 items-center justify-center bg-black/25 px-1 text-center font-bold [text-shadow:0_1px_2px_rgba(0,0,0,0.7)] ${big ? 'h-12 text-base leading-5' : 'h-9 text-xs leading-4'}`}>
        <span className="line-clamp-2">{qtyName(name, qty)}</span>
      </span>
    </span>
  )
  const cls = `flex flex-col gap-1.5 text-left ${fill ? 'h-full' : ''} ${dim ? 'opacity-45' : ''} ${className}`
  return onClick ? (
    <button type="button" aria-label={label} disabled={disabled} onClick={onClick} className={`${cls} transition active:scale-95`}>{box}{footer}</button>
  ) : (
    <div className={cls}>{box}{footer}</div>
  )
}

// Ô phụ bên dưới ô vật phẩm (giá, % cộng…)
export function TileFooter({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <span className={`flex h-8 shrink-0 items-center justify-center gap-1 border border-white/15 bg-black/30 text-sm font-bold tabular-nums ${className}`}>{children}</span>
}
