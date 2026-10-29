import type { ReactNode } from 'react'

// Khung chung cho các trang sau khi đăng nhập: cao đúng bằng màn hình, trang không bao giờ cuộn.
// Phần cần cuộn (bảng / danh sách) đặt trong <ScrollArea>, phần còn lại đứng yên.
// Chừa vùng tai thỏ / thanh home của iPhone.
export function PageShell({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto flex h-dvh w-full max-w-md flex-col gap-3 overflow-hidden px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] [&>*]:shrink-0">
      {children}
    </main>
  )
}

// Vùng chiếm hết chiều cao còn lại của trang, chỉ nội dung bên trong được cuộn
export function ScrollArea({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`min-h-0 flex-1 !shrink overflow-y-auto overscroll-contain scroll-thin ${className}`}>{children}</div>
  )
}

// Dự phòng cho form: nếu màn hình quá nhỏ (vd iPhone SE) thì cuộn bên trong, không hiện thanh cuộn
export const FIT_CLASS = 'min-h-0 !shrink overflow-y-auto overscroll-contain no-scrollbar'
