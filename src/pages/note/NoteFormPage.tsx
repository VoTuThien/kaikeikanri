import { useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { AppHeader, AppHeaderSkeleton } from '../../components/AppHeader'
import { PageShell, ScrollArea } from '../../components/PageShell'
import { Alert } from '../../components/ui/Alert'
import { Fab, FabGroup, FabSkeleton } from '../../components/ui/Fab'
import { GlassPanel } from '../../components/ui/GlassPanel'
import { Icon3D } from '../../components/ui/Icon3D'
import { NumberField } from '../../components/ui/NumberField'
import { Skeleton } from '../../components/ui/Skeleton'
import { TextField } from '../../components/ui/TextField'
import { SIZE } from '../../components/ui/sizes'
import { useFamily } from '../../contexts/FamilyContext'
import type { Member } from '../family/data/api'
import { useMembers } from '../family/data/useMembers'
import { EditableList, EditableListSkeleton, LIST_CLASS, MemberPicker, MemberPickerSkeleton, recipientLabel, type EditRow } from './components'
import { createNote, moveItemsToNewNote, updateNote } from './data/api'
import { useNote, useNoteDoc, useNotesTo } from './data/NoteContext'
import { foldKey, MAX_TEXT, noteTitle, sameKey, type Note, type NoteItem } from './data/types'
import { useChanged, useUnsavedChanges } from '../../components/UnsavedGuard'

// Tạo ghi chú (bước 2): nội dung bên trong 1 ghi chú — tạo mới (/note/sent/new?to=uid) hoặc sửa (/note/sent/:id).
// Trên cùng: [số thứ tự] [tên ghi chú] (số = ưu tiên giữa các ghi chú của người nhận; tạo mới mặc định đứng cuối).
// Thanh tiêu đề có avatar người nhận (MemberPicker, chạm để đổi người nhận — cả khi sửa: lưu thì ghi chú chuyển sang người mới, đứng cuối danh sách của họ);
// ngay dưới thanh tiêu đề là "Gửi cho: …"; danh sách các thẻ nội dung tách rời (kéo ≡ / sửa số để đổi thứ tự, trượt trái để xoá, đang gõ thì gợi ý từ Thẻ ghi chú).
// Lưu xong quay về danh sách ghi chú; thẻ có nội dung mới được lưu vào Thẻ ghi chú để gợi ý lần sau. Sửa thì thẻ cũ giữ trạng thái đã xong.

// Ô số thứ tự + tên ghi chú: cùng kiểu với 1 hàng thẻ (ô số hẹp bên trái, ô nhập rộng bên phải)
const HEAD_CLASS = 'flex items-center gap-2 !p-3'
const NUMBER = '!px-0 !text-center'
const SKELETON_ROWS = 4

let seq = 0
const newKey = () => `new-${Date.now().toString(36)}-${++seq}`
const emptyRows = (): EditRow[] => [{ key: newKey(), text: '' }]
const clean = (text: string) => text.trim().replace(/\s+/g, ' ')

export function NoteFormPage() {
  const { loading } = useNote()
  const members = useMembers(useFamily().current?.familyId)
  const { id } = useParams()
  const note = useNoteDoc(id)
  // Tạo mới từ nội dung chưa xong của 1 ghi chú (?from=id)
  const [params] = useSearchParams()
  const fromId = id ? undefined : (params.get('from') ?? undefined)
  const source = useNoteDoc(fromId)
  if (loading || !members || (id && note === undefined) || (fromId && source === undefined)) return <NoteFormPageSkeleton />
  if (id && !note) {
    return (
      <PageShell>
        <AppHeader title="Sửa ghi chú" backTo="/note/sent" />
        <GlassPanel className="space-y-3 text-center">
          <div className="flex h-12 justify-center">
            <Icon3D emoji="✍️" className="h-12 w-12" />
          </div>
          <p className="text-sm leading-5 text-white/70">Ghi chú này không còn (đã bị xoá).</p>
          <Link to="/note/sent" className="inline-block text-sm font-semibold text-fuchsia-200 underline">
            Về danh sách ghi chú
          </Link>
        </GlassPanel>
      </PageShell>
    )
  }
  return <NoteForm key={id ?? `new-${fromId ?? ''}`} members={members} note={note ?? null} source={source ?? null} />
}

function NoteForm({ members, note, source }: { members: Member[]; note: Note | null; source: Note | null }) {
  const { actor, cards } = useNote()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const isNew = !note
  // Người nhận lúc mở: sửa thì theo ghi chú; tạo mới thì theo người đang chọn ở danh sách (?to=), không có thì chính mình
  const initialTo = note?.toUid ?? members.find((m) => m.uid === (source?.toUid ?? params.get('to')))?.uid ?? actor.uid
  // Người nhận đang chọn: đổi bằng avatar trên thanh tiêu đề (MemberPicker), bấm lưu mới ghi lại.
  // Tạo từ nội dung chưa xong (?from=) thì giữ người nhận của ghi chú cũ, không đổi được.
  const [toUid, setToUid] = useState(initialTo)
  const to = members.find((m) => m.uid === toUid) ?? (note ? undefined : members.find((m) => m.uid === actor.uid))
  const toLabel = note && !to ? note.toName : recipientLabel(to, actor.uid)
  const back = `/note/sent?to=${note?.toUid ?? toUid}`
  // Ghi chú đang sửa được chuyển sang người nhận khác
  const changedTo = !!note && toUid !== note.toUid

  const [name, setName] = useState(note?.name ?? '')
  // Số thứ tự người dùng đã sửa; null = mặc định (tạo mới: đứng cuối; sửa: giữ số hiện tại)
  const [position, setPosition] = useState<number | null>(null)
  // Sửa: các thẻ của ghi chú; tạo từ ghi chú khác: các thẻ chưa xong của ghi chú đó (key = id thẻ cũ, lúc lưu sẽ chuyển sang)
  const [rows, setRows] = useState<EditRow[]>(() => {
    const initial = note ? note.items : (source?.items.filter((i) => !i.done) ?? [])
    return initial.length > 0 ? initial.map((i) => ({ key: i.id, text: i.text })) : emptyRows()
  })
  const [focusKey, setFocusKey] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  // Có thay đổi chưa lưu: chấm đỏ trên nút lưu, rời màn hình thì hỏi lại (UnsavedGuard); Lưu ở hộp thoại = bấm nút lưu
  const dirty = useChanged({ name, position, toUid, rows: rows.map((r) => [r.key, r.text]) })
  const leave = useUnsavedChanges(dirty && !saving, () => void save())

  // Các ghi chú hiện có của người nhận đang chọn: tạo mới / chuyển sang người khác thì tổng số tính cả ghi chú này (mặc định đứng cuối)
  const siblings = useNotesTo(toUid)
  // Các ghi chú của người nhận cũ (đánh số lại khi ghi chú này chuyển đi)
  const oldSiblings = useNotesTo(note?.toUid)
  const total = Math.max(1, (siblings?.length ?? 0) + (isNew || changedTo ? 1 : 0))
  const pos = Math.min(position ?? (note && !changedTo ? note.position : total), total)

  function pickRecipient(uid: string) {
    setToUid(uid)
    setPosition(null) // số thứ tự tính lại theo danh sách của người nhận mới
  }

  // Thẻ mới: thêm vào cuối, số thứ tự = tổng số thẻ tính cả thẻ vừa thêm
  function add() {
    const key = newKey()
    setRows((list) => [...list, { key, text: '' }])
    setFocusKey(key)
  }

  // Gợi ý: thẻ đã từng nhập có chứa chữ đang gõ (không phân biệt dấu / hoa thường), theo thứ tự ưu tiên;
  // bỏ thẻ đã có trong ghi chú này. Chưa gõ gì thì gợi ý các thẻ ưu tiên đầu tiên.
  function suggest(key: string, text: string) {
    const used = new Set(rows.filter((r) => r.key !== key).map((r) => sameKey(r.text)))
    const q = foldKey(text)
    return cards
      .filter((c) => !used.has(sameKey(c.text)) && sameKey(c.text) !== sameKey(text) && foldKey(c.text).includes(q))
      .map((c) => c.text)
  }

  // Trạng thái thẻ theo dữ liệu mới nhất của ghi chú (thẻ vừa thêm chưa lưu thì chưa có trạng thái)
  const itemById = new Map(note?.items.map((i) => [i.id, i]))
  function status(key: string) {
    const item = itemById.get(key)
    return item ? { done: item.done, byName: item.doneByName } : null
  }

  // Tạo ghi chú mới từ nội dung chưa xong: chỉ khi có cả thẻ đã xong và chưa xong (nếu không, ghi chú cũ sẽ trống hoặc không có gì để chuyển)
  const canSplit = !!note && note.items.some((i) => i.done) && note.items.some((i) => !i.done)
  function split() {
    if (!note) return
    const dirty = clean(name) !== clean(note.name) || rows.length !== note.items.length || rows.some((r, i) => r.key !== note.items[i].id || clean(r.text) !== clean(note.items[i].text))
    if (dirty) return setError('Bạn hãy lưu thay đổi của ghi chú này trước khi tạo ghi chú mới.')
    navigate(`/note/sent/new?from=${note.id}`)
  }

  async function save() {
    setError('')
    const title = clean(name)
    if (!title) return setError('Vui lòng nhập tên ghi chú.')
    // Bỏ thẻ trống và thẻ trùng nội dung trong cùng ghi chú
    const seen = new Set<string>()
    const kept = rows
      .map((r) => ({ key: r.key, text: clean(r.text) }))
      .filter((r) => {
        const k = sameKey(r.text)
        if (!k || seen.has(k)) return false
        seen.add(k)
        return true
      })
    if (kept.length === 0) return setError('Vui lòng nhập ít nhất 1 thẻ nội dung.')
    if (!siblings || (changedTo && !oldSiblings)) return setError('Đang tải danh sách ghi chú, vui lòng thử lại.')
    const ids = siblings.map((n) => n.id)
    setSaving(true)
    try {
      if (note) {
        // Thẻ cũ giữ trạng thái đã xong (lấy theo dữ liệu mới nhất của ghi chú), thẻ mới chưa xong
        const old = new Map(note.items.map((i) => [i.id, i]))
        const items: NoteItem[] = kept.map((r) => {
          const prev = old.get(r.key)
          return prev ? { ...prev, text: r.text } : { id: r.key, text: r.text, done: false, doneByName: '', money: [] }
        })
        await updateNote(note.id, title, items, actor, cards, ids, pos, {
          toUid,
          toName: to ? to.name || to.email : note.toName,
          fromUid: note.fromUid,
          fromName: note.fromName,
          oldIds: changedTo ? oldSiblings?.map((n) => n.id) : undefined,
        })
      } else if (source) {
        await moveItemsToNewNote(source.id, title, kept, actor, cards, ids, pos)
      } else {
        const target = to ?? { uid: actor.uid, name: actor.name, email: '' }
        await createNote(
          { uid: target.uid, name: target.name || target.email },
          title,
          kept.map((r) => r.text),
          actor,
          cards,
          ids,
          pos,
        )
      }
      leave(`/note/sent?to=${toUid}`)
    } catch (err) {
      console.error(err)
      setError(err instanceof Error && err.message.startsWith('Ghi chú') ? err.message : 'Lưu thất bại. Vui lòng thử lại.')
      setSaving(false)
    }
  }

  return (
    <PageShell>
      {/* Dòng phụ dưới tiêu đề: người nhận (+ số thẻ đã xong khi sửa) */}
      <AppHeader
        title={isNew ? 'Ghi chú mới' : 'Sửa ghi chú'}
        subtitle={`Gửi cho: ${toLabel}${note ? ` · ${note.items.filter((i) => i.done).length}/${note.items.length} thẻ đã xong` : source ? ` · Chuyển từ: ${noteTitle(source)}` : ''}`}
        backTo={back}
        right={source ? undefined : <MemberPicker members={members} value={toUid} me={actor.uid} onChange={pickRecipient} />}
      />
      <GlassPanel className={HEAD_CLASS}>
        <div className="w-12 shrink-0">
          <NumberField
            id="note-position"
            label="Số thứ tự của ghi chú"
            hideLabel
            className={NUMBER}
            value={pos}
            max={total}
            onChange={setPosition}
          />
        </div>
        <div className="min-w-0 flex-1">
          <TextField
            id="note-name"
            label="Tên ghi chú"
            hideLabel
            className="!px-3"
            placeholder="Tên ghi chú, ví dụ: Đi chợ"
            autoComplete="off"
            maxLength={MAX_TEXT}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
      </GlassPanel>
      {error && <Alert type="error">{error}</Alert>}
      <ScrollArea className={LIST_CLASS}>
        <EditableList
          rows={rows}
          idPrefix="note"
          placeholder="Ví dụ: Mua cà chua"
          focusKey={focusKey}
          onReorder={setRows}
          onChange={(key, text) => setRows((list) => list.map((r) => (r.key === key ? { ...r, text } : r)))}
          onDelete={(key) => setRows((list) => (list.length > 1 ? list.filter((r) => r.key !== key) : emptyRows()))}
          suggest={suggest}
          status={note ? status : undefined}
        />
      </ScrollArea>
      <FabGroup>
        {canSplit && <Fab icon="copy" label="Tạo ghi chú mới từ nội dung chưa hoàn thành" variant="secondary" onClick={split} />}
        <Fab icon="add" label="Thêm thẻ" variant="secondary" onClick={add} />
        <Fab icon={isNew ? 'send' : 'save'} label={isNew ? 'Gửi ghi chú' : 'Lưu ghi chú'} loading={saving} onClick={save} dirty={dirty} />
      </FabGroup>
    </PageShell>
  )
}

export function NoteFormPageSkeleton() {
  return (
    <PageShell>
      <AppHeaderSkeleton subtitle right={<MemberPickerSkeleton />} />
      <GlassPanel className={HEAD_CLASS}>
        <Skeleton className={`${SIZE.control} w-12 shrink-0`} />
        <Skeleton className={`${SIZE.control} min-w-0 flex-1`} />
      </GlassPanel>
      <ScrollArea className={`${LIST_CLASS} !overflow-hidden`}>
        <EditableListSkeleton rows={SKELETON_ROWS} />
      </ScrollArea>
      <FabSkeleton count={2} />
    </PageShell>
  )
}
