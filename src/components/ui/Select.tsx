import {
  Children,
  isValidElement,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ChangeEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactElement,
  type ReactNode,
  type SelectHTMLAttributes,
} from 'react'
import { createPortal } from 'react-dom'
import { Button } from './Button'
import { Icon3D } from './Icon3D'
import { FIELD_CLASS, FieldLabel } from './TextField'

// Ô chọn dùng chung cả app. Dùng y như <select>: truyền <option> vào children, đọc e.target.value trong onChange.
// Ô hiển thị như ô chọn thường; chạm vào mở popup BÁNH XE HÌNH QUẠT: các lựa chọn xếp quanh 1 hình tròn có tâm ở mép TRÁI popup,
// popup chỉ là khung nhìn nên chỉ lộ 1 phần giống cây quạt (đuôi quạt bên trái), hợp với ngón cái tay phải.
//   - Lựa chọn đang hiện trên quạt: CHẠM vào để chọn (bánh xe quay tới đó rồi đóng popup)
//   - Lựa chọn chưa hiện: KÉO để xoay quạt (chỉ xoay, không chọn; có quán tính, tới 2 đầu thì nặng tay), rồi chạm để chọn
//   - Giá trị hiện tại là cung quạt lồi ra, nổi bóng và xoay cùng quạt; "Huỷ" / chạm nền mờ / Esc để bỏ
// Lúc kéo chỉ đổi style trực tiếp (không render lại React) để mượt trên iPhone cũ.
// Skeleton dùng chung TextFieldSkeleton vì cùng kích thước (khi ẩn nhãn thì chỉ là 1 khối cao bằng ô nhập).

interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'value'> {
  label: string
  hideLabel?: boolean // ẩn nhãn để tiết kiệm chỗ (vẫn đọc được bằng trình đọc màn hình)
  value?: string | number
}

interface Opt {
  value: string
  text: string
  disabled: boolean
}

// Các <option> trong children (kể cả nằm trong mảng / Fragment)
function readOptions(children: ReactNode): Opt[] {
  const out: Opt[] = []
  Children.forEach(children, (c) => {
    if (!isValidElement(c)) return
    const el = c as ReactElement<{ value?: string | number; disabled?: boolean; children?: ReactNode }>
    if (el.type === 'option') {
      const text = Children.toArray(el.props.children).join('').trim()
      out.push({ value: String(el.props.value ?? text), text, disabled: !!el.props.disabled })
    } else {
      out.push(...readOptions(el.props.children))
    }
  })
  return out
}

// "💰 Chi tiêu" -> icon 3D + chữ (quy ước icon 3D); không có emoji đầu chuỗi thì chỉ có chữ
function splitIcon(text: string): { icon: string; rest: string } {
  const m = text.match(/^(\p{Extended_Pictographic}[️‍\p{Extended_Pictographic}]*)\s+(.*)$/u)
  return m ? { icon: m[1], rest: m[2] } : { icon: '', rest: text }
}

