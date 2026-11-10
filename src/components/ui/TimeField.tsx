import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { createPortal } from 'react-dom'
import { Icon3D } from './Icon3D'
import { FIELD_CLASS, FieldLabel } from './TextField'

// Ô nhập giờ "HH:MM" dùng chung cho cả app (KHÔNG dùng <input type="time">: trên iOS 15.1 ô giờ gốc có lúc focus mà không bật popup).
// Ô hiển thị giống ô nhập thường ("HH:MM"); chạm vào mở VÒNG TRÒN CHỌN GIỜ to nhất có thể:
//   - Vòng TRONG: 12 điểm giờ của NỬA NGÀY đang xem, như mặt đồng hồ (12 / 24 ở trên cùng, theo chiều kim đồng hồ).
//     NÚT Ở GIỮA đổi nửa ngày: đang hiện 13–24 giờ thì nút là ☀️ (chạm -> hiện 1–12 giờ, nút thành 🌙),
//     đang hiện 1–12 giờ thì nút là 🌙 (chạm -> hiện 13–24 giờ, nút thành ☀️). Đổi nửa ngày thì giờ đang chọn đổi theo (vd 3 <-> 15).
//     Nửa ngày lúc mở theo giờ ban đầu: 1–12 giờ -> hiện 1–12; 0 giờ (= 24) và 13–23 giờ -> hiện 13–24. 24 giờ lưu là "00".
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
const R_HOUR = 92 // 12 số giờ; nút kéo giờ nằm đè đúng lên số đang chọn (bên trong là nút ☀️ / 🌙)
const SPLIT = 124 // chạm gần tâm hơn = vòng giờ, xa hơn = vòng phút
const KNOB = 19
// Phóng to vòng giờ khi giữ / kéo: chờ ZOOM_DELAY (chạm nhanh để chọn luôn thì không phóng to), rồi to lên ZOOM_SCALE lần
// (nền vòng giờ 124 * 1.55 ≈ 192 = gần kín vòng tròn) trong ZOOM_MS, hơi nảy; nhả tay thì thu về
const ZOOM_DELAY = 180
const ZOOM_SCALE = 1.55
const ZOOM_MS = 220

