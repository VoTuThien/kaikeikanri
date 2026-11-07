import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { createPortal } from 'react-dom'
import { Button } from './Button'
import { FIELD_CLASS, FieldLabel } from './TextField'

// Ô nhập giờ "HH:MM" dùng chung cho cả app (KHÔNG dùng <input type="time">: trên iOS 15.1 ô giờ gốc có lúc focus mà không bật popup).
// Ô hiển thị giống ô nhập thường ("HH:MM"); chạm vào mở VÒNG TRÒN CHỌN GIỜ to nhất có thể:
//   - Vòng TRONG: 24 điểm = 24 giờ (0 ở trên cùng, theo chiều kim đồng hồ)
//   - Vòng NGOÀI: 60 điểm = 60 phút
// Chạm / kéo ở vùng vòng trong để chỉnh giờ, vùng vòng ngoài để chỉnh phút (kéo vòng quanh tâm; bắt đầu ở vòng nào thì cả lần kéo
// chỉnh vòng đó). Giữa vòng hiện giờ đang chọn. "Xong" để lưu, "Huỷ" / chạm nền mờ để bỏ; `clearable` có thêm "Bỏ giờ" (giá trị "").
// Giá trị vào / ra giống <input type="time">: "HH:MM", "" = chưa chọn.

const pad = (n: number) => String(n).padStart(2, '0')
const parse = (v: string): [number, number] | null => {
  const m = v.match(/^(\d{1,2}):(\d{2})$/)
  return m ? [Number(m[1]) % 24, Number(m[2]) % 60] : null
}

// Toạ độ trong hình vẽ (viewBox 0..400, tâm 200): vòng phút ngoài, vòng giờ trong; ranh giới chạm giữa 2 vòng
const C = 200
const R_MIN = 172 // điểm phút
const R_MIN_LABEL = 145 // số phút (mỗi 5 phút)
const R_HOUR = 100 // điểm giờ
const R_HOUR_LABEL = 76 // số giờ
const SPLIT = 124 // chạm gần tâm hơn = vòng giờ, xa hơn = vòng phút
const KNOB = 19

const at = (r: number, deg: number) => {
  const a = ((deg - 90) * Math.PI) / 180
  return { x: C + r * Math.cos(a), y: C + r * Math.sin(a) }
}