export function Select({ label, hideLabel, id, children, value, onChange, disabled, className = '' }: SelectProps) {
  const [open, setOpen] = useState(false)
  const options = readOptions(children)
  const current = String(value ?? '')
  const selected = options.find((o) => o.value === current)
  return (
    <div className={hideLabel ? '' : 'space-y-1.5'}>
      {hideLabel ? (
        <label htmlFor={id} className="sr-only">
          {label}
        </label>
      ) : (
        <FieldLabel htmlFor={id}>{label}</FieldLabel>
      )}
      <div className="relative">
        <button
          id={id}
          type="button"
          data-no-swipe
          disabled={disabled}
          aria-haspopup="dialog"
          onClick={() => setOpen(true)}
          className={`${FIELD_CLASS} block truncate pr-10 text-left disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
        >
          {selected?.text || ' '}
        </button>
        <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-white/60">▾</span>
      </div>
      {open && (
        <FanPicker
          label={label}
          options={options}
          value={current}
          onCancel={() => setOpen(false)}
          onPick={(v) => {
            setOpen(false)
            if (v !== current) onChange?.({ target: { value: v, id }, currentTarget: { value: v, id } } as unknown as ChangeEvent<HTMLSelectElement>)
          }}
        />
      )}
    </div>
  )
}

const STEP = 20 // độ giữa 2 lựa chọn
const HUB_X = 28 // tâm bánh xe, tính từ mép trái khung nhìn
const HUB_R = 34
const INNER = 72 // chữ bắt đầu cách tâm
const VISIBLE = 3.8 // số bước (mỗi phía) còn nhìn thấy
const POP = 14 // cung quạt của giá trị đang chọn lồi ra khỏi mép quạt
const RUBBER = 0.3 // kéo quá 2 đầu thì chỉ đi theo 30%

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
const norm = (deg: number) => ((deg + 540) % 360) - 180
// Trượt nhanh rồi hơi vượt qua đích 1 chút
const easeOutBack = (t: number) => 1 + 2.2 * (t - 1) ** 3 + 1.2 * (t - 1) ** 2

function FanPicker({
  label,
  options,
  value,
  onCancel,
  onPick,
}: {
  label: string
  options: Opt[]
  value: string
  onCancel: () => void
  onPick: (value: string) => void
}) {
  const last = options.length - 1
  const viewRef = useRef<HTMLDivElement>(null)
  const wheelRef = useRef<HTMLDivElement>(null)
  const countRef = useRef<HTMLSpanElement>(null)
  const items = useRef<(HTMLDivElement | null)[]>([])
  const [radius, setRadius] = useState(0)
  const pos = useRef(Math.max(0, options.findIndex((o) => o.value === value)))
  const anim = useRef(0)
  const drag = useRef<{ x: number; y: number; angle: number; raw: number; t: number; v: number; moved: boolean } | null>(null)

  // Vị trí đang đứng ở lựa chọn còn bấm được gần nhất
  function nearest(i: number) {
    const start = clamp(Math.round(i), 0, last)
    for (let d = 0; d <= last; d++) {
      if (options[start + d] && !options[start + d].disabled) return start + d
      if (options[start - d] && !options[start - d].disabled) return start - d
    }
    return start
  }

  function paint(p: number) {
    pos.current = p
    if (wheelRef.current) wheelRef.current.style.transform = `rotate(${-p * STEP}deg)`
    items.current.forEach((el, i) => {
      if (!el) return
      const d = Math.abs(i - p)
      // Rõ hoàn toàn để dễ chọn, chỉ mờ dần ở bước cuối sát mép quạt
      const seen = clamp(VISIBLE - d, 0, 1)
      el.style.opacity = String(options[i].disabled ? seen * 0.3 : seen)
    })
    if (countRef.current) countRef.current.textContent = `${clamp(Math.round(p), 0, last) + 1}/${options.length}`
  }

  function animateTo(target: number, ms: number, then?: () => void) {
    cancelAnimationFrame(anim.current)
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      paint(target)
      then?.()
      return
    }
    const from = pos.current
    const t0 = performance.now()
    const tick = (now: number) => {
      const t = Math.min(1, (now - t0) / ms)
      paint(from + (target - from) * easeOutBack(t))
      if (t < 1) anim.current = requestAnimationFrame(tick)
      else {
        paint(target)
        then?.()
      }
    }
    anim.current = requestAnimationFrame(tick)
  }

  // Đo khung nhìn: bán kính bánh xe = gần chạm mép phải
  useLayoutEffect(() => {
    setRadius(viewRef.current!.clientWidth - HUB_X - POP - 8)
  }, [])
  // Mở ra: bánh xe quay vào đúng lựa chọn hiện tại
  useLayoutEffect(() => {
    if (!radius) return
    const target = pos.current
    paint(target - 1.5)
    animateTo(target, 420)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [radius])
  useEffect(() => () => cancelAnimationFrame(anim.current), [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') animateTo(nearest(pos.current + (e.key === 'ArrowDown' ? 1 : -1)), 240)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Góc của ngón tay quanh tâm bánh xe (0 = ngang sang phải, tăng theo chiều kim đồng hồ) + khoảng cách tới tâm
  function polar(e: ReactPointerEvent) {
    const r = viewRef.current!.getBoundingClientRect()
    const x = e.clientX - (r.left + HUB_X)
    const y = e.clientY - (r.top + r.height / 2)
    return { angle: (Math.atan2(y, x) * 180) / Math.PI, dist: Math.hypot(x, y) }
  }

  function onDown(e: ReactPointerEvent<HTMLDivElement>) {
    cancelAnimationFrame(anim.current)
    drag.current = { x: e.clientX, y: e.clientY, angle: polar(e).angle, raw: pos.current, t: e.timeStamp, v: 0, moved: false }
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }

  function onMove(e: ReactPointerEvent<HTMLDivElement>) {
    const d = drag.current
    if (!d) return
    if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 6) d.moved = true
    if (!d.moved) return
    const { angle } = polar(e)
    const delta = -norm(angle - d.angle) / STEP // ngón tay đi xuống (góc tăng) thì lùi về lựa chọn phía trên
    d.angle = angle
    d.raw += delta
    const dt = e.timeStamp - d.t
    if (dt > 0) d.v = 0.75 * (delta / dt) + 0.25 * d.v
    d.t = e.timeStamp
    paint(d.raw < 0 ? d.raw * RUBBER : d.raw > last ? last + (d.raw - last) * RUBBER : d.raw)
  }

  function onUp(e: ReactPointerEvent<HTMLDivElement>) {
    const d = drag.current
    drag.current = null
    if (!d) return
    // Quán tính: vuốt nhanh trôi thêm tối đa 3 lựa chọn
    if (d.moved) return animateTo(nearest(clamp(pos.current + clamp(d.v * 160, -3, 3), 0, last)), 380)
    // Chạm thẳng 1 lựa chọn: quay tới đó rồi chọn luôn
    const { angle, dist } = polar(e)
    if (dist < HUB_R) return
    const i = clamp(Math.round(pos.current) + Math.round(angle / STEP), 0, last)
    // Chỉ chọn được lựa chọn đang nhìn thấy trên quạt
    if (options[i].disabled || Math.abs(i - pos.current) > VISIBLE - 0.3) return
    animateTo(i, 220, () => onPick(options[i].value))
  }

  function onCancelGesture() {
    drag.current = null
    animateTo(nearest(pos.current), 300)
  }

  return createPortal(
    <div
      data-no-swipe
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-3"
      onClick={(e) => {
        e.stopPropagation()
        onCancel()
      }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div
        role="dialog"
        aria-label={`Chọn ${label.toLowerCase()}`}
        className="flex w-full max-w-md flex-col gap-3 rounded-3xl border border-white/20 bg-indigo-950/90 p-3 shadow-2xl backdrop-blur-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="truncate px-1 text-sm leading-6 font-semibold text-white/80">{label}</p>

        {/* Khung nhìn: chỉ lộ 1 phần hình tròn (cây quạt, đuôi bên trái) */}
        <div
          ref={viewRef}
          className="relative touch-none overflow-hidden rounded-2xl bg-black/20 select-none"
          style={{ height: 'min(60vh, 440px)' }}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onCancelGesture}
        >
          {radius > 0 && (
            <>
              {/* Mặt quạt */}
              <div
                className="pointer-events-none absolute rounded-full border border-white/20 bg-gradient-to-r from-fuchsia-500/25 to-indigo-500/20 shadow-[0_0_40px_rgba(168,85,247,0.35)]"
                style={{ left: HUB_X - radius, top: `calc(50% - ${radius}px)`, width: radius * 2, height: radius * 2 }}
              />
              {/* Bánh xe: quay quanh tâm khi kéo */}
              <div ref={wheelRef} className="pointer-events-none absolute" style={{ left: HUB_X, top: '50%', width: 0, height: 0 }}>
                {options.map((o, i) => (
                  <div
                    key={`s${o.value}`}
                    className="absolute h-px bg-white/15"
                    style={{ left: 0, top: 0, width: radius, transformOrigin: '0 50%', transform: `rotate(${(i + 0.5) * STEP}deg)` }}
                  />
                ))}
                {options.map((o, i) => {
                  const { icon, rest } = splitIcon(o.text)
                  return (
                    <div
                      key={o.value}
                      ref={(el) => {
                        items.current[i] = el
                      }}
                      className="absolute flex items-center"
                      style={{
                        left: 0,
                        top: -20,
                        height: 40,
                        width: radius,
                        paddingLeft: INNER - 12,
                        paddingRight: 12,
                        transformOrigin: '0 50%',
                        transform: `rotate(${i * STEP}deg)`,
                        zIndex: o.value === value ? 1 : undefined,
                      }}
                    >
                      {o.value === value && <SelectedSector radius={radius + POP} />}
                      <span
                        className={`relative flex h-9 min-w-0 flex-1 items-center gap-2 px-3 ${
                          o.value === value ? 'text-base font-bold text-white' : 'text-[15px] font-medium text-white/90'
                        }`}
                      >
                        {icon && <Icon3D emoji={icon} className="h-6 w-6 shrink-0" />}
                        <span className="min-w-0 flex-1 truncate">{rest || ' '}</span>
                      </span>
                    </div>
                  )
                })}
              </div>
              {/* Đuôi quạt: tâm bánh xe, hiện vị trí */}
              <div
                className="pointer-events-none absolute flex items-center justify-center rounded-full border border-white/30 bg-indigo-900 pl-2 shadow-lg shadow-black/40"
                style={{ left: HUB_X - HUB_R, top: `calc(50% - ${HUB_R}px)`, width: HUB_R * 2, height: HUB_R * 2 }}
              >
                <span ref={countRef} className="text-xs font-semibold text-white/80 tabular-nums" />
              </div>
            </>
          )}
        </div>

        <p className="text-center text-xs leading-4 text-white/60">Chạm để chọn, kéo để xoay quạt</p>
        <Button type="button" variant="secondary" onClick={onCancel}>
          Huỷ
        </Button>
      </div>
    </div>,
    document.body,
  )
}

// Cung quạt của giá trị đang chọn: to hơn các cung khác (lồi ra khỏi mép quạt) và nổi lên nhờ bóng đổ; xoay cùng bánh xe
function SelectedSector({ radius }: { radius: number }) {
  const a = ((STEP / 2) * Math.PI) / 180
  const x = radius * Math.cos(a)
  const y = radius * Math.sin(a)
  const pad = 24 // chừa chỗ cho bóng đổ
  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute"
      style={{ left: 0, top: 20 - y - pad, overflow: 'visible', filter: 'drop-shadow(0 0 3px rgba(255,255,255,0.35)) drop-shadow(0 8px 12px rgba(4,4,30,0.65))' }}
      width={radius + pad}
      height={2 * (y + pad)}
      viewBox={`0 ${-y - pad} ${radius + pad} ${2 * (y + pad)}`}
    >
      <defs>
        <linearGradient id="fan-selected" x1="0" y1="0" x2={radius} y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#d946ef" />
          <stop offset="1" stopColor="#6366f1" />
        </linearGradient>
      </defs>
      <path d={`M0 0L${x} ${-y}A${radius} ${radius} 0 0 1 ${x} ${y}Z`} fill="url(#fan-selected)" stroke="rgba(255,255,255,0.45)" strokeWidth={1} />
    </svg>
  )
}
