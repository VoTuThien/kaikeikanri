import { useEffect, useState } from 'react'
import { TextField, type TextFieldProps } from './TextField'

interface NumberFieldProps extends Omit<TextFieldProps, 'value' | 'onChange' | 'inputMode' | 'type'> {
  value: number
  onChange: (value: number) => void
  min?: number
  max: number
  inline?: boolean // ô số nằm trên thẻ nhập trực tiếp: chưa nhấn thì như số thường, nhấn vào mới hiện khung viền
}

// Ô số trên thẻ (vd số thứ tự của thẻ ghi chú): bỏ viền / nền khi chưa nhấn, chữ đậm ở giữa như 1 con số;
// nhấn vào (focus) thì hiện lại khung viền + nền của ô nhập để biết đang sửa.
// (!text-center: thắng text-left có sẵn của TextField)
export const INLINE_FIELD = '!px-0 !text-center font-bold not-focus:border-transparent not-focus:bg-transparent'

// Ô nhập số nguyên đơn giản (vd số thứ tự): chỉ giữ chữ số; gõ lớn hơn max thì tự đưa về max ngay khi gõ;
// để trống / nhỏ hơn min thì khi rời ô tự đưa về min. Skeleton dùng chung TextFieldSkeleton (cùng kích thước).
export function NumberField({ value, onChange, min = 1, max, inline, onBlur, className = '', ...rest }: NumberFieldProps) {
  const [text, setText] = useState(String(value))
  // Giá trị bên ngoài đổi (vd danh sách thay đổi) thì hiện theo
  useEffect(() => setText(String(value)), [value])

  return (
    <TextField
      {...rest}
      className={`${inline ? INLINE_FIELD : ''} ${className}`}
      inputMode="numeric"
      autoComplete="off"
      value={text}
      onChange={(e) => {
        const digits = e.target.value.replace(/\D/g, '')
        if (!digits) return setText('')
        const n = Math.min(Number(digits), max)
        setText(String(n))
        onChange(n)
      }}
      onBlur={(e) => {
        const n = Math.max(min, Math.min(Number(text) || min, max))
        setText(String(n))
        onChange(n)
        onBlur?.(e)
      }}
    />
  )
}
