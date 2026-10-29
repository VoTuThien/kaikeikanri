import { Skeleton } from './Skeleton'
import { SIZE } from './sizes'

// Một dòng cài đặt có công tắc bật/tắt ở bên phải
export function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string
  description: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`${SIZE.row} flex w-full items-center gap-3 px-6 text-left`}
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm leading-5 font-semibold">{label}</span>
        <span className="block truncate text-xs leading-4 text-white/60">{description}</span>
      </span>
      <span
        className={`relative h-7 w-12 shrink-0 rounded-full transition ${
          checked ? 'bg-gradient-to-r from-fuchsia-500 to-indigo-500' : 'bg-white/20'
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${
            checked ? 'translate-x-5' : ''
          }`}
        />
      </span>
    </button>
  )
}

export function ToggleRowSkeleton() {
  return (
    <div className={`${SIZE.row} flex items-center gap-3 px-6`}>
      <div className="flex-1 space-y-1">
        <Skeleton className="h-4 w-32 rounded-md" />
        <Skeleton className="h-3 w-48 rounded-md" />
      </div>
      <Skeleton className="h-7 w-12 rounded-full" />
    </div>
  )
}
