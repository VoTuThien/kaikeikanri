import { useState } from 'react'
import { Glyph, hasGlyph } from './Glyph'

// Ảnh 3D của bộ Microsoft Fluent Emoji (giấy phép MIT), đã tải về public/icons3d/ (xem scripts/fetch-icons3d.mjs).
// Tên file là mã Unicode của emoji, bỏ ký tự ẩn FE0F. Ví dụ 💰 -> 1f4b0.webp, ⚙️ -> 2699.webp
const codeOf = (emoji: string) =>
  [...emoji.replace(/️/g, '')].map((c) => c.codePointAt(0)!.toString(16)).join('-')

export const icon3dUrl = (emoji: string) => `/icons3d/${codeOf(emoji)}.webp`

interface Icon3DProps {
  emoji: string
  className?: string // kích thước, vd "h-8 w-8"
}

// Icon dùng cho MỌI icon trong app (quy ước mục 9 trong CLAUDE.md): ưu tiên icon NÉT ĐƠN SẮC tự vẽ (Glyph.tsx),
// emoji chưa có icon nét thì mới hiện ảnh 3D cũ
export function Icon3D(props: Icon3DProps) {
  if (hasGlyph(props.emoji)) return <Glyph emoji={props.emoji} className={props.className ?? 'h-8 w-8'} />
  // key theo emoji để đổi icon thì thử tải lại
  return <Icon3DImage key={props.emoji} {...props} />
}

function Icon3DImage({ emoji, className = 'h-8 w-8' }: Icon3DProps) {
  const [failed, setFailed] = useState(false)

  // Chưa tải ảnh của emoji này về project thì hiện emoji thường để không bị trống
  if (failed) {
    return <span className={`${className} flex items-center justify-center text-2xl leading-none`}>{emoji}</span>
  }
  return (
    <img
      src={icon3dUrl(emoji)}
      alt=""
      aria-hidden="true"
      draggable={false}
      decoding="async"
      onError={() => setFailed(true)}
      className={`${className} shrink-0 select-none drop-shadow-[0_3px_3px_rgba(0,0,0,0.45)]`}
    />
  )
}
