import { useRef, useState, type ReactNode } from 'react'
import { LineIcon } from '../../../components/ui/Fab'
import { useLandscape } from './LandscapeFrame'
import { BTN } from './PotUi'
import { GLASS_ROUND } from './glass'

// Dialog MUA / ĐỔI vật phẩm dùng chung trong game (màn hình ước nguyện, cửa hàng…). Bố cục 3 dòng:
//  1. [ô vật phẩm: ảnh + tên, nền gradient theo hạng] [mô tả (khoảng trống nếu ngắn) / Đang có: n]
//  2. "Số lượng: n" + tổng giá; thanh kéo 1 → số lớn nhất mua được theo tiền đang có, 2 đầu có nút − / +
//  3. [Huỷ] [OK] rộng bằng nhau
// Thanh kéo TỰ LÀM (khung game có thể đang xoay 90°): toạ độ chạm đổi qua `toLocal`.

export type ItemRank = 'B' | 'A' | 'S'
// Ô vật phẩm dạng KÍNH MỜ: nền gần trong suốt (lộ nền phía sau, làm mờ), màu hạng chỉ ửng nhẹ từ dưới lên + vạch màu hạng ở mép dưới
export const RANK_GRADIENT: Record<ItemRank, string> = {
  B: 'bg-gradient-to-b from-white/[0.06] via-sky-300/10 to-sky-400/30 border-b-sky-300/90',
  A: 'bg-gradient-to-b from-white/[0.06] via-violet-300/10 to-violet-400/30 border-b-violet-300/90',
  S: 'bg-gradient-to-b from-white/[0.06] via-amber-200/10 to-amber-300/30 border-b-amber-300/90',
}

export function BuyDialog({ name, img, rank, desc, have, price, payImg, payName, payHave, maxCount = 999, okLabel = 'OK', busy, onConfirm, onClose }: {
  name: string
  img: string
  rank: ItemRank
  desc: ReactNode
  have?: number // số vật phẩm đang có (bỏ trống = không hiện dòng "Đang có")
  price: number // giá 1 cái
  payImg: string // icon tiền trả (đá vũ trụ, lông chim…)
  payName: string
  payHave: number // số tiền đang có
  maxCount?: number // giới hạn thêm (vd còn mua được bao nhiêu lần trong tháng)
  okLabel?: string
  busy?: boolean
  onConfirm: (n: number) => void
  onClose: () => void
}) {
  const max = Math.max(0, Math.min(maxCount, Math.floor(payHave / price)))
  const [n, setN] = useState(Math.min(1, max))
  const set = (v: number) => setN(Math.max(Math.min(1, max), Math.min(max, Math.round(v))))

  return (
    <Backdrop onClose={onClose}>
      <div className="flex w-[min(560px,calc(100%-32px))] flex-col gap-3 border border-white/25 bg-indigo-950/90 p-4 shadow-2xl shadow-black/60 backdrop-blur-xl" onClick={(e) => e.stopPropagation()}>
        {/* dòng 1 */}
        <div className="flex h-32 gap-3">
          <div className={`flex w-32 shrink-0 flex-col overflow-hidden border border-b-[3px] border-white/20 shadow-lg shadow-black/40 inset-shadow-[0_1px_0_rgba(255,255,255,0.25)] backdrop-blur-md ${RANK_GRADIENT[rank]}`}>
            <div className="flex min-h-0 flex-1 items-center justify-center">
              <img src={img} alt="" draggable={false} className="h-20 w-20 object-contain drop-shadow-[0_2px_6px_rgba(0,0,0,0.45)]" />
            </div>
            <span className="line-clamp-1 bg-black/20 py-1 text-center text-sm leading-5 font-bold [text-shadow:0_1px_2px_rgba(0,0,0,0.7)]">{name}</span>
          </div>
          <div className="flex min-w-0 flex-1 flex-col border border-white/15 bg-white/10">
            <div className="min-h-0 flex-1 overflow-hidden px-3 py-2 text-sm leading-5 text-white/90">{desc}</div>
            {have !== undefined && <div className="shrink-0 border-t border-white/15 bg-black/20 px-3 py-1.5 text-sm font-semibold">Đang có: {have.toLocaleString('vi-VN')}</div>}
          </div>
        </div>
        {/* dòng 2 */}
        <div>
          <div className="flex items-center justify-between px-12 text-sm">
            <span className="font-semibold">Số lượng: {n.toLocaleString('vi-VN')}</span>
            <span className="flex items-center gap-1 font-semibold tabular-nums">
              <img src={payImg} alt={` ${payName}`} className="h-5 w-5 object-contain" />
              {(n * price).toLocaleString('vi-VN')}
            </span>
          </div>
          <div className="mt-1 flex items-center gap-3">
            <button type="button" data-round aria-label="Bớt 1" disabled={n <= 1} onClick={() => set(n - 1)} className={`${GLASS_ROUND} h-9 w-9 text-xl leading-none font-bold`}>−</button>
            <Slider value={n} min={1} max={Math.max(1, max)} disabled={max <= 1} onChange={set} />
            <button type="button" data-round aria-label="Thêm 1" disabled={n >= max} onClick={() => set(n + 1)} className={`${GLASS_ROUND} h-9 w-9`}><LineIcon icon="add" className="h-5 w-5" /></button>
          </div>
          {max < 1 && <p className="mt-1 text-center text-xs text-rose-200">Không đủ {payName}: cần {price.toLocaleString('vi-VN')}, đang có {payHave.toLocaleString('vi-VN')}</p>}
        </div>
        {/* dòng 3 */}
        <div className="grid grid-cols-2 gap-4">
          <button type="button" onClick={onClose} className={`${BTN} from-slate-400/40 to-slate-600/50`}>Huỷ</button>
          <button type="button" disabled={busy || max < 1} onClick={() => onConfirm(n)} className={`${BTN} from-amber-400/80 to-rose-500/80`}>{busy ? '…' : okLabel}</button>
        </div>
      </div>
    </Backdrop>
  )
}

