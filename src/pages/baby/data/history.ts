import { useSyncExternalStore } from 'react'
import { Timestamp, type DocumentData } from 'firebase/firestore'

// Lịch sử thao tác trên Time line (Hoàn tác / Làm lại). Mỗi bước lưu ảnh chụp TRƯỚC / SAU của mọi hoạt động bị thao tác đó đụng tới
// (id -> dữ liệu Firestore, null = chưa có / đã xoá), nên thêm, sửa, xoá, kéo, chèn tách đôi, tách qua nửa đêm... đều hoàn tác được như nhau.
// Chỉ nằm trong bộ nhớ khi đang mở app (mở lại app thì mất), riêng theo từng gia đình (`scope` = đường dẫn collection hoạt động).

export type Snap = Record<string, DocumentData | null>

export interface HistoryStep {
  label: string // vd "Thêm Ăn lúc 07:00"
  child: { id: string; name: string } | null // con của time line đó (để báo thông báo khi hoàn tác / làm lại)
  before: Snap
  after: Snap
}

const LIMIT = 30

interface Stacks {
  undo: HistoryStep[]
  redo: HistoryStep[]
}

const stacks = new Map<string, Stacks>()
const listeners = new Set<() => void>()
let version = 0

function of(scope: string): Stacks {
  let s = stacks.get(scope)
  if (!s) stacks.set(scope, (s = { undo: [], redo: [] }))
  return s
}

function emit() {
  version++
  listeners.forEach((l) => l())
}

// Thao tác mới: thêm vào ngăn Hoàn tác, xoá ngăn Làm lại
export function pushStep(scope: string, step: HistoryStep) {
  const s = of(scope)
  s.undo = [...s.undo, step].slice(-LIMIT)
  s.redo = []
  emit()
}

// (không dùng Array.at: iOS 15.1 chưa có)
const last = <T,>(list: T[]) => (list.length ? list[list.length - 1] : null)
export const peekUndo = (scope: string) => last(of(scope).undo)
export const peekRedo = (scope: string) => last(of(scope).redo)

// Đã hoàn tác xong 1 bước: chuyển nó sang ngăn Làm lại (và ngược lại)
export function moveStep(scope: string, from: 'undo' | 'redo') {
  const s = of(scope)
  const step = last(s[from])
  if (!step) return
  s[from] = s[from].slice(0, -1)
  const to = from === 'undo' ? 'redo' : 'undo'
  s[to] = [...s[to], step].slice(-LIMIT)
  emit()
}

// Bỏ 1 bước không còn hoàn tác / làm lại được (vd hoạt động đã bị người khác sửa)
export function dropStep(scope: string, from: 'undo' | 'redo') {
  const s = of(scope)
  s[from] = s[from].slice(0, -1)
  emit()
}

const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => listeners.delete(l)
}

// Bước có thể hoàn tác / làm lại tiếp theo của gia đình đang chọn (cập nhật lại giao diện khi lịch sử đổi)
export function useHistory(scope: string) {
  useSyncExternalStore(subscribe, () => version)
  return { undo: peekUndo(scope), redo: peekRedo(scope) }
}

// So sánh dữ liệu Firestore (thứ tự khoá không quan trọng, Timestamp so theo giá trị)
export function sameData(a: DocumentData | null, b: DocumentData | null) {
  return key(a) === key(b)
}

function key(v: unknown): string {
  if (v === null || v === undefined) return 'null'
  if (v instanceof Timestamp) return `T${v.seconds}.${v.nanoseconds}`
  if (Array.isArray(v)) return `[${v.map(key).join(',')}]`
  if (typeof v === 'object') {
    return `{${Object.keys(v as object)
      .sort()
      .map((k) => `${k}:${key((v as Record<string, unknown>)[k])}`)
      .join(',')}}`
  }
  return JSON.stringify(v)
}
