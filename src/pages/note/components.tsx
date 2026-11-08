import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, Navigate, Outlet } from 'react-router-dom'
import { Avatar } from '../../components/Avatar'
import { useAppScope } from '../../components/useAppScope'
import { useDragReorder } from '../../components/useDragReorder'
import { FAB_SPACE, LineIcon } from '../../components/ui/Fab'
import { Icon3D } from '../../components/ui/Icon3D'
import { NumberField } from '../../components/ui/NumberField'
import { Skeleton } from '../../components/ui/Skeleton'
import { LIST_CARD, LIST_CARD_DRAGGING, LIST_CARD_RADIUS, LIST_CARDS_GAP, SWIPE_OVERLAP_PAD } from '../../components/ui/listStyle'
import { SwipeActions } from '../../components/ui/SwipeActions'
import { TextField } from '../../components/ui/TextField'
import { SIZE } from '../../components/ui/sizes'
import type { Member } from '../family/data/api'
import { deleteNote, reorderNotes } from './data/api'
import { NoteProvider } from './data/NoteContext'
import { MAX_TEXT, noteDone, noteText, noteTitle, type Note } from './data/types'

// Bọc tất cả trang của app Ghi chú: kiểm tra đăng nhập / gia đình và tải dữ liệu dùng chung một lần
export function NoteLayout() {
  const { redirect, actor, key } = useAppScope()
  if (redirect) return <Navigate to={redirect} replace />
  return (
    <NoteProvider key={key} actor={actor}>
      <Outlet />
    </NoteProvider>
  )
}

// Thời điểm gửi ghi chú: "14:05 · 03/11"
export const noteTime = (d: Date | null) =>
  d
    ? `${d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false })} · ${d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}`
    : ''

// ---- Chọn người nhận (thanh tiêu đề của Tạo ghi chú, giống chọn con ở Time line) ----
// Chỉ hiện avatar tròn của người đang chọn; chạm -> popup lưới avatar các thành viên trong gia đình.
const PICKER = `${SIZE.control} w-12`

