import { memo } from 'react'

// Bầu trời sao chạy ngầm dưới nền của cả app (gắn 1 lần trong App.tsx, TRƯỚC các màn hình nên nằm dưới chúng):
// - các điểm sao mờ, THỈNH THOẢNG sáng lên rồi tắt (mỗi sao 1 nhịp riêng, lệch nhau),
// - thỉnh thoảng có SAO BĂNG xẹt chéo qua màn hình.
// Chỉ dùng CSS animation (opacity / transform) nên nhẹ cho iPhone cũ; người dùng bật "Giảm chuyển động" thì đứng yên (index.css).
// Kính mờ (backdrop-blur) của các khung phía trên làm sao phía sau nhoè đi như nhìn qua kính.

// Số ngẫu nhiên cố định (giống nhau mỗi lần mở app) để sao không nhảy chỗ khi vẽ lại
function seeded(seed: number) {
  let s = seed
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}

const STAR_COUNT = 36
const rand = seeded(20260517)
const STARS = Array.from({ length: STAR_COUNT }, () => ({
  left: rand() * 100, // %
  top: rand() * 100, // %
  size: 1 + rand() * 2, // px
  duration: 4 + rand() * 7, // s: mỗi sao sáng lên 1 lần mỗi chu kỳ
  delay: -rand() * 11, // s: lệch nhịp ngay từ đầu
  big: rand() < 0.18, // vài sao to có quầng sáng
}))

// Sao băng: mỗi cái 1 chu kỳ dài, chỉ xẹt qua trong ~1 giây đầu chu kỳ (phần còn lại ẩn) -> lâu lâu mới thấy 1 lần
const METEORS = [
  { top: 8, left: 92, duration: 13, delay: 3, length: 130 },
  { top: 26, left: 70, duration: 19, delay: 10, length: 100 },
  { top: 4, left: 55, duration: 29, delay: 21, length: 160 },
]

export const StarField = memo(function StarField() {
  return (
    <div data-round className="sky-field" aria-hidden="true">
      {STARS.map((s, i) => (
        <span
          key={i}
          className={`sky-star ${s.big ? 'sky-star-big' : ''}`}
          style={{
            left: `${s.left}%`,
            top: `${s.top}%`,
            width: s.size,
            height: s.size,
            animationDuration: `${s.duration}s`,
            animationDelay: `${s.delay}s`,
          }}
        />
      ))}
      {METEORS.map((m, i) => (
        // Khung xoay chéo; vệt sáng bên trong chạy dọc theo khung
        <span key={`m${i}`} className="sky-meteor-track" style={{ top: `${m.top}%`, left: `${m.left}%` }}>
          <span className="sky-meteor" style={{ width: m.length, animationDuration: `${m.duration}s`, animationDelay: `${m.delay}s` }} />
        </span>
      ))}
    </div>
  )
})
