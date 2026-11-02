import { SIZE } from './sizes'

// Ô check có tiêu đề + dòng phụ (cao bằng ô nhập để thẳng hàng trong form). Dùng button role="checkbox"
// để chạm cả hàng là đổi được, dễ bấm trên điện thoại.
export function CheckBox({
  checked,
  onChange,
  label,
  hint,
  disabled,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
  hint?: string
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`${SIZE.control} flex w-full min-w-0 items-center gap-2.5 text-left disabled:opacity-40`}
    >
      <span
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 transition ${
          checked ? 'border-emerald-300 bg-emerald-400' : 'border-white/50 bg-white/5'
        }`}
      >
        {checked && (
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="#ffffff" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 12.5l4.5 4.5L19 7" />
          </svg>
        )}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm leading-5 font-semibold">{label}</span>
        {hint && <span className="block truncate text-xs leading-4 text-white/60">{hint}</span>}
      </span>
    </button>
  )
}
