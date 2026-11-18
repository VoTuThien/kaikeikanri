import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

// Khung game LUÔN NẰM NGANG, toàn màn hình (xem "Cơ chế hiển thị game" trong CLAUDE.md):
// - Điện thoại đang dọc: xoay cả khung 90° bằng CSS (rộng = chiều cao màn hình, cao = chiều rộng màn hình) → người chơi xoay máy là nhìn đúng chiều.
//   Chạy được cả khi bật "Khoá xoay dọc" (web trên iPhone không tự khoá hướng màn hình được).
// - Điện thoại đang ngang: hiện bình thường.
// Khung đang xoay thì toạ độ chạm (clientX / clientY) lệch theo → mọi thao tác kéo / chạm trong game đổi qua `toLocal`.
// Đặt trước: x của khung → trục dọc màn hình (xuống), y của khung → trục ngang màn hình (sang trái).
// => cạnh TRÁI khung = mép TRÊN màn hình (tai thỏ), cạnh PHẢI khung = mép DƯỚI màn hình (thanh home).

export interface Landscape {
  rotated: boolean
  width: number // bề ngang của khung (px, theo chiều ngang của game)
  height: number
  toLocal: (clientX: number, clientY: number) => { x: number; y: number }
}

const Ctx = createContext<Landscape | null>(null)
export const useLandscape = () => {
  const v = useContext(Ctx)
  if (!v) throw new Error('useLandscape phải dùng bên trong LandscapeFrame')
  return v
}

const viewport = () => ({
  w: window.innerWidth,
  h: Math.max(window.innerHeight, document.documentElement.clientHeight),
})

export function LandscapeFrame({ children }: { children: ReactNode }) {
  const [vp, setVp] = useState(viewport)
  useEffect(() => {
    const on = () => setVp(viewport())
    window.addEventListener('resize', on)
    window.addEventListener('orientationchange', on)
    // iOS đôi khi báo kích thước mới trễ sau khi xoay
    const t = window.setInterval(on, 800)
    return () => {
      window.removeEventListener('resize', on)
      window.removeEventListener('orientationchange', on)
      window.clearInterval(t)
    }
  }, [])

  const rotated = vp.h > vp.w
  const value = useMemo<Landscape>(
    () => ({
      rotated,
      width: rotated ? vp.h : vp.w,
      height: rotated ? vp.w : vp.h,
      // Khung xoay: điểm (x, y) của khung nằm ở (W - y, x) trên màn hình → ngược lại: x = clientY, y = W - clientX
      toLocal: rotated ? (cx, cy) => ({ x: cy, y: vp.w - cx }) : (cx, cy) => ({ x: cx, y: cy }),
    }),
    [rotated, vp.w, vp.h],
  )

  const style: React.CSSProperties = rotated
    ? {
        width: vp.h,
        height: vp.w,
        transform: `translate(${vp.w}px, 0) rotate(90deg)`,
        transformOrigin: '0 0',
        // vùng an toàn: cạnh trái khung = mép trên màn hình, cạnh phải khung = mép dưới
        ['--safe-l' as string]: 'env(safe-area-inset-top, 0px)',
        ['--safe-r' as string]: 'env(safe-area-inset-bottom, 0px)',
      }
    : {
        width: vp.w,
        height: vp.h,
        ['--safe-l' as string]: 'env(safe-area-inset-left, 0px)',
        ['--safe-r' as string]: 'env(safe-area-inset-right, 0px)',
      }

  return (
    <Ctx.Provider value={value}>
      <div data-no-swipe className="fixed top-0 left-0 z-[60] touch-none overflow-hidden bg-[#0b0820] select-none" style={style}>
        {children}
      </div>
    </Ctx.Provider>
  )
}
