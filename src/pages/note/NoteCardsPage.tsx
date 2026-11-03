import { useEffect, useState } from 'react'
import { AppHeader, AppHeaderSkeleton } from '../../components/AppHeader'
import { PageShell, ScrollArea } from '../../components/PageShell'
import { Alert } from '../../components/ui/Alert'
import { Fab, FabGroup, FabSkeleton } from '../../components/ui/Fab'
import { GlassPanel } from '../../components/ui/GlassPanel'
import { Icon3D } from '../../components/ui/Icon3D'
import { EditableList, EditableListSkeleton, LIST_CLASS, ListInfo, ListInfoSkeleton, type EditRow } from './components'
import { createCard, deleteCard, reorderCards, updateCardText } from './data/api'
import { useNote } from './data/NoteContext'
import { sameKey } from './data/types'

// Quản lý các thẻ ghi chú đã từng nhập (giao diện giống Tạo ghi chú): sửa nội dung trực tiếp (rời ô là lưu),
// trượt sang trái để xoá, kéo ≡ hoặc sửa số để đổi thứ tự. Thứ tự ở đây = thứ tự ưu tiên của gợi ý khi tạo ghi chú.
// Không lưu 2 thẻ trùng nội dung.

const SKELETON_ROWS = 6
const DRAFT = 'draft:' // thẻ đang thêm, chưa lưu
const clean = (text: string) => text.trim().replace(/\s+/g, ' ')

export function NoteCardsPage() {
  const { loading } = useNote()
  if (loading) return <NoteCardsPageSkeleton />
  return <Cards />
}

function Cards() {
  const { actor, cards } = useNote()
  // Thứ tự vừa kéo thả: hiện ngay trong lúc chờ Firestore cập nhật
  const [order, setOrder] = useState<string[] | null>(null)
  // Nội dung đang sửa (chưa lưu) theo id thẻ
  const [edits, setEdits] = useState<Record<string, string>>({})
  const [drafts, setDrafts] = useState<EditRow[]>([])
  const [focusKey, setFocusKey] = useState<string | null>(null)
  const [error, setError] = useState('')

  // Firestore trả về danh sách mới thì bỏ thứ tự tạm
  const listKey = cards.map((c) => c.id).join()
  useEffect(() => setOrder(null), [listKey])

  const byId = new Map(cards.map((c) => [c.id, c]))
  const saved = order ? order.map((id) => byId.get(id)).filter((c) => !!c) : cards
  const ids = saved.map((c) => c.id)
  const rows: EditRow[] = [...saved.map((c) => ({ key: c.id, text: edits[c.id] ?? c.text })), ...drafts]

  // Trùng với thẻ khác (không phân biệt hoa thường / khoảng trắng thừa)
  const duplicate = (text: string, exceptId?: string) => cards.some((c) => c.id !== exceptId && sameKey(c.text) === sameKey(text))

  function dropEdit(id: string) {
    setEdits(({ [id]: _, ...rest }) => rest)
  }

  function fail(err: unknown, text: string) {
    console.error(err)
    setError(text)
  }

  function add() {
    const key = `${DRAFT}${Date.now()}`
    setDrafts((list) => [...list, { key, text: '' }])
    setFocusKey(key)
    setError('')
  }

  // Rời ô nhập: lưu thẻ mới / nội dung đã sửa
  function commit(key: string) {
    setError('')
    if (key.startsWith(DRAFT)) {
      const draft = drafts.find((d) => d.key === key)
      const text = clean(draft?.text ?? '')
      if (!text) return setDrafts((list) => list.filter((d) => d.key !== key))
      if (duplicate(text)) return setError(`Đã có thẻ "${text}", không lưu thẻ trùng nội dung.`)
      // Thẻ mới đứng cuối: số thứ tự = tổng số thẻ tính cả thẻ vừa thêm
      const position = ids.length + 1
      setDrafts((list) => list.filter((d) => d.key !== key))
      createCard(text, actor, ids, position).catch((err) => fail(err, 'Lưu thẻ thất bại. Vui lòng thử lại.'))
      return
    }
    const card = byId.get(key)
    const edit = edits[key]
    if (!card || edit === undefined) return
    const text = clean(edit)
    dropEdit(key)
    if (!text) return setError('Nội dung thẻ không được để trống. Muốn xoá thì trượt thẻ sang trái.')
    if (text === card.text) return
    if (duplicate(text, key)) return setError(`Đã có thẻ "${text}", không lưu thẻ trùng nội dung.`)
    updateCardText(key, text).catch((err) => fail(err, 'Lưu thẻ thất bại. Vui lòng thử lại.'))
  }

  function reorder(next: EditRow[]) {
    setError('')
    // Chỉ sắp xếp các thẻ đã lưu; thẻ đang thêm luôn nằm cuối
    const nextIds = next.map((r) => r.key).filter((k) => !k.startsWith(DRAFT))
    if (nextIds.join() === ids.join()) return
    setOrder(nextIds)
    reorderCards(nextIds).catch((err) => {
      setOrder(null)
      fail(err, 'Lưu thứ tự thất bại. Vui lòng thử lại.')
    })
  }

  async function remove(key: string) {
    setError('')
    if (key.startsWith(DRAFT)) return setDrafts((list) => list.filter((d) => d.key !== key))
    dropEdit(key)
    try {
      await deleteCard(key, ids)
    } catch (err) {
      fail(err, 'Xoá thẻ thất bại. Vui lòng thử lại.')
    }
  }

  return (
    <PageShell>
      <AppHeader title="Thẻ ghi chú" backTo="/note" />
      <ListInfo>
        <span className="font-semibold text-white">{cards.length} thẻ</span> · số nhỏ được gợi ý trước
      </ListInfo>
      {error && <Alert type="error">{error}</Alert>}
      {rows.length === 0 ? (
        <GlassPanel className="space-y-3 text-center">
          <div className="flex h-12 justify-center">
            <Icon3D emoji="🏷️" className="h-12 w-12" />
          </div>
          <p className="text-sm leading-5 text-white/70">
            Chưa có thẻ ghi chú nào. Thẻ được lưu tự động khi bạn gửi ghi chú, hoặc bấm nút dấu cộng để thêm, ví dụ: Mua cà chua.
          </p>
        </GlassPanel>
      ) : (
        <ScrollArea className={LIST_CLASS}>
          <EditableList
            rows={rows}
            idPrefix="card"
            placeholder="Ví dụ: Mua cà chua"
            focusKey={focusKey}
            onReorder={reorder}
            onChange={(key, text) => {
              if (key.startsWith(DRAFT)) setDrafts((list) => list.map((d) => (d.key === key ? { ...d, text } : d)))
              else setEdits((e) => ({ ...e, [key]: text }))
            }}
            onCommit={commit}
            onDelete={remove}
          />
        </ScrollArea>
      )}
      <FabGroup>
        <Fab icon="add" label="Thêm thẻ ghi chú" onClick={add} />
      </FabGroup>
    </PageShell>
  )
}

export function NoteCardsPageSkeleton() {
  return (
    <PageShell>
      <AppHeaderSkeleton />
      <ListInfoSkeleton />
      <ScrollArea className={`${LIST_CLASS} !overflow-hidden`}>
        <EditableListSkeleton rows={SKELETON_ROWS} />
      </ScrollArea>
      <FabSkeleton />
    </PageShell>
  )
}