export function MemberPicker({ members, value, me, onChange }: { members: Member[]; value: string; me: string; onChange: (uid: string) => void }) {
  const [open, setOpen] = useState(false)
  const current = members.find((m) => m.uid === value)
  const label = (m: Member) => (m.uid === me ? 'Bạn' : m.name || m.email)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Gửi cho: ${current ? label(current) : 'Bạn'}. Chạm để chọn người khác`}
        className={`${PICKER} flex shrink-0 items-center justify-center rounded-full transition active:scale-95`}
      >
        <Avatar uid={value} name={current?.name || current?.email || ''} size="h-12 w-12 text-base" />
      </button>
      {open &&
        // Vẽ ra document.body: không nằm trong GlassPanel (backdrop-blur làm position: fixed bị lệch)
        createPortal(
          <div
            data-no-swipe
            className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 px-4 pt-24 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          >
            <div
              role="dialog"
              aria-label="Gửi ghi chú cho"
              className="w-full max-w-sm rounded-3xl border border-white/20 bg-indigo-950/80 p-4 shadow-2xl shadow-black/40 backdrop-blur-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="mb-3 text-center text-base leading-6 font-semibold">Gửi ghi chú cho</h2>
              <div className="grid max-h-[60vh] grid-cols-4 gap-x-2 gap-y-3 overflow-y-auto">
                {members.map((m) => (
                  <button
                    key={m.uid}
                    type="button"
                    onClick={() => {
                      onChange(m.uid)
                      setOpen(false)
                    }}
                    className="flex flex-col items-center gap-1 transition active:scale-95"
                  >
                    <span className={`flex rounded-full p-0.5 ${m.uid === value ? 'bg-white' : ''}`}>
                      <Avatar uid={m.uid} name={m.name || m.email} size="h-14 w-14 text-lg" />
                    </span>
                    <span className="line-clamp-2 h-8 w-full text-center text-xs leading-4 break-words">{label(m)}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}

export function MemberPickerSkeleton() {
  return <Skeleton className={`${PICKER} rounded-full`} />
}

// Thông tin chung của danh sách ghi chú: hiện ở dòng phụ ngay dưới tiêu đề màn hình (AppHeader subtitle, giống màn hình xem 1 ghi chú)
export const doneSummary = (notes: Note[]) => `${notes.filter(noteDone).length}/${notes.length} ghi chú đã hoàn thành`

// Vùng cuộn của danh sách thẻ tách rời (giống Nhóm quỹ): chừa lề cho bóng đổ của thẻ + chỗ cho nút nổi
export const LIST_CLASS = `-mx-1 px-1 py-1 ${FAB_SPACE}`

// ---- Danh sách thẻ nhập trực tiếp (Tạo ghi chú, Thẻ ghi chú) ----
// Mỗi thẻ 1 hàng: [≡ kéo lên / xuống] [số thứ tự] [ô nhập nội dung]; trượt thẻ sang TRÁI hiện thùng rác (chạm 2 lần mới xoá).
// Đang gõ thì hiện gợi ý ngay dưới thẻ (nếu có `suggest`), chạm gợi ý để điền.

export interface EditRow {
  key: string
  text: string
}

const REVEAL = 76 // px, bề rộng nút thùng rác
// Mỗi hàng là 1 thẻ glass tách rời (giống thẻ Nhóm quỹ); thẻ đang kéo thả phóng to nhẹ
export const CARD = `${SIZE.row} flex items-center ${LIST_CARD}`
const DRAGGING = LIST_CARD_DRAGGING
const HANDLE = 'flex h-full w-8 shrink-0 cursor-grab touch-none items-center justify-center text-lg text-white/50 active:cursor-grabbing'
// Ô số thứ tự trên thẻ (kiểu inline của NumberField: chưa nhấn thì như số thường); cho phép gõ trong vùng select-none của SwipeActions
const NUMBER = 'select-text'
// Thẻ nằm trong vùng select-none của SwipeActions: cho phép chọn chữ / gõ trong ô nhập (iOS cũ chặn gõ nếu không có)
const TEXT = '!px-3 select-text'
const SUGGEST_LIMIT = 4
// Chờ 1 chút sau khi rời ô nhập rồi mới ẩn gợi ý, để chạm vào gợi ý vẫn kịp nhận
const BLUR_DELAY = 250

export function EditableList({
  rows,
  idPrefix,
  placeholder,
  focusKey,
  onReorder,
  onChange,
  onCommit,
  onDelete,
  suggest,
  status,
}: {
  rows: EditRow[]
  idPrefix: string
  placeholder: string
  focusKey?: string | null // thẻ vừa thêm: tự đưa con trỏ vào
  onReorder: (next: EditRow[]) => void
  onChange: (key: string, text: string) => void
  onCommit?: (key: string) => void // rời ô nhập (vd lưu nội dung ở Thẻ ghi chú)
  onDelete: (key: string) => void | Promise<void>
  suggest?: (key: string, text: string) => string[]
  status?: (key: string) => { done: boolean; byName: string } | null // trạng thái của thẻ (null = thẻ mới, chưa có trạng thái)
}) {
  const [openKey, setOpenKey] = useState<string | null>(null)
  const [active, setActive] = useState<string | null>(null)
  const blurTimer = useRef(0)
  const inputs = useRef(new Map<string, HTMLInputElement>())
  const pending = useRef(new Map<string, number>())
  const reorder = useDragReorder(rows, onReorder)

  useEffect(() => {
    if (focusKey) inputs.current.get(focusKey)?.focus()
  }, [focusKey])
  useEffect(() => () => window.clearTimeout(blurTimer.current), [])

  // Đổi số thứ tự bằng ô số (áp dụng khi rời ô): đưa thẻ tới đúng vị trí đó
  function moveTo(key: string, position: number) {
    const from = rows.findIndex((r) => r.key === key)
    const to = Math.max(0, Math.min(rows.length - 1, position - 1))
    if (from < 0 || from === to) return
    const next = [...rows]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    onReorder(next)
  }

  return (
    // Kéo lên / xuống, trượt thẻ không phải vuốt sang màn hình bên cạnh
    <div ref={reorder.listRef} className={LIST_CARDS_GAP} data-no-swipe>
      {rows.map((r, i) => {
        const dragging = reorder.isDragging(i)
        const tips = suggest && active === r.key && !reorder.dragging ? suggest(r.key, r.text).slice(0, SUGGEST_LIMIT) : []
        const state = status?.(r.key) ?? null
        return (
          <div
            key={r.key}
            className={`relative ${dragging ? DRAGGING : 'transition-transform duration-150'}`}
            style={{ transform: `translateY(${reorder.offsetOf(i)}px)` }}
          >
            <SwipeActions
              width={REVEAL}
              open={openKey === r.key}
              onOpen={() => setOpenKey(r.key)}
              onClose={() => setOpenKey((k) => (k === r.key ? null : k))}
              className="rounded-2xl"
              radius={LIST_CARD_RADIUS}
              actions={() => <TrashButton onDelete={() => onDelete(r.key)} />}
            >
              <div className={`${CARD} gap-2 pr-3`}>
                <button type="button" aria-label={`Kéo để đổi thứ tự thẻ số ${i + 1}`} className={HANDLE} {...reorder.handleProps(i)}>
                  ≡
                </button>
                <div className="w-12 shrink-0">
                  <NumberField
                    id={`${idPrefix}-pos-${r.key}`}
                    label={`Số thứ tự của thẻ ${i + 1}`}
                    hideLabel
                    inline
                    className={NUMBER}
                    value={reorder.displayIndex(i)}
                    max={rows.length}
                    onChange={(n) => pending.current.set(r.key, n)}
                    onBlur={() => {
                      const n = pending.current.get(r.key)
                      pending.current.delete(r.key)
                      if (n) moveTo(r.key, n)
                    }}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <TextField
                    ref={(el: HTMLInputElement | null) => {
                      if (el) inputs.current.set(r.key, el)
                      else inputs.current.delete(r.key)
                    }}
                    id={`${idPrefix}-text-${r.key}`}
                    label={`Nội dung thẻ ${i + 1}`}
                    hideLabel
                    className={`${TEXT} ${state?.done ? '!text-white/50 line-through' : ''}`}
                    placeholder={placeholder}
                    autoComplete="off"
                    enterKeyHint="done"
                    maxLength={MAX_TEXT}
                    value={r.text}
                    onChange={(e) => onChange(r.key, e.target.value)}
                    onFocus={() => {
                      window.clearTimeout(blurTimer.current)
                      setActive(r.key)
                    }}
                    onBlur={() => {
                      onCommit?.(r.key)
                      blurTimer.current = window.setTimeout(() => setActive((k) => (k === r.key ? null : k)), BLUR_DELAY)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        e.currentTarget.blur()
                      }
                    }}
                  />
                </div>
                {/* Trạng thái của thẻ: vòng xanh có dấu check = đã xong, vòng rỗng = chưa xong */}
                {state && (
                  <span
                    role="img"
                    aria-label={state.done ? `Đã xong${state.byName ? ` bởi ${state.byName}` : ''}` : 'Chưa xong'}
                    title={state.done ? `Đã xong${state.byName ? ` bởi ${state.byName}` : ''}` : 'Chưa xong'}
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${state.done ? 'border-emerald-300 bg-emerald-400' : 'border-white/40'}`}
                  >
                    {state.done && <LineIcon icon="save" className="h-4 w-4" />}
                  </span>
                )}
              </div>
            </SwipeActions>
            {/* Gợi ý từ các thẻ đã từng nhập (theo thứ tự ưu tiên ở màn hình Thẻ ghi chú) */}
            {tips.length > 0 && (
              <div className="space-y-1 pt-1 pr-3 pl-[5.5rem]">
                {tips.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => {
                      onChange(r.key, t)
                      setActive(null)
                    }}
                    className="flex h-9 w-full items-center gap-2 rounded-lg border border-white/15 bg-white/10 px-3 text-left text-sm transition active:scale-[0.98]"
                  >
                    <span className="text-white/50">↳</span>
                    <span className="min-w-0 flex-1 truncate">{t}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// Nút thùng rác hiện ra khi trượt thẻ: chạm 1 lần thành "Xoá?", chạm lần nữa mới xoá (giống Tra cứu của app Quỹ)
export function TrashButton({ onDelete, what = 'thẻ' }: { onDelete: () => void | Promise<void>; what?: string }) {
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)

  async function tap() {
    if (!confirm) return setConfirm(true)
    setBusy(true)
    try {
      await onDelete()
    } finally {
      setBusy(false)
      setConfirm(false)
    }
  }

  return (
    <button
      type="button"
      aria-label={confirm ? `Bấm lần nữa để xoá ${what}` : `Xoá ${what}`}
      disabled={busy}
      onClick={tap}
      // Lề trái = phần nền lấn dưới thẻ (SWIPE_OVERLAP), để icon / chữ nằm giữa phần lộ ra
      className={`flex h-full w-full flex-col items-center justify-center gap-0.5 ${SWIPE_OVERLAP_PAD} text-[11px] font-semibold transition ${
        confirm ? 'bg-rose-600 ring-4 ring-rose-300/60 ring-inset' : 'bg-rose-500/90'
      }`}
    >
      {busy ? <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/40 border-t-white" /> : <LineIcon icon="delete" className="h-6 w-6" />}
      {confirm ? 'Xoá?' : 'Xoá'}
    </button>
  )
}

// Skeleton của danh sách thẻ (cùng chiều cao hàng)
export function EditableListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className={LIST_CARDS_GAP}>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className={`${CARD} gap-2 pr-3`}>
          <div className="flex w-8 shrink-0 justify-center">
            <Skeleton className="h-4 w-4 rounded-md" />
          </div>
          {/* Ô số thứ tự trên thẻ khi chưa nhấn chỉ là 1 con số */}
          <div className={`${SIZE.control} flex w-12 shrink-0 items-center justify-center`}>
            <Skeleton className="h-4 w-5 rounded-md" />
          </div>
          <Skeleton className={`${SIZE.control} min-w-0 flex-1`} />
        </div>
      ))}
    </div>
  )
}

