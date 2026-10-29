import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { SIZE } from './sizes'

type Variant = 'primary' | 'secondary' | 'danger'

const BASE = `${SIZE.control} w-full inline-flex items-center justify-center rounded-xl px-4 text-sm font-semibold transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60`

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-gradient-to-r from-fuchsia-500 to-indigo-500 text-white shadow-lg shadow-fuchsia-500/30 hover:brightness-110',
  secondary: 'border border-white/25 bg-white/10 text-white hover:bg-white/20',
  danger: 'border border-rose-300/40 bg-rose-500/25 text-rose-50 hover:bg-rose-500/40',
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  loading?: boolean
}

// Nút luôn rộng 100% ô chứa nó: đặt các nút trong grid để cùng kích thước và thẳng hàng
export function Button({ variant = 'primary', loading, disabled, children, className = '', ...rest }: ButtonProps) {
  return (
    <button className={`${BASE} ${VARIANTS[variant]} ${className}`} disabled={disabled || loading} {...rest}>
      {loading ? <Spinner /> : children}
    </button>
  )
}

export function LinkButton({ to, variant = 'secondary', children }: { to: string; variant?: Variant; children: ReactNode }) {
  return (
    <Link to={to} className={`${BASE} ${VARIANTS[variant]}`}>
      {children}
    </Link>
  )
}

function Spinner() {
  return <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
}
