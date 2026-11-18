import { useEffect, useState } from 'react'
import { Icon3D } from '../../../components/ui/Icon3D'
import { TIPS } from './constants'

// Màn hình tải của game Vườn mây (nằm trong khung ngang): tên game, thanh tiến độ %, con nhím linh vật chạy theo thanh,
// mẹo chơi đổi lần lượt. Lần mở sau (mô hình đã lưu trong máy) vẫn hiện một chút cho đồng bộ (GamePage giữ tối thiểu MIN_LOADING_MS).
export function LoadingScreen({ progress, error, fading }: { progress: number; error: string | null; fading: boolean }) {
  const [tip, setTip] = useState(() => Math.floor(Math.random() * TIPS.length))
  useEffect(() => {
    const t = window.setInterval(() => setTip((n) => (n + 1) % TIPS.length), 2600)
    return () => window.clearInterval(t)
  }, [])
  const pct = Math.round(Math.max(0, Math.min(1, progress)) * 100)

  return (
    <div
      className={`absolute inset-0 z-20 flex flex-col items-center justify-center bg-gradient-to-b from-[#120a33] via-[#2a1460] to-[#5b2a86] transition-opacity duration-500 ${
        fading ? 'pointer-events-none opacity-0' : 'opacity-100'
      }`}
      style={{ paddingLeft: 'calc(var(--safe-l) + 24px)', paddingRight: 'calc(var(--safe-r) + 24px)' }}
    >
      {/* sao lấp lánh nền */}
      {Array.from({ length: 24 }, (_, i) => (
        <span
          key={i}
          data-round
          className="absolute h-1 w-1 animate-pulse rounded-full bg-white/70"
          style={{ left: `${(i * 37) % 100}%`, top: `${(i * 53) % 70}%`, animationDelay: `${(i % 7) * 0.3}s` }}
        />
      ))}
      <h1 className="mb-1 text-4xl leading-tight font-light tracking-wide lowercase">vườn mây</h1>
      <p className="mb-7 text-sm text-white/70">Đang chuẩn bị các tầng mây…</p>

      <div className="relative w-full max-w-md">
        {/* con nhím chạy theo tiến độ */}
        <div className="absolute -top-11 transition-[left] duration-300" style={{ left: `calc(${pct}% - 20px)` }}>
          <span className="block animate-bounce text-amber-200">
            <Icon3D emoji="🦔" className="h-10 w-10" />
          </span>
        </div>
        <div className="h-3 w-full overflow-hidden border border-white/30 bg-white/10 shadow-lg shadow-black/30">
          <div className="h-full bg-gradient-to-r from-fuchsia-400 to-amber-300 transition-[width] duration-300" style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-2 text-center text-sm font-semibold text-amber-100">{error ? 'Tải thất bại' : `${pct}%`}</p>
      </div>

      <p className="mt-6 h-10 max-w-md text-center text-sm leading-5 text-white/80">
        {error ?? <>Mẹo: {TIPS[tip]}</>}
      </p>
    </div>
  )
}
