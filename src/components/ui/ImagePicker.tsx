import type { ChangeEvent, ReactNode } from 'react'

// Vùng chạm để chọn / chụp ảnh. Ô chọn tệp gốc nằm PHỦ LÊN nội dung (trong suốt) để ngón tay chạm thẳng vào nó.
// KHÔNG dùng <input className="hidden"> rồi gọi input.click() bằng code: trên iOS 15.1 cách đó có lúc không bật bảng
// "Thư viện ảnh / Chụp ảnh / Chọn tệp" (phải đóng mở app vài lần mới được).
// `children` chỉ để hiển thị, không đặt nút bấm bên trong.
export function ImagePicker({
  label,
  disabled,
  className = '',
  onChange,
  children,
}: {
  label: string
  disabled?: boolean
  className?: string
  onChange: (e: ChangeEvent<HTMLInputElement>) => void
  children: ReactNode
}) {
  return (
    <div className={`relative ${className}`}>
      {children}
      <input
        type="file"
        accept="image/*"
        aria-label={label}
        title=""
        disabled={disabled}
        onChange={onChange}
        className="absolute inset-0 h-full w-full cursor-pointer appearance-none overflow-hidden rounded-[inherit] opacity-0 disabled:cursor-not-allowed"
      />
    </div>
  )
}
