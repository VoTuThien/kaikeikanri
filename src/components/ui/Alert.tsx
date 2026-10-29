export function Alert({ type, children }: { type: 'error' | 'success'; children: string }) {
  const color =
    type === 'error'
      ? 'border-rose-300/40 bg-rose-500/20 text-rose-50'
      : 'border-emerald-300/40 bg-emerald-500/20 text-emerald-50'
  return (
    <div role="alert" className={`rounded-xl border px-4 py-3 text-sm ${color}`}>
      {children}
    </div>
  )
}
