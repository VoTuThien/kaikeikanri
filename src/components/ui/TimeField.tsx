import { FIELD_CLASS, FieldLabel } from './TextField'

// Ô chọn giờ "HH:MM" KHÔNG dùng <input type="time">: trên iOS 15.1 (iPhone 12) ô giờ gốc có lúc đã focus mà không bật
// popup kéo chọn giờ (phải đóng / mở app vài lần mới được). Thay bằng 2 ô chọn gốc (<select>) trong suốt phủ lên nửa trái (giờ)
// và nửa phải (phút) của ô: chạm vào đâu thì iOS bật bánh xe kéo chọn giờ / phút tương ứng (bánh xe của <select> luôn hiện ổn định).
// Giá trị vào / ra giống <input type="time">: "HH:MM", "" = chưa chọn.

const pad = (n: number) => String(n).padStart(2, '0')
const HOURS = Array.from({ length: 24 }, (_, i) => pad(i))
const MINUTES = Array.from({ length: 60 }, (_, i) => pad(i))
const SELECT = 'absolute inset-y-0 h-full w-1/2 cursor-pointer appearance-none opacity-0 disabled:cursor-not-allowed'

export function TimeField({
  id,
  label,
  value,
  onChange,
  disabled,
  placeholder = '--:--',
  className = '',
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  placeholder?: string
  className?: string
}) {
  const [h = '', m = ''] = value ? value.split(':') : []
  return (
    <div className="space-y-1.5">
      <FieldLabel htmlFor={`${id}-h`}>{label}</FieldLabel>
      <div
        className={`${FIELD_CLASS} relative flex items-center justify-center !px-2.5 tabular-nums focus-within:border-fuchsia-300 focus-within:bg-white/15 focus-within:ring-2 focus-within:ring-fuchsia-400/40 ${
          disabled ? 'cursor-not-allowed opacity-40' : ''
        } ${className}`}
      >
        <span className={value && !disabled ? '' : 'text-white/40'}>{value && !disabled ? `${h}:${m}` : placeholder}</span>
        <select
          id={`${id}-h`}
          aria-label={`${label}: giờ`}
          disabled={disabled}
          value={h}
          onChange={(e) => onChange(`${e.target.value}:${m || '00'}`)}
          className={`${SELECT} left-0`}
        >
          {!h && <option value="">--</option>}
          {HOURS.map((x) => (
            <option key={x} value={x}>
              {x} giờ
            </option>
          ))}
        </select>
        <select
          id={`${id}-m`}
          aria-label={`${label}: phút`}
          disabled={disabled}
          value={m}
          onChange={(e) => onChange(`${h || '00'}:${e.target.value}`)}
          className={`${SELECT} right-0`}
        >
          {!m && <option value="">--</option>}
          {MINUTES.map((x) => (
            <option key={x} value={x}>
              {x} phút
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}
