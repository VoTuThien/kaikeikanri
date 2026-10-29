import { useState } from 'react'
import { formatNumber, MAX_MONEY, parseMoney } from '../../lib/format'
import { TextField, type TextFieldProps } from './TextField'

interface MoneyFieldProps extends Omit<TextFieldProps, 'value' | 'onChange' | 'suffix' | 'inputMode'> {
  value: number
  onChange: (value: number) => void
}

// Ô nhập số tiền dùng chung cho cả app:
// - Đang nhập (onChange): chỉ giữ chữ số, không chèn dấu chấm; vượt 1 tỷ thì tự đưa về 1 tỷ
// - Nhập xong (onBlur): hiển thị có dấu chấm phân cách hàng nghìn
// Skeleton dùng chung TextFieldSkeleton vì cùng kích thước.
export function MoneyField({ value, onChange, onFocus, onBlur, ...rest }: MoneyFieldProps) {
  const [editing, setEditing] = useState(false)
  const text = value ? (editing ? String(value) : formatNumber(value)) : ''

  return (
    <TextField
      {...rest}
      suffix="₫"
      inputMode="numeric"
      autoComplete="off"
      value={text}
      onChange={(e) => onChange(Math.min(parseMoney(e.target.value), MAX_MONEY))}
      onFocus={(e) => {
        setEditing(true)
        onFocus?.(e)
      }}
      onBlur={(e) => {
        setEditing(false)
        onBlur?.(e)
      }}
    />
  )
}
