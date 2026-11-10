import { useRefreshing } from '../lib/liveQuery'

// Vòng xoay nhỏ ở góc trái dưới: trang đang hiện dữ liệu đã nhớ tạm và đang cập nhật lại từ server (xem src/lib/liveQuery.ts).
// Không che nội dung, không bắt chạm. Đặt đối xứng với nút nổi (FAB) ở góc phải dưới.
const POSITION = {
  left: 'max(1rem, calc((100vw - 28rem) / 2 + 1rem))',
  bottom: 'max(1.25rem, calc(env(safe-area-inset-bottom) + 0.75rem))',
}

export function RefreshIndicator() {
  const on = useRefreshing()
  return (
    <div
      aria-hidden={!on}
      className={`pointer-events-none fixed z-50 flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-indigo-950/70 shadow-lg shadow-black/30 backdrop-blur transition-opacity duration-300 ${
        on ? 'opacity-100' : 'opacity-0'
      }`}
      style={POSITION}
      role="status"
    >
      <span data-round className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
      <span className="sr-only">Đang cập nhật</span>
    </div>
  )
}