// ---- Danh sách ghi chú (Xem ghi chú, Tạo ghi chú) ----
// Thao tác giống thẻ nội dung: kéo ≡ hoặc sửa số để đổi thứ tự, trượt sang TRÁI hiện thùng rác (chạm 2 lần mới xoá).
// Chạm 1 ghi chú để mở danh sách nội dung bên trong (`linkTo`). Đặt bên trong ScrollArea của trang.

export function NoteList({
  notes,
  me,
  linkTo,
  onError,
}: {
  notes: Note[] // các ghi chú của cùng 1 người nhận, theo số thứ tự
  me: string
  linkTo: (note: Note) => string
  onError: (message: string) => void
}) {
  // Thứ tự vừa kéo thả: hiện ngay trong lúc chờ Firestore cập nhật
  const [local, setLocal] = useState<Note[] | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const pending = useRef(new Map<string, number>())

  // Firestore trả về thứ tự mới thì bỏ thứ tự tạm
  const key = notes.map((n) => n.id).join()
  useEffect(() => setLocal(null), [key])

  const list = local ?? notes
  const ids = list.map((n) => n.id)

  function save(next: Note[]) {
    onError('')
    setLocal(next.map((n, i) => ({ ...n, position: i + 1 })))
    reorderNotes(next.map((n) => n.id)).catch((err) => {
      console.error(err)
      setLocal(null)
      onError('Lưu thứ tự thất bại. Vui lòng thử lại.')
    })
  }
  const reorder = useDragReorder(list, save)

  // Sửa số thứ tự (áp dụng khi rời ô): đưa ghi chú tới đúng vị trí đó
  function moveTo(id: string, position: number) {
    const from = ids.indexOf(id)
    const to = Math.max(0, Math.min(list.length - 1, position - 1))
    if (from < 0 || from === to) return
    const next = [...list]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    save(next)
  }

  async function remove(id: string) {
    onError('')
    try {
      await deleteNote(id, ids)
      setOpenId(null)
    } catch (err) {
      console.error(err)
      onError('Xoá ghi chú thất bại. Vui lòng thử lại.')
    }
  }

  return (
    // Kéo lên / xuống, trượt thẻ không phải vuốt sang màn hình bên cạnh
    <div ref={reorder.listRef} className={LIST_CARDS_GAP} data-no-swipe>
      {list.map((note, i) => {
        const dragging = reorder.isDragging(i)
        return (
          <div
            key={note.id}
            className={`relative ${dragging ? DRAGGING : 'transition-transform duration-150'}`}
            style={{ transform: `translateY(${reorder.offsetOf(i)}px)` }}
          >
            <SwipeActions
              width={REVEAL}
              open={openId === note.id}
              onOpen={() => setOpenId(note.id)}
              onClose={() => setOpenId((id) => (id === note.id ? null : id))}
              className="rounded-2xl"
              radius={LIST_CARD_RADIUS}
              actions={() => <TrashButton what="ghi chú" onDelete={() => remove(note.id)} />}
            >
              <div className={`${CARD} gap-2`}>
                <button type="button" aria-label={`Kéo để đổi thứ tự ghi chú số ${i + 1}`} className={HANDLE} {...reorder.handleProps(i)}>
                  ≡
                </button>
                <div className="w-12 shrink-0">
                  <NumberField
                    id={`note-pos-${note.id}`}
                    label={`Số thứ tự của ghi chú ${i + 1}`}
                    hideLabel
                    inline
                    className={NUMBER}
                    value={reorder.displayIndex(i)}
                    max={list.length}
                    onChange={(n) => pending.current.set(note.id, n)}
                    onBlur={() => {
                      const n = pending.current.get(note.id)
                      pending.current.delete(note.id)
                      if (n) moveTo(note.id, n)
                    }}
                  />
                </div>
                <NoteRow note={note} me={me} to={linkTo(note)} />
              </div>
            </SwipeActions>
          </div>
        )
      })}
    </div>
  )
}