// Nửa ngày: 'am' = 1–12 giờ, 'pm' = 13–24 giờ (24 = 0 giờ)
type Half = 'am' | 'pm'
const halfOf = (hour: number): Half => (hour >= 1 && hour <= 12 ? 'am' : 'pm')
// Vị trí trên mặt đồng hồ (0 = trên cùng ... 11) <-> giờ trong ngày (0..23) theo nửa ngày
const hourAt = (idx: number, half: Half) => (half === 'am' ? (idx === 0 ? 12 : idx) : idx === 0 ? 0 : idx + 12)
// Số in trên mặt đồng hồ: 1..12 hoặc 13..24
const hourLabel = (idx: number, half: Half) => (half === 'am' ? (idx === 0 ? 12 : idx) : idx === 0 ? 24 : idx + 12)

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
  // Nửa ngày đang hiện trên vòng giờ: theo giờ ban đầu (1–12 -> 1–12; 0, 13–23 -> 13–24)
  const [half, setHalf] = useState<Half>(() => halfOf(hour))
  const [active, setActive] = useState<'hour' | 'minute' | null>(null)
  // Đang giữ / kéo ở vòng giờ đủ lâu: phóng to vòng giờ cho dễ kéo (chạm nhanh để chọn luôn thì không phóng to)
  const [zoom, setZoom] = useState(false)
  const svgRef = useRef<SVGSVGElement>(null)
  const ring = useRef<'hour' | 'minute' | null>(null)
  const zoomTimer = useRef(0)

  // Esc để huỷ
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCancel()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])
  useEffect(() => () => window.clearTimeout(zoomTimer.current), [])

  // Vị trí ngón tay -> (khoảng cách tới tâm, góc 0..360 tính từ trên cùng theo chiều kim đồng hồ) trong toạ độ hình vẽ
  function polar(e: ReactPointerEvent) {
    const r = svgRef.current!.getBoundingClientRect()
    const x = ((e.clientX - r.left) / r.width) * 400 - C
    const y = ((e.clientY - r.top) / r.height) * 400 - C
    const deg = ((Math.atan2(x, -y) * 180) / Math.PI + 360) % 360
    return { dist: Math.hypot(x, y), deg }
  }

  function apply(which: 'hour' | 'minute', deg: number) {
    // Vòng giờ chỉ còn 12 vị trí (mỗi 30°), giờ thật tuỳ nửa ngày đang hiện
    if (which === 'hour') setHour(hourAt(Math.round(deg / 30) % 12, half))
    else setMinute(Math.round(deg / 6) % 60)
  }

  // Nền "Space Glass" sáng / tối theo nửa ngày: 1–12 giờ (nút 🌙) = SÁNG, 13–24 giờ (nút ☀️) = TỐI.
  // day: bầu trời đang trượt sang cảnh ngày (2,4s); light: màu chữ / kính đã đổi sang sáng (đổi giữa chừng lúc trượt)
  const [day, setDay] = useState(() => half === 'am')
  const [light, setLight] = useState(() => half === 'am')
  const themeTimer = useRef(0)
  useEffect(() => () => window.clearTimeout(themeTimer.current), [])

  // Nút ☀️ / 🌙 ở giữa: đổi nửa ngày, giờ đang chọn giữ vị trí trên mặt đồng hồ (vd 3 giờ <-> 15 giờ, 12 giờ <-> 24 giờ)
  function toggleHalf() {
    const next: Half = half === 'am' ? 'pm' : 'am'
    setHalf(next)
    setHour((h) => hourAt(h % 12, next))
    // Trời trượt ngay; màu giao diện đổi giữa chừng (sang sáng sau 1,4s, sang tối sau 0,8s) như theme Space Glass
    const toLight = next === 'am'
    setDay(toLight)
    window.clearTimeout(themeTimer.current)
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) setLight(toLight)
    else themeTimer.current = window.setTimeout(() => setLight(toLight), toLight ? 1400 : 800)
  }

  function onDown(e: ReactPointerEvent<SVGSVGElement>) {
    const { dist, deg } = polar(e)
    ring.current = dist < SPLIT ? 'hour' : 'minute'
    setActive(ring.current)
    apply(ring.current, deg)
    e.currentTarget.setPointerCapture?.(e.pointerId)
    // Vòng giờ: vẫn còn giữ / kéo sau ZOOM_DELAY thì phóng to (chạm rồi nhả ngay = chọn luôn, không phóng to)
    window.clearTimeout(zoomTimer.current)
    if (ring.current === 'hour') {
      zoomTimer.current = window.setTimeout(() => ring.current === 'hour' && setZoom(true), ZOOM_DELAY)
    }
  }
  function onMove(e: ReactPointerEvent<SVGSVGElement>) {
    if (ring.current) apply(ring.current, polar(e).deg)
  }
  function onUp() {
    window.clearTimeout(zoomTimer.current)
    ring.current = null
    setActive(null)
    setZoom(false)
  }

  const hourDeg = (hour % 12) * 30
  const minDeg = minute * 6
  const hk = at(R_HOUR, hourDeg)
  const mk = at(R_MIN, minDeg)
  // Vòng giờ (kính HTML + nét SVG) phóng to quanh tâm cùng lúc, cùng chuyển động
  const zoomMotion = `${ZOOM_MS}ms cubic-bezier(0.22, 1.2, 0.36, 1)`

  return createPortal(
    <div data-no-swipe className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-3" onClick={onCancel}>
      <div
        role="dialog"
        aria-label={`Chọn ${label.toLowerCase()}`}
        className={`td-card w-full max-w-md ${day ? 'td-day' : ''} ${light ? 'td-light' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        <SpaceSky />

        <div className="td-content flex flex-col gap-3 p-3">
          <div className="flex h-8 items-center justify-between px-1">
            <span className="truncate text-sm font-semibold" style={{ color: 'var(--td-muted)' }}>
              {label}
            </span>
            <span className="text-2xl leading-8 font-bold tabular-nums">
              <span style={{ color: active === 'hour' ? 'var(--td-hour)' : undefined }}>{pad(hour)}</span>:
              <span style={{ color: active === 'minute' ? 'var(--td-min)' : undefined }}>{pad(minute)}</span>
            </span>
          </div>

          {/* Vòng tròn: to nhất có thể (bề rộng khung, nhưng không cao quá màn hình).
              Lớp dưới là các tấm KÍNH (HTML, có backdrop-filter): vòng phút, vòng giờ; lớp trên là SVG (số, điểm, kim, nút kéo) */}
          <div data-round className="relative mx-auto w-full" style={{ maxWidth: 'min(100%, calc(100vh - 13rem))' }}>
            {/* Kính vòng phút: r 196/400 */}
            <div className="td-glass" style={{ inset: '1%', opacity: zoom ? 0.35 : 1, transition: `opacity ${ZOOM_MS}ms ease` }} />
            {/* Kính vòng giờ: r SPLIT/400, phóng to cùng nét SVG của vòng giờ */}
            <div
              className="td-glass"
              style={{
                left: `${50 - SPLIT / 4}%`,
                top: `${50 - SPLIT / 4}%`,
                width: `${SPLIT / 2}%`,
                height: `${SPLIT / 2}%`,
                transform: `scale(${zoom ? ZOOM_SCALE : 1})`,
                backgroundColor: zoom ? 'var(--td-zoom)' : undefined,
                transition: `transform ${zoomMotion}, background-color ${ZOOM_MS}ms ease, border-color 1s ease, box-shadow 1s ease`,
              }}
            />
            <svg
              ref={svgRef}
              viewBox="0 0 400 400"
              className="relative block aspect-square w-full touch-none select-none"
              onPointerDown={onDown}
              onPointerMove={onMove}
              onPointerUp={onUp}
              onPointerCancel={onUp}
              role="group"
              aria-label="Kéo vòng trong để chọn giờ, vòng ngoài để chọn phút"
            >
              {/* Vòng NGOÀI (phút): 60 điểm, số mỗi 5 phút, kim + nút kéo. Đang phóng to vòng giờ thì mờ đi */}
              <g style={{ opacity: zoom ? 0.12 : 1, transition: `opacity ${ZOOM_MS}ms ease` }}>
                {Array.from({ length: 60 }, (_, m) => {
                  const p = at(R_MIN, m * 6)
                  const big = m % 5 === 0
                  return <circle key={m} cx={p.x} cy={p.y} r={big ? 3.6 : 2} style={{ fill: big ? 'var(--td-dot)' : 'var(--td-dot2)' }} />
                })}
                {Array.from({ length: 12 }, (_, i) => {
                  const p = at(R_MIN_LABEL, i * 30)
                  return (
                    <text key={i} x={p.x} y={p.y} textAnchor="middle" dominantBaseline="central" fontSize="15" fontWeight="600" style={{ fill: 'var(--td-min)' }}>
                      {pad(i * 5)}
                    </text>
                  )
                })}
                <line x1={C} y1={C} x2={mk.x} y2={mk.y} stroke="#6ee7f9" strokeWidth={3} strokeLinecap="round" opacity={0.9} />
                <circle cx={mk.x} cy={mk.y} r={active === 'minute' ? KNOB + 4 : KNOB} fill="#6ee7f9" stroke="#ffffff" strokeWidth={2.5} />
                <text x={mk.x} y={mk.y} textAnchor="middle" dominantBaseline="central" fontSize="15" fontWeight="700" fill="#07101f">
                  {pad(minute)}
                </text>
              </g>

              {/* Vòng TRONG (giờ): 12 số của nửa ngày đang hiện, kim + nút kéo. Giữ / kéo ở đây 1 chút thì PHÓNG TO cả vòng quanh tâm
                  (scale quanh tâm bằng translate-scale-translate, không phụ thuộc transform-origin của SVG trên Safari cũ) */}
              <g
                style={{
                  transform: `translate(${C}px, ${C}px) scale(${zoom ? ZOOM_SCALE : 1}) translate(${-C}px, ${-C}px)`,
                  transition: `transform ${zoomMotion}`,
                }}
              >
                {Array.from({ length: 12 }, (_, i) => {
                  const p = at(R_HOUR, i * 30)
                  return (
                    <text
                      key={i}
                      x={p.x}
                      y={p.y}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fontSize={i % 3 === 0 ? 20 : 17}
                      fontWeight={i % 3 === 0 ? 700 : 600}
                      style={{ fill: 'var(--td-hour)' }}
                    >
                      {hourLabel(i, half)}
                    </text>
                  )
                })}
                <line x1={C} y1={C} x2={hk.x} y2={hk.y} stroke="#a78bfa" strokeWidth={4} strokeLinecap="round" opacity={0.95} />
                <circle cx={hk.x} cy={hk.y} r={active === 'hour' ? KNOB + 5 : KNOB + 1} fill="#7c5ce0" stroke="#ffffff" strokeWidth={2.5} />
                <text x={hk.x} y={hk.y} textAnchor="middle" dominantBaseline="central" fontSize="17" fontWeight="700" fill="#ffffff">
                  {hourLabel(hour % 12, half)}
                </text>
              </g>
            </svg>

            {/* Nút đổi nửa ngày (kính) giữa mặt đồng hồ: ☀️ = chạm để xem 1–12 giờ (chuyển cảnh sáng), 🌙 = chạm để xem 13–24 giờ (cảnh tối).
                Ẩn trong lúc phóng to vòng giờ */}
            <button
              type="button"
              onClick={toggleHalf}
              aria-label={half === 'pm' ? 'Đổi sang 1–12 giờ (chế độ sáng)' : 'Đổi sang 13–24 giờ (chế độ tối)'}
              className={`td-glass flex aspect-square w-[22%] flex-col items-center justify-center gap-0.5 active:scale-90 ${zoom ? 'pointer-events-none opacity-0' : 'opacity-100'}`}
              style={{ left: '39%', top: '39%', transition: 'opacity 0.2s ease, transform 0.15s ease, background-color 1s ease, border-color 1s ease, box-shadow 1s ease' }}
            >
              <Icon3D emoji={half === 'pm' ? '☀️' : '🌙'} className="h-8 w-8" />
              <span className="text-[10px] leading-3 font-semibold" style={{ color: 'var(--td-soft)' }}>
                {half === 'pm' ? '1–12' : '13–24'}
              </span>
            </button>
          </div>

          <p className="text-center text-xs leading-4" style={{ color: 'var(--td-muted)' }}>
            Kéo{' '}
            <span className="font-semibold" style={{ color: 'var(--td-hour)' }}>
              vòng trong
            </span>{' '}
            để chọn giờ,{' '}
            <span className="font-semibold" style={{ color: 'var(--td-min)' }}>
              vòng ngoài
            </span>{' '}
            để chọn phút
          </p>

          {/* Các nút bằng nhau, cùng 1 hàng */}
          <div className={`grid gap-2 ${clearable ? 'grid-cols-3' : 'grid-cols-2'}`}>
            <button type="button" className="td-btn" onClick={onCancel}>
              Huỷ
            </button>
            {clearable && (
              <button type="button" className="td-btn" onClick={() => onDone('')}>
                Bỏ giờ
              </button>
            )}
            <button type="button" className="td-btn td-btn-primary" onClick={() => onDone(`${pad(hour)}:${pad(minute)}`)}>
              Xong
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}

// Bầu trời phía sau popup (theme Space Glass): lớp trời tối (tinh vân, đám màu mờ, sao, sao lớn, sao băng) + nền sáng + ngôi sao khổng lồ.
// .td-day làm khung trời trượt sang cảnh ngày; xem timeDial.css
function SpaceSky() {
  return (
    <div data-round className="td-sky" aria-hidden="true">
      <div className="td-pan">
        <div className="td-neb-dark" />
        <div className="td-starfield">
          <div className="td-blob" style={{ width: 260, height: 260, top: '30%', left: '14%', background: 'rgba(124,58,237,.45)' }} />
          <div className="td-blob" style={{ width: 230, height: 230, top: '58%', right: '10%', background: 'rgba(14,165,233,.4)' }} />
          <div className="td-blob" style={{ width: 190, height: 190, top: '4%', left: '40%', background: 'rgba(236,72,153,.28)' }} />
          <div className="td-stars td-s1" />
          <div className="td-stars td-s2" />
          <span className="td-bigstar" style={{ top: '9%', left: '18%' }} />
          <span className="td-bigstar" style={{ top: '40%', left: '58%', animationDelay: '1.2s' }} />
          <span className="td-bigstar" style={{ top: '84%', left: '30%', animationDelay: '2.1s' }} />
          <span className="td-meteor" style={{ top: '6%', left: '55%', animationDelay: '1s' }} />
          <span className="td-meteor" style={{ top: '2%', left: '30%', animationDuration: '13s', animationDelay: '5s' }} />
          <span className="td-meteor" style={{ top: '30%', left: '64%', animationDuration: '11s', animationDelay: '7.5s' }} />
        </div>
      </div>
      <div className="td-neb-light" />
      <div className="td-pan">
        <div className="td-orb">
          <span className="td-glowwrap">
            <span className="td-spec td-glow" />
            <span className="td-spec td-glow2" />
          </span>
          <span className="td-sheen" />
          <span className="td-spec td-inner" />
          <span className="td-spec td-rim" />
          <span className="td-core" />
        </div>
      </div>
    </div>
  )
}
