import { FIELD_CLASS, FieldLabel } from './TextField'

// Ô nhập số phút dùng chung cả app: gõ số, hoặc bấm nút ▲ / ▼ bên phải để tăng / giảm 5 phút.
// Skeleton dùng chung TextFieldSkeleton vì cùng kích thước.

const STEP = 5

interface MinutesFieldProps {
  id: string
  label: string
  value: string // số phút dạng chữ, '' = chưa nhập
  onChange: (text: string) => void
  min?: number
  max?: number
  suffix?: string // vd "phút"
  placeholder?: string
  disabled?: boolean
  className?: string
}

function Arrow({ dir, label, disabled, onClick }: { dir: 'up' | 'down'; label: string; disabled: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      tabIndex={-1}
      disabled={disabled}
      onClick={onClick}
      className="flex flex-1 items-center justify-center rounded-md bg-white/10 transition hover:bg-white/20 active:bg-white/30 disabled:opacity-30"
    >
      <svg viewBox="0 0 12 8" className="h-2 w-3" aria-hidden="true">
        <path d={dir === 'up' ? 'M6 1 L11 7 L1 7 Z' : 'M1 1 L11 1 L6 7 Z'} fill="#ffffff" />
      </svg>
    </button>
  )
}

export function MinutesField({ id, label, value, onChange, min = 1, max = 24 * 60, suffix, placeholder, disabled, className = '' }: MinutesFieldProps) {
  const minutes = Number(value) || 0
  const step = (delta: number) => onChange(String(Math.min(max, Math.max(min, minutes + delta))))

  return (
    <div className="space-y-1.5">
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <div className="relative">
        <input
          id={id}
          inputMode="numeric"
          autoComplete="off"
          placeholder={placeholder}
          disabled={disabled}
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 4))}
          className={`${FIELD_CLASS} ${suffix ? 'pr-20' : 'pr-10'} disabled:cursor-not-allowed disabled:opacity-40 ${className}`}
        />
        {suffix && (
          <span className="pointer-events-none absolute inset-y-0 right-11 flex items-center text-sm text-white/60">{suffix}</span>
        )}
        {/* 2 nút bằng nhau xếp dọc trong ô: tăng / giảm 5 phút */}
        <div className="absolute inset-y-1 right-1 flex w-8 flex-col gap-0.5">
          <Arrow dir="up" label={`Tăng ${STEP} phút`} disabled={!!disabled || minutes >= max} onClick={() => step(STEP)} />
          <Arrow dir="down" label={`Giảm ${STEP} phút`} disabled={!!disabled || minutes <= min} onClick={() => step(-STEP)} />
        </div>
      </div>
    </div>
  )
}