// Hộp xác nhận nhỏ: nội dung + [Huỷ] [Đồng ý] rộng bằng nhau
export function ConfirmDialog({ children, okLabel = 'Đồng ý', busy, onConfirm, onClose }: { children: ReactNode; okLabel?: string; busy?: boolean; onConfirm: () => void; onClose: () => void }) {
  return (
    <Backdrop onClose={onClose}>
      <div className="flex w-[min(420px,calc(100%-32px))] flex-col gap-4 border border-white/25 bg-indigo-950/90 p-4 shadow-2xl shadow-black/60 backdrop-blur-xl" onClick={(e) => e.stopPropagation()}>
        <div className="text-center text-sm leading-6">{children}</div>
        <div className="grid grid-cols-2 gap-4">
          <button type="button" onClick={onClose} className={`${BTN} from-slate-400/40 to-slate-600/50`}>Huỷ</button>
          <button type="button" disabled={busy} onClick={onConfirm} className={`${BTN} from-amber-400/80 to-rose-500/80`}>{busy ? '…' : okLabel}</button>
        </div>
      </div>
    </Backdrop>
  )
}

function Backdrop({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  return (
    <div className="absolute inset-0 z-[70] flex items-center justify-center bg-black/55" onClick={onClose}>
      {children}
    </div>
  )
}

// Thanh kéo chọn số: kéo / chạm vào thanh để đặt giá trị
function Slider({ value, min, max, disabled, onChange }: { value: number; min: number; max: number; disabled?: boolean; onChange: (v: number) => void }) {
  const { toLocal } = useLandscape()
  const track = useRef<HTMLDivElement>(null)
  const drag = useRef(false)
  const pct = max > min ? (value - min) / (max - min) : 1
  const valueAt = (e: { clientX: number; clientY: number }) => {
    const el = track.current
    if (!el) return value
    const r = el.getBoundingClientRect()
    const xs = [toLocal(r.left, r.top).x, toLocal(r.right, r.top).x, toLocal(r.left, r.bottom).x, toLocal(r.right, r.bottom).x]
    const left = Math.min(...xs), width = Math.max(...xs) - left
    const t = Math.max(0, Math.min(1, (toLocal(e.clientX, e.clientY).x - left) / Math.max(1, width)))
    return min + t * (max - min)
  }
  return (
    <div
      ref={track}
      role="slider"
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      className={`relative h-9 flex-1 touch-none ${disabled ? 'opacity-40' : 'cursor-pointer'}`}
      onPointerDown={(e) => {
        if (disabled) return
        drag.current = true
        try { track.current?.setPointerCapture(e.pointerId) } catch { /* bỏ qua */ }
        onChange(valueAt(e))
      }}
      onPointerMove={(e) => { if (drag.current) onChange(valueAt(e)) }}
      onPointerUp={() => { drag.current = false }}
      onPointerCancel={() => { drag.current = false }}
    >
      <span className="absolute inset-x-0 top-1/2 h-2 -translate-y-1/2 bg-black/45 shadow-inner" />
      <span className="absolute top-1/2 left-0 h-2 -translate-y-1/2 bg-gradient-to-r from-amber-300 to-orange-500" style={{ width: `${pct * 100}%` }} />
      <span data-round className="absolute top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-white/90 shadow-md shadow-black/50" style={{ left: `${pct * 100}%` }} />
    </div>
  )
}
