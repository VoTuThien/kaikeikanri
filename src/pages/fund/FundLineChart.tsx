import { useRef, useState, type PointerEvent } from 'react'
import { formatMoney } from '../../lib/format'

// Biểu đồ đường số dư theo 12 tháng của 1 năm (SVG tự vẽ, không cần thư viện).
// - Chỉ vẽ các đường người dùng đã chọn; tháng chưa tổng kết thì đường bị ngắt (không nối qua chỗ thiếu số liệu)
// - Đường 2px, điểm 8px có viền màu nền để tách khỏi đường khác, lưới mờ, 1 trục tiền duy nhất
// - Chạm / rê trên biểu đồ: vạch dọc theo tháng + khung số liệu của các đường đang vẽ (chữ màu trắng, màu chỉ ở ô màu)

// Bảng màu phân loại (8 màu, đã kiểm tra phân biệt được cả với người mù màu trên nền tối của app)
export const SERIES_COLORS = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767']

export interface Series {
  id: string
  label: string
  color: string
  values: (number | null)[] // 12 tháng, null = tháng đó chưa tổng kết
}

const W = 340
const H = 200
const PAD = { left: 44, right: 12, top: 12, bottom: 22 }
const SURFACE = '#272463' // màu nền panel phía sau (viền quanh điểm)
const MONTHS = Array.from({ length: 12 }, (_, i) => i)

const x = (i: number) => PAD.left + (i * (W - PAD.left - PAD.right)) / 11
const compact = new Intl.NumberFormat('vi-VN', { notation: 'compact', maximumFractionDigits: 1 })

// Giá trị lớn nhất trục dọc làm tròn đẹp (1, 2, 2.5, 5 x 10^n)
function niceMax(v: number) {
  if (v <= 0) return 1_000_000
  const p = Math.pow(10, Math.floor(Math.log10(v)))
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= v) return m * p
  return 10 * p
}

export function FundLineChart({ year, series, height = 'h-52' }: { year: number; series: Series[]; height?: string }) {
  const ref = useRef<SVGSVGElement>(null)
  const [hover, setHover] = useState<number | null>(null)

  const max = niceMax(Math.max(0, ...series.flatMap((s) => s.values.filter((v): v is number => v !== null))))
  const y = (v: number) => PAD.top + (1 - v / max) * (H - PAD.top - PAD.bottom)
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * max)

  // Chạm / rê: chọn tháng gần nhất
  function pick(e: PointerEvent<SVGSVGElement>) {
    const box = ref.current?.getBoundingClientRect()
    if (!box) return
    const vx = ((e.clientX - box.left) / box.width) * W
    const i = Math.round(((vx - PAD.left) / (W - PAD.left - PAD.right)) * 11)
    setHover(Math.max(0, Math.min(11, i)))
  }

  // Đường của 1 series: tách thành nhiều đoạn ở chỗ thiếu số liệu
  const segments = (values: (number | null)[]) => {
    const out: string[] = []
    let cur = ''
    values.forEach((v, i) => {
      if (v === null) {
        if (cur) out.push(cur)
        cur = ''
      } else cur += `${cur ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`
    })
    if (cur) out.push(cur)
    return out
  }

  const readout = hover === null ? [] : series.map((s) => ({ s, v: s.values[hover] }))
  const tipLeft = hover !== null && hover > 6

  return (
    // Kéo ngang trên biểu đồ là dò số liệu, không phải vuốt sang màn hình bên cạnh
    <div className={`relative ${height}`} data-no-swipe>
      <svg
        ref={ref}
        viewBox={`0 0 ${W} ${H}`}
        className="h-full w-full touch-none select-none"
        role="img"
        aria-label={`Biểu đồ số dư các nhóm quỹ năm ${year}`}
        onPointerDown={pick}
        onPointerMove={(e) => (e.buttons || e.pointerType === 'mouse') && pick(e)}
        onPointerLeave={(e) => e.pointerType === 'mouse' && setHover(null)}
      >
        {/* Lưới ngang + nhãn trục tiền (mờ, lùi về sau) */}
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke="rgb(255 255 255 / 0.12)" strokeWidth={1} />
            <text x={PAD.left - 6} y={y(t) + 3} textAnchor="end" fontSize={9} fill="rgb(255 255 255 / 0.55)">
              {compact.format(t)}
            </text>
          </g>
        ))}
        {MONTHS.map((i) => (
          <text key={i} x={x(i)} y={H - 6} textAnchor="middle" fontSize={9} fill={hover === i ? '#ffffff' : 'rgb(255 255 255 / 0.55)'}>
            T{i + 1}
          </text>
        ))}

        {/* Vạch dọc của tháng đang dò */}
        {hover !== null && (
          <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={H - PAD.bottom} stroke="rgb(255 255 255 / 0.45)" strokeWidth={1} strokeDasharray="3 3" />
        )}

        {series.map((s) => (
          <g key={s.id}>
            {segments(s.values).map((d) => (
              <path key={d} d={d} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            ))}
            {s.values.map((v, i) =>
              v === null ? null : (
                <circle key={i} cx={x(i)} cy={y(v)} r={hover === i ? 5 : 4} fill={s.color} stroke={SURFACE} strokeWidth={2} />
              ),
            )}
          </g>
        ))}

        {series.length === 0 && (
          <text x={(W + PAD.left) / 2} y={H / 2} textAnchor="middle" fontSize={11} fill="rgb(255 255 255 / 0.7)">
            Chạm nhóm quỹ bên dưới để vẽ đường
          </text>
        )}
      </svg>

      {/* Khung số liệu của tháng đang dò */}
      {hover !== null && series.length > 0 && (
        <div
          className={`pointer-events-none absolute top-1 w-52 rounded-xl border border-white/20 bg-indigo-950/90 p-2 text-xs shadow-lg ${
            tipLeft ? 'left-12' : 'right-1'
          }`}
        >
          <p className="mb-1 font-semibold">
            Tháng {hover + 1}/{year}
          </p>
          {readout.map(({ s, v }) => (
            <p key={s.id} className="flex items-center gap-1.5 leading-5">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: s.color }} />
              <span className="min-w-0 flex-1 truncate text-white/70">{s.label}</span>
              <span className="shrink-0 font-semibold">{v === null ? '—' : formatMoney(v)}</span>
            </p>
          ))}
        </div>
      )}
    </div>
  )
}
