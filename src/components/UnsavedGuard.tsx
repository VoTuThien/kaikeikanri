import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useBlocker, useNavigate, type NavigateOptions } from 'react-router-dom'
import { Button } from './ui/Button'
import { Icon3D } from './ui/Icon3D'

// Nhắc khi rời màn hình mà còn thông tin CHƯA LƯU (quy ước mục 20 trong CLAUDE.md).
// - Mỗi màn hình sửa thông tin gọi `useUnsavedChanges(dirty, save)`: `dirty` = đang có thay đổi chưa bấm lưu, `save` = việc bấm nút lưu
//   (form: `() => submitForm(FORM_ID)`). Hook trả về `leave(to)` để chuyển trang SAU KHI LƯU / XOÁ XONG mà không bị hỏi lại.
// - `UnsavedGuard` (gắn 1 lần trong App.tsx, cần data router) chặn MỌI kiểu rời trang khi có màn hình đang `dirty`:
//   nút ‹ quay lại, link, vuốt từ mép của iOS (quay lại theo lịch sử)… rồi hiện hộp thoại [Trở lại] (bỏ thay đổi, rời đi) / [Lưu].

interface Entry {
  dirty: boolean
  save: () => void
}

// Các màn hình đang mở (có thể nhiều hơn 1 khi đang vẽ sẵn màn hình 2 bên lúc vuốt)
const entries = new Set<{ current: Entry }>()
const dirtyEntry = () => [...entries].find((e) => e.current.dirty)?.current
// Có màn hình nào đang có thông tin chưa lưu (SideSwipe dùng để tắt vuốt sang màn hình 2 bên)
export const hasUnsaved = () => !!dirtyEntry()

export function useUnsavedChanges(dirty: boolean, save: () => void) {
  const navigate = useNavigate()
  const ref = useRef<Entry>({ dirty, save })
  useLayoutEffect(() => {
    ref.current.dirty = dirty
    ref.current.save = save
  })
  useEffect(() => {
    const r = ref
    entries.add(r)
    return () => {
      entries.delete(r)
    }
  }, [])
  // Lưu / xoá xong thì chuyển trang luôn, không hỏi
  return useCallback(
    (to: string, options?: NavigateOptions) => {
      ref.current.dirty = false
      navigate(to, options)
    },
    [navigate],
  )
}

// Các giá trị của form có khác lúc mở màn hình không (so theo JSON)
export function useChanged(values: unknown) {
  const [initial] = useState(() => JSON.stringify(values))
  return JSON.stringify(values) !== initial
}

// Bấm nút lưu của 1 form từ bên ngoài (nút Lưu của hộp thoại). iOS 15.1 chưa có requestSubmit nên tự phát sự kiện submit.
export function submitForm(id: string) {
  const form = document.getElementById(id)
  if (!(form instanceof HTMLFormElement)) return
  if (typeof form.requestSubmit === 'function') form.requestSubmit()
  else form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
}

export function UnsavedGuard() {
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      !!dirtyEntry() && (currentLocation.pathname !== nextLocation.pathname || currentLocation.search !== nextLocation.search),
  )
  const blocked = blocker.state === 'blocked'

  // Esc = ở lại màn hình
  useEffect(() => {
    if (!blocked) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && blocker.reset?.()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [blocked, blocker])

  if (!blocked) return null

  function save() {
    const entry = dirtyEntry()
    blocker.reset?.()
    entry?.save()
  }

  return createPortal(
    // Chạm nền mờ = ở lại màn hình (không rời đi, không lưu)
    <div data-no-swipe className="fixed inset-0 z-[60] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm" onClick={() => blocker.reset?.()}>
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="unsaved-title"
        className="w-full max-w-sm space-y-4 border border-white/20 bg-indigo-950/85 p-5 text-center shadow-2xl shadow-black/50 backdrop-blur-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex h-12 justify-center">
          <Icon3D emoji="📝" className="h-12 w-12" />
        </div>
        <div className="space-y-1">
          <h2 id="unsaved-title" className="text-lg leading-7 font-semibold">
            Có thông tin chưa lưu
          </h2>
          <p className="text-sm leading-5 text-white/75">Bạn đã thay đổi thông tin nhưng chưa bấm lưu. Lưu lại trước khi rời màn hình?</p>
        </div>
        {/* 2 nút bằng nhau, cùng hàng */}
        <div className="grid grid-cols-2 gap-3">
          <Button variant="secondary" onClick={() => blocker.proceed?.()}>
            Trở lại
          </Button>
          <Button variant="primary" onClick={save}>
            Lưu
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
