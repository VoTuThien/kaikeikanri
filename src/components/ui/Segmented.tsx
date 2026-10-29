import { Skeleton } from './Skeleton'
import { SIZE } from './sizes'

interface Option<T> {
  value: T
  label: string
}

// Nhóm nút chọn 1 trong nhiều: các nút chia đều chiều ngang nên luôn bằng nhau
export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: Option<T>[]
  value: T | null
  onChange: (v: T) => void
}) {
  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`${SIZE.chip} truncate rounded-xl px-2 text-sm font-semibold transition active:scale-95 ${
            o.value === value
              ? 'bg-gradient-to-r from-fuchsia-500 to-indigo-500 shadow-lg shadow-fuchsia-500/30'
              : 'border border-white/20 bg-white/10 text-white/80 hover:bg-white/20'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function SegmentedSkeleton({ count }: { count: number }) {
  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))` }}>
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} className={SIZE.chip} />
      ))}
    </div>
  )
}
