import type { InputHTMLAttributes, Ref } from 'react'
import { Skeleton } from './Skeleton'
import { SIZE } from './sizes'

// Class dùng chung cho ô nhập và ô chọn.
// text-base (16px) để Safari trên iPhone không tự phóng to khi bấm vào ô nhập.
export const FIELD_CLASS = `${SIZE.control} w-full rounded-xl border border-white/20 bg-white/10 px-4 text-base text-white placeholder-white/40 outline-none transition [color-scheme:dark] focus:border-fuchsia-300 focus:bg-white/15 focus:ring-2 focus:ring-fuchsia-400/40`

export function FieldLabel({ htmlFor, children }: { htmlFor?: string; children: string }) {
  return (
    <label htmlFor={htmlFor} className={`${SIZE.label} block text-sm leading-5 font-medium text-white/80`}>
      {children}
    </label>
  )
}

export interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  suffix?: string // chữ hiển thị cuối ô, vd "₫", "%/năm"
  hideLabel?: boolean // ẩn nhãn để ô gọn trong 1 hàng (vẫn đọc được bằng trình đọc màn hình)
  ref?: Ref<HTMLInputElement> // React 19: ref là prop thường, chuyển thẳng vào <input>
}

export function TextField({ label, id, suffix, hideLabel, className = '', ...rest }: TextFieldProps) {
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
        <input
          id={id}
          className={`${FIELD_CLASS} appearance-none text-left ${suffix ? (suffix.length > 2 ? 'pr-20' : 'pr-10') : ''} ${className}`}
          {...rest}
        />
        {suffix && (
          <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-sm text-white/60">
            {suffix}
          </span>
        )}
      </div>
    </div>
  )
}

export function TextFieldSkeleton() {
  return (
    <div className="space-y-1.5">
      <Skeleton className={`${SIZE.label} w-24 rounded-md`} />
      <Skeleton className={`${SIZE.control} w-full`} />
    </div>
  )
}
