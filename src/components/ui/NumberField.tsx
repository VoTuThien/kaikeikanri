import { useEffect, useState } from 'react'
import { TextField, type TextFieldProps } from './TextField'

interface NumberFieldProps extends Omit<TextFieldProps, 'value' | 'onChange' | 'inputMode' | 'type'> {
  value: number
  onChange: (value: number) => void
  min?: number
  max: number
}

// Ô nhập số nguyên đơn giản (vd số thứ tự): chỉ giữ chữ số; gõ lớn hơn max thì tự đưa về max ngay khi gõ;
// để trống / nhỏ hơn min thì khi rời ô tự đưa về min. Skeleton dùng chung TextFieldSkeleton (cùng kích thước).
export function NumberField({ value, onChange, min = 1, max, onBlur, ...rest }: NumberFieldProps) {
  const [text, setText] = useState(String(value))
  // Giá trị bên ngoài đổi (vd danh sách thay đổi) thì hiện theo
  useEffect(() => setText(String(value)), [value])

  return (
    <TextField
      {...rest}
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