// ---- Danh sách ghi chú mình đã gửi cho người khác (Xem ghi chú, tab "Mình đã gửi") ----
// CHỈ XEM: không kéo đổi thứ tự / không xoá (thứ tự là của người nhận; sửa / xoá ở Tạo ghi chú).
// Mỗi thẻ: [avatar người nhận] [tên ghi chú, "Gửi cho …" · giờ] [số thẻ đã xong / tổng hoặc "Xong"]; chạm để xem chi tiết.
export function SentNoteList({ notes, linkTo }: { notes: Note[]; linkTo: (note: Note) => string }) {
  return (
    <div className={LIST_CARDS_GAP}>
      {notes.map((note) => (
        <div key={note.id} className={`${CARD} gap-3 pl-3`}>
          <Avatar uid={note.toUid} name={note.toName} />
          <NoteRow note={note} me="" to={linkTo(note)} sent />
        </div>
      ))}
    </div>
  )
}

export function SentNoteListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className={LIST_CARDS_GAP}>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className={`${CARD} gap-3 pr-4 pl-3`}>
          <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
          <div className="flex-1 space-y-1">
            <Skeleton className="h-4 w-36 rounded-md" />
            <Skeleton className="h-3 w-44 rounded-md" />
          </div>
          <Skeleton className="h-4 w-8 rounded-md" />
        </div>
      ))}
    </div>
  )
}