export function TimeField({
  id,
  label,
  value,
  onChange,
  disabled,
  clearable,
  placeholder = '--:--',
  className = '',
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  clearable?: boolean // cho phép bỏ giờ (vd giờ sinh không bắt buộc)
  placeholder?: string
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const shown = !disabled && parse(value)
  return (
    <div className="space-y-1.5">
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <button
        id={id}
        type="button"
        disabled={disabled}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        className={`${FIELD_CLASS} flex items-center justify-center !px-2.5 tabular-nums disabled:cursor-not-allowed disabled:opacity-40 ${className}`}
      >
        <span className={shown ? '' : 'text-white/40'}>{shown ? `${pad(shown[0])}:${pad(shown[1])}` : placeholder}</span>
      </button>
      {open && (
        <TimeDial
          label={label}
          value={value}
          clearable={clearable}
          onCancel={() => setOpen(false)}
          onDone={(v) => {
            setOpen(false)
            if (v !== value) onChange(v)
          }}
        />
      )}
    </div>
  )
}

function TimeDial({
  label,
  value,
  clearable,
  onCancel,
  onDone,
}: {
  label: string
  value: string
  clearable?: boolean
  onCancel: () => void
  onDone: (value: string) => void
}) {
  // Chưa có giờ thì bắt đầu từ giờ hiện tại
  const [hour, setHour] = useState(() => parse(value)?.[0] ?? new Date().getHours())
  const [minute, setMinute] = useState(() => parse(value)?.[1] ?? new Date().getMinutes())
  const [active, setActive] = useState<'hour' | 'minute' | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const ring = useRef<'hour' | 'minute' | null>(null)

  // Esc để huỷ
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCancel()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  // Vị trí ngón tay -> (khoảng cách tới tâm, góc 0..360 tính từ trên cùng theo chiều kim đồng hồ) trong toạ độ hình vẽ
  function polar(e: ReactPointerEvent) {
    const r = svgRef.current!.getBoundingClientRect()
    const x = ((e.clientX - r.left) / r.width) * 400 - C
    const y = ((e.clientY - r.top) / r.height) * 400 - C
    const deg = ((Math.atan2(x, -y) * 180) / Math.PI + 360) % 360
    return { dist: Math.hypot(x, y), deg }
  }

  function apply(which: 'hour' | 'minute', deg: number) {
    if (which === 'hour') setHour(Math.round(deg / 15) % 24)
    else setMinute(Math.round(deg / 6) % 60)
  }

  function onDown(e: ReactPointerEvent<SVGSVGElement>) {
    const { dist, deg } = polar(e)
    ring.current = dist < SPLIT ? 'hour' : 'minute'
    setActive(ring.current)
    apply(ring.current, deg)
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }
  function onMove(e: ReactPointerEvent<SVGSVGElement>) {
    if (ring.current) apply(ring.current, polar(e).deg)
  }
  function onUp() {
    ring.current = null
    setActive(null)
  }

  const hourDeg = hour * 15
  const minDeg = minute * 6
  const hk = at(R_HOUR, hourDeg)
  const mk = at(R_MIN, minDeg)

  return createPortal(
    <div data-no-swipe className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-3" onClick={onCancel}>
      <div
        role="dialog"
        aria-label={`Chọn ${label.toLowerCase()}`}
        className="flex w-full max-w-md flex-col gap-3 rounded-3xl border border-white/20 bg-indigo-950/90 p-3 shadow-2xl backdrop-blur-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex h-8 items-center justify-between px-1">
          <span className="truncate text-sm font-semibold text-white/80">{label}</span>
          <span className="text-2xl leading-8 font-bold tabular-nums">
            <span className={active === 'hour' ? 'text-fuchsia-300' : ''}>{pad(hour)}</span>:
            <span className={active === 'minute' ? 'text-sky-300' : ''}>{pad(minute)}</span>
          </span>
        </div>

        {/* Vòng tròn: to nhất có thể (bề rộng khung, nhưng không cao quá màn hình) */}
        <svg
          ref={svgRef}
          viewBox="0 0 400 400"
          className="mx-auto block aspect-square w-full touch-none select-none"
          style={{ maxWidth: 'min(100%, calc(100vh - 13rem))' }}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          role="group"
          aria-label="Kéo vòng trong để chọn giờ, vòng ngoài để chọn phút"
        >
          {/* Nền 2 vùng chạm */}
          <circle cx={C} cy={C} r={196} fill="rgba(56,189,248,0.08)" stroke="rgba(255,255,255,0.15)" />
          <circle cx={C} cy={C} r={SPLIT} fill="rgba(217,70,239,0.10)" stroke="rgba(255,255,255,0.15)" />

          {/* Vòng NGOÀI: 60 điểm phút, số mỗi 5 phút */}
          {Array.from({ length: 60 }, (_, m) => {
            const p = at(R_MIN, m * 6)
            const big = m % 5 === 0
            return <circle key={m} cx={p.x} cy={p.y} r={big ? 3.6 : 2} fill={big ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.4)'} />
          })}
          {Array.from({ length: 12 }, (_, i) => {
            const p = at(R_MIN_LABEL, i * 30)
            return (
              <text key={i} x={p.x} y={p.y} textAnchor="middle" dominantBaseline="central" fontSize="15" fontWeight="600" fill="rgba(186,230,253,0.9)">
                {pad(i * 5)}
              </text>
            )
          })}

          {/* Vòng TRONG: 24 điểm giờ, đủ 24 số */}
          {Array.from({ length: 24 }, (_, h) => {
            const p = at(R_HOUR, h * 15)
            return <circle key={h} cx={p.x} cy={p.y} r={2.6} fill="rgba(255,255,255,0.6)" />
          })}
          {Array.from({ length: 24 }, (_, h) => {
            const p = at(R_HOUR_LABEL, h * 15)
            return (
              <text key={h} x={p.x} y={p.y} textAnchor="middle" dominantBaseline="central" fontSize={h % 6 === 0 ? 15 : 12} fontWeight={h % 6 === 0 ? 700 : 500} fill="rgba(245,208,254,0.9)">
                {h}
              </text>
            )
          })}

          {/* Kim + nút kéo của phút và giờ */}
          <line x1={C} y1={C} x2={mk.x} y2={mk.y} stroke="#38bdf8" strokeWidth={3} strokeLinecap="round" opacity={0.85} />
          <line x1={C} y1={C} x2={hk.x} y2={hk.y} stroke="#e879f9" strokeWidth={4} strokeLinecap="round" opacity={0.9} />
          <circle cx={C} cy={C} r={6} fill="#ffffff" />
          <circle cx={mk.x} cy={mk.y} r={active === 'minute' ? KNOB + 4 : KNOB} fill="#0ea5e9" stroke="#ffffff" strokeWidth={2.5} />
          <text x={mk.x} y={mk.y} textAnchor="middle" dominantBaseline="central" fontSize="15" fontWeight="700" fill="#ffffff">
            {pad(minute)}
          </text>
          <circle cx={hk.x} cy={hk.y} r={active === 'hour' ? KNOB + 4 : KNOB} fill="#c026d3" stroke="#ffffff" strokeWidth={2.5} />
          <text x={hk.x} y={hk.y} textAnchor="middle" dominantBaseline="central" fontSize="15" fontWeight="700" fill="#ffffff">
            {pad(hour)}
          </text>
        </svg>

        <p className="text-center text-xs leading-4 text-white/60">
          Kéo <span className="font-semibold text-fuchsia-300">vòng trong</span> để chọn giờ, <span className="font-semibold text-sky-300">vòng ngoài</span> để chọn phút
        </p>

        {/* Các nút bằng nhau, cùng 1 hàng */}
        <div className={`grid gap-2 ${clearable ? 'grid-cols-3' : 'grid-cols-2'}`}>
          <Button type="button" variant="secondary" onClick={onCancel}>
            Huỷ
          </Button>
          {clearable && (
            <Button type="button" variant="secondary" onClick={() => onDone('')}>
              Bỏ giờ
            </Button>
          )}
          <Button type="button" onClick={() => onDone(`${pad(hour)}:${pad(minute)}`)}>
            Xong
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
