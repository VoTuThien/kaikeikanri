import { useEffect, useState, type FormEvent } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { AppHeader, AppHeaderSkeleton } from '../../components/AppHeader'
import { PageShell, ScrollArea } from '../../components/PageShell'
import { Alert } from '../../components/ui/Alert'
import { Fab, FabGroup, FabSkeleton } from '../../components/ui/Fab'
import { GlassPanel } from '../../components/ui/GlassPanel'
import { Icon3D } from '../../components/ui/Icon3D'
import { MoneyField } from '../../components/ui/MoneyField'
import { Segmented } from '../../components/ui/Segmented'
import { Select } from '../../components/ui/Select'
import { Skeleton } from '../../components/ui/Skeleton'
import { LIST_CARD, LIST_CARDS_GAP } from '../../components/ui/listStyle'
import { SIZE } from '../../components/ui/sizes'
import { formatMoney } from '../../lib/format'
import { CARD, LIST_CLASS, noteTime } from './components'
import { TextField } from '../../components/ui/TextField'
import { addItemMoney, addNoteItem, setItemDone } from './data/api'
import { useNote } from './data/NoteContext'
import { itemMemo, MAX_TEXT, moneyTotal, noteDone, noteTitle, type Note, type NoteItem, type NoteMoney } from './data/types'
import { submitForm, useUnsavedChanges } from '../../components/UnsavedGuard'

// Xem ghi chú (bước 2): các thẻ nội dung của 1 ghi chú gửi đến mình, theo thứ tự ưu tiên.
// Ghi chú MÌNH GỬI CHO NGƯỜI KHÁC (tab "Mình đã gửi") thì CHỈ XEM (`readOnly`): thấy thẻ nào đã xong và các lần nạp / rút quỹ,
// nhưng không đánh dấu xong / nạp / rút được (ô vuông không bấm được, chạm nội dung chỉ mở danh sách các lần nạp / rút, không có FAB).
// Thanh tiêu đề: tên ghi chú, dòng phụ bên dưới = người gửi · giờ ngày · số thẻ đã xong (hoặc "Đã hoàn thành").
// Mỗi thẻ: chạm ô vuông bên phải để đánh dấu đã làm xong / chưa xong; chạm phần nội dung để mở ô NẠP / RÚT QUỸ RIÊNG cho thẻ đó
// (quỹ chọn sẵn theo Cài đặt của app Ghi chú; ghi chú giao dịch = "Tên ghi chú: nội dung thẻ"; lưu bằng FAB check).
// FAB [+]: người nhận THÊM NỘI DUNG MỚI vào cuối ghi chú (vd phát sinh khoản nạp / rút chưa có trong ghi chú); thêm xong mở luôn ô nạp / rút của thẻ đó.

type Kind = 'deposit' | 'withdraw'
const KINDS: { value: Kind; label: string }[] = [
  { value: 'withdraw', label: 'Rút quỹ' },
  { value: 'deposit', label: 'Nạp quỹ' },
]

const FORM_ID = 'note-item-money-form'
const ADD_FORM_ID = 'note-add-item-form'
const CHECK = 'flex h-full w-14 shrink-0 items-center justify-center'
const SKELETON_ROWS = 5

export function NoteViewPage() {
  const { loading, inbox, sent } = useNote()
  const { id } = useParams()
  const [params] = useSearchParams()
  if (loading) return <NoteViewPageSkeleton />
  // Ghi chú gửi đến mình: xem + cập nhật như cũ; ghi chú mình gửi cho người khác: chỉ xem
  const received = inbox.find((n) => n.id === id)
  const note = received ?? sent.find((n) => n.id === id)
  if (!note) {
    return (
      <PageShell>
        <AppHeader title="Ghi chú" backTo={params.get('tab') === 'sent' ? '/note/inbox?tab=sent' : '/note/inbox'} />
        <GlassPanel className="space-y-3 text-center">
          <div className="flex h-12 justify-center">
            <Icon3D emoji="📬" className="h-12 w-12" />
          </div>
          <p className="text-sm leading-5 text-white/70">Ghi chú này không còn (đã bị xoá hoặc không liên quan tới bạn).</p>
          <Link to={params.get('tab') === 'sent' ? '/note/inbox?tab=sent' : '/note/inbox'} className="inline-block text-sm font-semibold text-fuchsia-200 underline">
            Về danh sách ghi chú
          </Link>
        </GlassPanel>
      </PageShell>
    )
  }
  return <NoteView key={note.id} note={note} readOnly={!received} />
}

