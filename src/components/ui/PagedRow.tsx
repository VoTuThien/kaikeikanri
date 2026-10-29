import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { Skeleton } from './Skeleton'

// Menu theo hàng ngang dạng PHÂN TRANG (quy ước trong CLAUDE.md): không cuộn ngang.
// Mỗi trang chỉ chứa số mục vừa đủ bề rộng nên không mục nào bị cắt ở mép;
// hai bên có nút tam giác để chuyển trang.

const GAP = 8 // khoảng cách giữa các mục (px), khớp với gap-2
const ARROW = 'h-12 w-7' // nút chuyển trang: 2 nút cùng kích thước

function Arrow({ dir, disabled, onClick }: { dir: 'prev' | 'next'; disabled: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={dir === 'prev' ? 'Trang trước' : 'Trang sau'}
      disabled={disabled}
      onClick={onClick}
      className={`${ARROW} flex shrink-0 items-center justify-center rounded-lg transition hover:bg-white/10 active:scale-90 disabled:opacity-20`}
    >
      <svg viewBox="0 0 12 16" className="h-4 w-3" aria-hidden="true">
        <path d={dir === 'prev' ? 'M10 1 L2 8 L10 15 Z' : 'M2 1 L10 8 L2 15 Z'} fill="#ffffff" />
      </svg>
    </button>
  )
}

// Đo bề rộng vùng chứa mục (để tính số mục mỗi trang)
function useWidth() {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    setWidth(el.clientWidth)
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, width] as const
}

const perPageFor = (width: number, itemWidth: number) => Math.max(1, Math.floor((width + GAP) / (itemWidth + GAP)))

interface PagedRowProps<T> {
  items: T[]
  getKey: (item: T) => string
  renderItem: (item: T) => ReactNode
  itemWidth: number // bề rộng tối thiểu 1 mục (px) để hiện đủ thông tin
  empty?: ReactNode // nội dung khi không có mục nào
  className?: string // vd chừa chỗ bên phải cho nút nổi
}

export function PagedRow<T>({ items, getKey, renderItem, itemWidth, empty, className = '' }: PagedRowProps<T>) {
  const [ref, width] = useWidth()
  const [page, setPage] = useState(0)

  const perPage = perPageFor(width, itemWidth)
  const pages = Math.max(1, Math.ceil(items.length / perPage))
  // Danh sách ngắn lại (vd vừa kéo 1 mục lên bản đồ) thì không để trang hiện tại vượt quá trang cuối
  const current = Math.min(page, pages - 1)
  const shown = items.slice(current * perPage, (current + 1) * perPage)

  return (
    <div className={`flex h-full items-center gap-1 px-1 ${className}`}>
      <Arrow dir="prev" disabled={current === 0} onClick={() => setPage(current - 1)} />
      <div ref={ref} className="grid h-full min-w-0 flex-1 items-center gap-2" style={{ gridTemplateColumns: `repeat(${perPage}, minmax(0, 1fr))` }}>
        {items.length === 0 ? (
          <div style={{ gridColumn: '1 / -1' }}>{empty}</div>
        ) : (
          shown.map((item) => (
            <div key={getKey(item)} className="flex min-w-0 justify-center">
              {renderItem(item)}
            </div>
          ))
        )}
      </div>
      <Arrow dir="next" disabled={current >= pages - 1} onClick={() => setPage(current + 1)} />
    </div>
  )
}

// Skeleton: cùng nút tam giác hai bên, mục giữa do trang tự vẽ
export function PagedRowSkeleton({ itemWidth, renderItem, className = '' }: { itemWidth: number; renderItem: () => ReactNode; className?: string }) {
  const [ref, width] = useWidth()
  const count = width ? perPageFor(width, itemWidth) : 0
  return (
    <div className={`flex h-full items-center gap-1 px-1 ${className}`}>
      <Skeleton className={`${ARROW} shrink-0 rounded-lg opacity-50`} />
      <div ref={ref} className="grid h-full min-w-0 flex-1 items-center gap-2" style={{ gridTemplateColumns: `repeat(${Math.max(1, count)}, minmax(0, 1fr))` }}>
        {Array.from({ length: count }, (_, i) => (
          <div key={i} className="flex justify-center">
            {renderItem()}
          </div>
        ))}
      </div>
      <Skeleton className={`${ARROW} shrink-0 rounded-lg opacity-50`} />
    </div>
  )
}