// 1 dòng ghi chú: tên, các thẻ, người gửi (hoặc người nhận nếu `sent`), số thẻ đã xong / tổng hoặc "Xong" khi ghi chú hoàn thành
function NoteRow({ note, me, to, sent }: { note: Note; me: string; to: string; sent?: boolean }) {
  const done = note.items.filter((i) => i.done).length
  const finished = noteDone(note)
  const who = sent ? `Gửi cho ${note.toName}` : note.fromUid === me ? 'Bạn tự ghi' : `Từ ${note.fromName}`
  return (
    <Link to={to} className="flex h-full min-w-0 flex-1 items-center gap-2 pr-4">
      <span className="min-w-0 flex-1">
        <span className={`block truncate text-sm leading-5 font-semibold ${finished ? 'text-white/60 line-through' : ''}`}>{noteTitle(note)}</span>
        <span className="block truncate text-xs leading-5 text-white/60">
          {[note.name ? noteText(note.items) : '', who, noteTime(note.createdAt)]
            .filter(Boolean)
            .join(' · ')}
        </span>
      </span>
      {finished ? (
        <span className="flex shrink-0 items-center gap-1 text-xs leading-5 font-semibold text-emerald-300">
          <Icon3D emoji="✅" className="h-5 w-5" />
          Xong
        </span>
      ) : (
        <span className="shrink-0 text-xs leading-5 font-semibold text-amber-200">
          {done}/{note.items.length}
        </span>
      )}
    </Link>
  )
}

// Skeleton của danh sách ghi chú (cùng chiều cao hàng)
export function NoteListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className={LIST_CARDS_GAP}>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className={`${CARD} gap-2 pr-4`}>
          <div className="flex w-8 shrink-0 justify-center">
            <Skeleton className="h-4 w-4 rounded-md" />
          </div>
          {/* Ô số thứ tự trên thẻ khi chưa nhấn chỉ là 1 con số */}
          <div className={`${SIZE.control} flex w-12 shrink-0 items-center justify-center`}>
            <Skeleton className="h-4 w-5 rounded-md" />
          </div>
          <div className="flex-1 space-y-1">
            <Skeleton className="h-4 w-36 rounded-md" />
            <Skeleton className="h-3 w-44 rounded-md" />
          </div>
          <Skeleton className="h-4 w-8 rounded-md" />
        </div>
      ))}
    </div>
  )
}

// Tên người nhận hiển thị ("Bạn (chính mình)" nếu gửi cho mình)
export const recipientLabel = (m: Member | undefined, me: string) => (!m || m.uid === me ? 'Bạn (chính mình)' : m.name || m.email)
