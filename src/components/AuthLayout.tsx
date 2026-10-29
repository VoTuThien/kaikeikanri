import type { ReactNode } from 'react'
import { FIT_CLASS } from './PageShell'
import { GlassPanel } from './ui/GlassPanel'
import { Icon3D } from './ui/Icon3D'
import { BLOCK_3D, GLOSS_3D } from './ui/style3d'
import { Skeleton } from './ui/Skeleton'
import { SIZE } from './ui/sizes'

function Shell({ children }: { children: ReactNode }) {
  return (
    // Cao đúng bằng màn hình, trang không cuộn. Màn hình quá nhỏ thì cuộn bên trong khung (ẩn thanh cuộn).
    <main className="flex h-dvh items-center justify-center overflow-hidden px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]">
      <GlassPanel className={`max-h-full w-full max-w-sm ${FIT_CLASS}`}>{children}</GlassPanel>
    </main>
  )
}

export function AuthLayout({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <Shell>
      <header className="mb-6 flex flex-col items-center text-center">
        <div
          className={`${SIZE.logo} relative mb-4 flex items-center justify-center rounded-2xl bg-gradient-to-br from-fuchsia-500 to-indigo-500 ${BLOCK_3D}`}
        >
          <span className={GLOSS_3D} />
          <Icon3D emoji="🏠" className="h-10 w-10" />
        </div>
        <h1 className={`${SIZE.title} text-2xl leading-8 font-bold`}>{title}</h1>
        <p className={`${SIZE.subtitle} mt-1 w-full truncate text-sm leading-5 text-white/70`}>{subtitle}</p>
      </header>
      {children}
    </Shell>
  )
}

export function AuthLayoutSkeleton({ children }: { children: ReactNode }) {
  return (
    <Shell>
      <header className="mb-6 flex flex-col items-center" aria-busy="true">
        <Skeleton className={`${SIZE.logo} mb-4 rounded-2xl`} />
        <Skeleton className={`${SIZE.title} w-40`} />
        <Skeleton className={`${SIZE.subtitle} mt-1 w-56 rounded-md`} />
      </header>
      {children}
    </Shell>
  )
}