function NoteView({ note, readOnly }: { note: Note; readOnly: boolean }) {
  const { actor, cards } = useNote()
  const [error, setError] = useState('')
  // Thẻ đang mở ô nạp / rút quỹ (mỗi lần chỉ mở 1 thẻ)
  const [openId, setOpenId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  // Đang thêm thẻ mới vào cuối ghi chú (người nhận, vd phát sinh khoản nạp / rút chưa có trong ghi chú)
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState('')
  // Ô nạp / rút đang mở đã nhập số tiền mà chưa lưu
  const [moneyDirty, setMoneyDirty] = useState(false)
  // Có thông tin chưa lưu: chấm đỏ trên nút lưu, rời màn hình thì hỏi lại (UnsavedGuard)
  const draftDirty = adding && draft.trim() !== ''
  const dirty = draftDirty || (!!openId && moneyDirty)
  useUnsavedChanges(dirty && !saving, () => submitForm(draftDirty ? ADD_FORM_ID : FORM_ID))

  async function handleAdd(e: FormEvent) {
    e.preventDefault()
    const text = draft.trim().replace(/\s+/g, ' ')
    if (!text) return setError('Vui lòng nhập nội dung.')
    setError('')
    setSaving(true)
    try {
      const id = await addNoteItem(note.id, text, actor, cards)
      setAdding(false)
      setDraft('')
      // Mở luôn ô nạp / rút của thẻ vừa thêm
      setOpenId(id)
    } catch (err) {
      console.error(err)
      setError(err instanceof Error && err.message.startsWith('Mục này') ? err.message : 'Thêm thất bại. Vui lòng thử lại.')
    } finally {
      setSaving(false)
    }
  }
  const done = note.items.filter((i) => i.done).length
  const open = note.items.find((i) => i.id === openId) ?? null

  function toggleDone(item: NoteItem) {
    if (readOnly) return
    setError('')
    setItemDone(note.id, item.id, !item.done, actor).catch((err) => {
      console.error(err)
      setError('Lưu thất bại. Vui lòng thử lại.')
    })
  }

  const subtitle = (
    <>
      {readOnly ? `Gửi cho ${note.toName}` : note.fromUid === actor.uid ? 'Bạn tự ghi' : `Từ ${note.fromName}`} · {noteTime(note.createdAt)} ·{' '}
      {/* Mọi thẻ đã xong = ghi chú hoàn thành */}
      {noteDone(note) ? (
        <span className="font-semibold text-emerald-300">Đã hoàn thành</span>
      ) : (
        <span className="font-semibold text-white">
          {done}/{note.items.length} xong
        </span>
      )}
    </>
  )

  return (
    <PageShell>
      <AppHeader title={noteTitle(note)} subtitle={subtitle} backTo={readOnly ? '/note/inbox?tab=sent' : '/note/inbox'} />
      {error && <Alert type="error">{error}</Alert>}
      <ScrollArea className={LIST_CLASS}>
        <div className={LIST_CARDS_GAP}>
          {note.items.map((item, i) => (
            <div key={item.id} className={LIST_CARD}>
              <div className={`${SIZE.row} flex items-center`}>
                {/* Chạm nội dung: mở / đóng ô nạp / rút quỹ của thẻ này (chỉ xem: danh sách các lần nạp / rút) */}
                <button
                  type="button"
                  aria-expanded={openId === item.id}
                  onClick={() => {
                    setAdding(false)
                    setOpenId((id) => (id === item.id ? null : item.id))
                  }}
                  className="flex h-full min-w-0 flex-1 items-center gap-3 pl-4 text-left"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/25 bg-white/10 text-sm font-bold tabular-nums">
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate text-sm leading-5 font-semibold ${item.done ? 'text-white/50 line-through' : ''}`}>{item.text}</span>
                    <ItemSummary item={item} open={openId === item.id} readOnly={readOnly} />
                  </span>
                </button>
                {/* Ô vuông: đánh dấu đã làm xong (chỉ xem: không bấm được) */}
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={item.done}
                  aria-label={`Đã làm xong: ${item.text}`}
                  aria-readonly={readOnly}
                  disabled={readOnly}
                  onClick={() => toggleDone(item)}
                  className={`${CHECK} ${readOnly ? 'opacity-70' : ''}`}
                >
                  <span
                    className={`flex h-7 w-7 items-center justify-center rounded-lg border-2 transition ${
                      item.done ? 'border-emerald-300 bg-emerald-400' : 'border-white/50 bg-white/5'
                    }`}
                  >
                    {item.done && (
                      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="#ffffff" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M5 12.5l4.5 4.5L19 7" />
                      </svg>
                    )}
                  </span>
                </button>
              </div>
              {openId === item.id &&
                (readOnly ? <ItemMoneyHistory item={item} /> : <ItemMoneyForm key={item.id} note={note} item={item} onSaving={setSaving} onDirty={setMoneyDirty} />)}
            </div>
          ))}
          {/* Thẻ mới đang nhập (thêm vào cuối ghi chú) */}
          {adding && (
            <form id={ADD_FORM_ID} onSubmit={handleAdd} className={`${LIST_CARD} ${SIZE.row} flex items-center gap-3 pr-3 pl-4`} noValidate>
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-dashed border-white/40 text-sm font-bold tabular-nums">
                {note.items.length + 1}
              </span>
              <div className="min-w-0 flex-1">
                <TextField
                  id="note-add-item"
                  label="Nội dung mới"
                  hideLabel
                  autoFocus
                  autoComplete="off"
                  enterKeyHint="done"
                  maxLength={MAX_TEXT}
                  placeholder="Nội dung mới, vd: Mua pin"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                />
              </div>
            </form>
          )}
        </div>
      </ScrollArea>
      {/* Thêm thẻ: [+] (thẻ đang mở nạp / rút thì thêm [lưu] bên phải); đang nhập thẻ mới: [huỷ] [lưu] */}
      {!readOnly && (
        <FabGroup>
          {adding ? (
            <>
              <Fab
                type="button"
                variant="secondary"
                icon="cancel"
                label="Huỷ thêm nội dung"
                onClick={() => {
                  setAdding(false)
                  setDraft('')
                  setError('')
                }}
              />
              <Fab type="submit" form={ADD_FORM_ID} icon="save" label="Thêm nội dung vào ghi chú" loading={saving} dirty={draftDirty} />
            </>
          ) : (
            <>
              <Fab
                type="button"
                variant={open ? 'secondary' : 'primary'}
                icon="add"
                label="Thêm nội dung vào ghi chú"
                onClick={() => {
                  setOpenId(null)
                  setError('')
                  setAdding(true)
                }}
              />
              {open && <Fab type="submit" form={FORM_ID} icon="save" label={`Lưu nạp / rút cho "${open.text}"`} loading={saving} dirty={moneyDirty} />}
            </>
          )}
        </FabGroup>
      )}
    </PageShell>
  )
}

// Dòng phụ của thẻ: đã xong (ai) + tổng tiền đã nạp / rút cho thẻ, hoặc hướng dẫn chạm để nạp / rút
function ItemSummary({ item, open, readOnly }: { item: NoteItem; open: boolean; readOnly: boolean }) {
  const total = moneyTotal(item)
  const parts = [
    item.done ? `Xong${item.doneByName ? ` · ${item.doneByName}` : ''}` : '',
    item.money.length > 0 ? `${total < 0 ? 'Đã rút' : 'Đã nạp'} ${formatMoney(Math.abs(total))}` : '',
  ].filter(Boolean)
  return (
    <span className="block truncate text-xs leading-5 text-white/60">
      {parts.length > 0 ? parts.join(' · ') : readOnly ? 'Chưa xong' : open ? 'Nhập số tiền nạp / rút cho mục này' : 'Chạm để nạp / rút quỹ'}
    </span>
  )
}

// Ô nạp / rút quỹ của 1 thẻ (mở ngay dưới thẻ trong bảng); các lần đã nạp / rút của thẻ hiện bên dưới
function ItemMoneyForm({
  note,
  item,
  onSaving,
  onDirty,
}: {
  note: Note
  item: NoteItem
  onSaving: (saving: boolean) => void
  onDirty: (dirty: boolean) => void // đã nhập số tiền mà chưa lưu
}) {
  const { actor, funds, settings } = useNote()
  const [kind, setKind] = useState<Kind>('withdraw')
  // Quỹ chọn sẵn = quỹ mặc định trong Cài đặt (còn tồn tại), không có thì quỹ đầu tiên
  const [fundId, setFundId] = useState(() => (funds.some((f) => f.id === settings.defaultFundId) ? settings.defaultFundId! : (funds[0]?.id ?? '')))
  const [amount, setAmount] = useState(0)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  useEffect(() => {
    onDirty(amount > 0)
    return () => onDirty(false)
  }, [amount, onDirty])

  if (funds.length === 0) {
    return (
      <p className="px-4 pb-3 text-sm leading-5 text-white/70">
        Chưa có nhóm quỹ để nạp / rút.{' '}
        <Link to="/fund/groups/new" className="font-semibold text-fuchsia-200 underline">
          Tạo nhóm quỹ
        </Link>
      </p>
    )
  }
  const fund = funds.find((f) => f.id === fundId) ?? funds[0]

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')
    if (amount <= 0) return setError('Vui lòng nhập số tiền.')
    if (kind === 'withdraw' && amount > fund.balance) {
      return setError(`Số dư quỹ không đủ. ${fund.name} chỉ còn ${formatMoney(fund.balance)}.`)
    }
    onSaving(true)
    try {
      // Ghi chú của giao dịch = "Tên ghi chú: nội dung thẻ"
      await addItemMoney(note.id, item.id, fund.id, kind, amount, itemMemo(note, item).slice(0, MAX_TEXT), actor)
      setSuccess(`${kind === 'deposit' ? 'Đã nạp' : 'Đã rút'} ${formatMoney(amount)} ${kind === 'deposit' ? 'vào' : 'từ'} ${fund.name}.`)
      setAmount(0)
    } catch (err) {
      console.error(err)
      setError(err instanceof Error && err.message.startsWith('Số dư') ? err.message : 'Lưu thất bại. Vui lòng thử lại.')
    } finally {
      onSaving(false)
    }
  }

  return (
    <form id={FORM_ID} onSubmit={handleSubmit} className="space-y-2 px-4 pb-3" noValidate>
      <Segmented options={KINDS} value={kind} onChange={setKind} />
      <Select id={`note-fund-${item.id}`} label="Nhóm quỹ" hideLabel value={fund.id} onChange={(e) => setFundId(e.target.value)}>
        {funds.map((f) => (
          <option key={f.id} value={f.id}>
            {f.icon} {f.name} ({formatMoney(f.balance)})
          </option>
        ))}
      </Select>
      <MoneyField id={`note-amount-${item.id}`} label="Số tiền" hideLabel placeholder="Số tiền" value={amount} onChange={setAmount} />
      {error && <Alert type="error">{error}</Alert>}
      {success && <Alert type="success">{success}</Alert>}
      {item.money.length > 0 && (
        <ul className="space-y-1 text-xs leading-4 text-white/70">
          {[...item.money].reverse().map((m) => (
            <MoneyLine key={m.txId} money={m} />
          ))}
        </ul>
      )}
    </form>
  )
}

// Chỉ xem (ghi chú mình gửi cho người khác): các lần người nhận đã nạp / rút quỹ cho thẻ, không có ô nhập
function ItemMoneyHistory({ item }: { item: NoteItem }) {
  if (item.money.length === 0) return <p className="px-4 pb-3 text-xs leading-4 text-white/60">Chưa có lần nạp / rút quỹ nào cho mục này.</p>
  return (
    <ul className="space-y-1 px-4 pb-3 text-xs leading-4 text-white/70">
      {[...item.money].reverse().map((m) => (
        <MoneyLine key={m.txId} money={m} />
      ))}
    </ul>
  )
}

// 1 lần đã nạp / rút của thẻ: "− 30.000 ₫ · Chi tiêu · Vợ · 14:05 · 03/11"
function MoneyLine({ money }: { money: NoteMoney }) {
  const withdraw = money.type === 'withdraw'
  return (
    <li className="flex gap-2">
      <span className={`shrink-0 font-semibold ${withdraw ? 'text-rose-200' : 'text-emerald-200'}`}>
        {withdraw ? '−' : '+'}
        {formatMoney(money.amount)}
      </span>
      <span className="min-w-0 flex-1 truncate">{[money.fundName, money.byName, noteTime(money.at)].filter(Boolean).join(' · ')}</span>
    </li>
  )
}

export function NoteViewPageSkeleton() {
  return (
    <PageShell>
      <AppHeaderSkeleton subtitle />
      <ScrollArea className={`${LIST_CLASS} !overflow-hidden`}>
        <div className={LIST_CARDS_GAP}>
          {Array.from({ length: SKELETON_ROWS }, (_, i) => (
            <div key={i} className={`${CARD} gap-3 pl-4`}>
              <Skeleton round className="h-8 w-8 rounded-full" />
              <div className="flex-1 space-y-1">
                <Skeleton className="h-4 w-36 rounded-md" />
                <Skeleton className="h-3 w-44 rounded-md" />
              </div>
              <div className={CHECK}>
                <Skeleton className="h-7 w-7 rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
      <FabSkeleton />
    </PageShell>
  )
}
