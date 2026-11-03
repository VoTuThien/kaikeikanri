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
import { EditableList, EditableListSkeleton, LIST_CLASS, ListInfo, ListInfoSkeleton, recipientLabel, type EditRow } from './components'
import { createNote, updateNote } from './data/api'
import { useNote, useNoteDoc, useNotesTo } from './data/NoteContext'
import { foldKey, MAX_TEXT, sameKey, type Note, type NoteItem } from './data/types'

// Tạo ghi chú (bước 2): nội dung bên trong 1 ghi chú — tạo mới (/note/sent/new?to=uid) hoặc sửa (/note/sent/:id).
// Trên cùng: [số thứ tự] [tên ghi chú] (số = ưu tiên giữa các ghi chú của người nhận; tạo mới mặc định đứng cuối).
// Ngay dưới thanh tiêu đề là "Gửi cho: …"; danh sách các thẻ nội dung tách rời (kéo ≡ / sửa số để đổi thứ tự, trượt trái để xoá, đang gõ thì gợi ý từ Thẻ ghi chú).
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
  if (loading || !members || (id && note === undefined)) return <NoteFormPageSkeleton />
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
  return <NoteForm key={id ?? 'new'} members={members} note={note ?? null} />
}

function NoteForm({ members, note }: { members: Member[]; note: Note | null }) {
  const { actor, cards } = useNote()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const isNew = !note
  // Người nhận: sửa thì theo ghi chú; tạo mới thì theo người đang chọn ở danh sách (?to=), không có thì chính mình
  const to = members.find((m) => m.uid === (note ? note.toUid : params.get('to'))) ?? members.find((m) => m.uid === actor.uid)
  const toUid = note?.toUid ?? to?.uid ?? actor.uid
  const toLabel = note && !to ? note.toName : recipientLabel(to, actor.uid)
  const back = `/note/sent?to=${toUid}`

  const [name, setName] = useState(note?.name ?? '')
  // Số thứ tự người dùng đã sửa; null = mặc định (tạo mới: đứng cuối; sửa: giữ số hiện tại)
  const [position, setPosition] = useState<number | null>(null)
  const [rows, setRows] = useState<EditRow[]>(() => (note && note.items.length > 0 ? note.items.map((i) => ({ key: i.id, text: i.text })) : emptyRows()))
  const [focusKey, setFocusKey] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  // Các ghi chú hiện có của người nhận: tạo mới thì tổng số tính cả ghi chú đang tạo
  const siblings = useNotesTo(toUid)
  const total = Math.max(1, (siblings?.length ?? 0) + (isNew ? 1 : 0))
  const pos = Math.min(position ?? (note ? note.position : total), total)

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
    if (!siblings) return setError('Đang tải danh sách ghi chú, vui lòng thử lại.')
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
        await updateNote(note.id, title, items, actor, cards, ids, pos)
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
      navigate(back)
    } catch (err) {
      console.error(err)
      setError('Lưu thất bại. Vui lòng thử lại.')
      setSaving(false)
    }
  }

  return (
    <PageShell>
      <AppHeader title={isNew ? 'Ghi chú mới' : 'Sửa ghi chú'} backTo={back} />
      <ListInfo>
        Gửi cho: <span className="font-semibold text-white">{toLabel}</span>
      </ListInfo>
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
        />
      </ScrollArea>
      <FabGroup>
        <Fab icon="add" label="Thêm thẻ" variant="secondary" onClick={add} />
        <Fab icon={isNew ? 'send' : 'save'} label={isNew ? 'Gửi ghi chú' : 'Lưu ghi chú'} loading={saving} onClick={save} />
      </FabGroup>
    </PageShell>
  )
}

export function NoteFormPageSkeleton() {
  return (
    <PageShell>
      <AppHeaderSkeleton />
      <ListInfoSkeleton />
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
