// round: giữ hình tròn (avatar, nút nổi) — toàn app không bo góc, trừ vùng có data-round
export function Skeleton({ className = '', round }: { className?: string; round?: boolean }) {
  return <div data-round={round || undefined} className={`animate-pulse ${round ? 'rounded-full' : 'rounded-xl'} bg-white/15 ${className}`} />
}
