import { useState } from 'react'
import { formatNumber, MAX_MONEY, moneyToWords, parseMoney } from '../../lib/format'
import { Skeleton } from './Skeleton'
import { TextField, TextFieldSkeleton, type TextFieldProps } from './TextField'

interface MoneyFieldProps extends Omit<TextFieldProps, 'value' | 'onChange' | 'suffix' | 'inputMode'> {
  value: number
  onChange: (value: number) => void
}

// Dòng số tiền bằng chữ dưới ô: cao cố định 2 dòng để chiều cao ô không đổi khi nhập (skeleton dùng chung class này)
const WORDS = 'h-8 line-clamp-2 text-[11px] leading-4 text-white/60'

// Ô nhập số tiền dùng chung cho cả app:
// - Đang nhập (onChange): chỉ giữ chữ số, không chèn dấu chấm; vượt 99 tỷ thì tự đưa về 99 tỷ
// - Nhập xong (onBlur): hiển thị có dấu chấm phân cách hàng nghìn
// - Bên dưới luôn hiện số tiền bằng chữ (vd "Một triệu năm trăm nghìn đồng")
// Skeleton: MoneyFieldSkeleton (cao bằng ô thật, gồm cả dòng chữ).
export function MoneyField({ value, onChange, onFocus, onBlur, ...rest }: MoneyFieldProps) {
  const [editing, setEditing] = useState(false)
  const text = value ? (editing ? String(value) : formatNumber(value)) : ''
  const words = moneyToWords(value)

  return (
    <div className="space-y-1">
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
      <p className={WORDS} title={words} aria-live="polite">
        {words}
      </p>
    </div>
  )
}

export function MoneyFieldSkeleton() {
  return (
    <div className="space-y-1">
      <TextFieldSkeleton />
      <div className="h-8">
        <Skeleton className="h-3 w-40 rounded-md" />
      </div>
    </div>
  )
}
