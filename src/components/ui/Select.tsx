import type { SelectHTMLAttributes } from 'react'
import { FIELD_CLASS, FieldLabel } from './TextField'

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string
  hideLabel?: boolean // ẩn nhãn để tiết kiệm chỗ (vẫn đọc được bằng trình đọc màn hình)
}

// Dùng ô chọn gốc của trình duyệt để trên iPhone hiện bánh xe chọn quen thuộc.
// Skeleton dùng chung TextFieldSkeleton vì cùng kích thước (khi ẩn nhãn thì chỉ là 1 khối cao bằng ô nhập).
export function Select({ label, hideLabel, id, children, ...rest }: SelectProps) {
  return (
    <div className={hideLabel ? '' : 'space-y-1.5'}>
      {hideLabel ? (
        <label htmlFor={id} className="sr-only">
          {label}
        </label>
      ) : (
        <FieldLabel htmlFor={id}>{label}</FieldLabel>
      )}
      <div className="relative">
        <select id={id} className={`${FIELD_CLASS} appearance-none pr-10`} {...rest}>
          {children}
        </select>
        <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-white/60">▾</span>
      </div>
    </div>
  )
}
