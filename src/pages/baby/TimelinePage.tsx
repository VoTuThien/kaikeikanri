import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { AppHeader, AppHeaderSkeleton } from '../../components/AppHeader'
import { PageShell, ScrollArea } from '../../components/PageShell'
import { Alert } from '../../components/ui/Alert'
import { Button } from '../../components/ui/Button'
import { SaveDeleteFabs } from '../../components/ui/Fab'
import { GLASS_CLASS, GlassPanel } from '../../components/ui/GlassPanel'
import { Icon3D } from '../../components/ui/Icon3D'
import { MinutesField } from '../../components/ui/MinutesField'
import { PagedRow, PagedRowSkeleton } from '../../components/ui/PagedRow'
import { Skeleton } from '../../components/ui/Skeleton'
import { TextField } from '../../components/ui/TextField'
import { SIZE } from '../../components/ui/sizes'
import { CardIcon, DayBar, DayBarSkeleton } from './components'
import { createEntry, deleteEntry, updateEntry } from './data/api'
import { useBaby, useDayEntries } from './data/BabyContext'
import {
  addMinutes,
  entryState,
  formatDuration,
  formatTime,
  fromTimeInput,
  lastEntry,
  MAX_MINUTES,
  sameDay,
  startOfDay,
  toTimeInput,
  type BabyCard,
  type BabyEntry,
} from './data/types'

// Danh sách hoạt động: chiếm hết phần còn lại của màn hình, chỉ danh sách được cuộn
const TABLE_CLASS = `${GLASS_CLASS} !p-0`
const TRAY_CLASS = `${SIZE.tray} !p-0`
// Bề rộng 1 thẻ trong khay (icon + tên tối đa 3 dòng)
const TRAY_ITEM_WIDTH = 64
const FORM_ID = 'baby-entry-form'
// 3 ô giờ / số phút nằm chung 1 hàng nên thu hẹp lề trong để hiện đủ "HH:MM"
const TIME_FIELD = '!px-2.5'
// Ô bị khoá khi chưa hoàn thành: mờ đi
const LOCKED = 'disabled:opacity-40 disabled:cursor-not-allowed'
// Số dòng skeleton trong danh sách
const SKELETON_ROWS = 6

// Khung nhập đang mở: thêm từ 1 thẻ, hoặc sửa 1 hoạt động đã có
type Sheet = { mode: 'new'; card: BabyCard } | { mode: 'edit'; entry: BabyEntry }

export function TimelinePage() {
  const { loading } = useBaby()
  const [day, setDay] = useState(() => startOfDay(new Date()))
  const entries = useDayEntries(day)
  if (loading) return <TimelinePageSkeleton />
  return <Timeline day={day} setDay={setDay} entries={entries} />
}

function Timeline({ day, setDay, entries }: { day: Date; setDay: (d: Date) => void; entries: BabyEntry[] | null }) {
  const { cards } = useBaby()
  const [sheet, setSheet] = useState<Sheet | null>(null)

  function changeDay(next: Date) {
    setSheet(null)
    setDay(next)
  }

  const editingId = sheet?.mode === 'edit' ? sheet.entry.id : null

  return (
    <PageShell>
      <AppHeader title="Time line" backTo="/baby" />

      <DayBar day={day} onChange={changeDay} />

      {/* Danh sách hoạt động trong ngày, theo giờ bắt đầu */}
      <ScrollArea className={TABLE_CLASS}>
        {entries === null ? (
          <TimelineRowsSkeleton />
        ) : entries.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
            <Icon3D emoji="🕒" className="h-12 w-12" />
            <span className="text-sm leading-5 text-white/70">Chưa có hoạt động nào. Chạm một thẻ bên dưới để ghi lại.</span>
          </div>
        ) : (
          <div className="divide-y divide-white/10">
            {entries.map((e) => (
              <button
                key={e.id}
                type="button"
                onClick={() => setSheet({ mode: 'edit', entry: e })}
                className={`${SIZE.row} flex w-full items-center gap-3 px-4 text-left transition ${editingId === e.id ? 'bg-white/15' : 'hover:bg-white/5'}`}
              >
                <span className="w-12 shrink-0 text-right">
                  <span className="block text-sm leading-5 font-bold tabular-nums">{formatTime(e.start)}</span>
                  <span className="block text-xs leading-4 text-white/50 tabular-nums">{e.end ? formatTime(e.end) : '...'}</span>
                </span>
                <CardIcon icon={e.icon} color={e.color} box="h-10 w-10" img="h-7 w-7" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm leading-5 font-semibold">{e.name}</span>
                  <span className="flex items-center gap-1.5 truncate text-xs leading-5 text-white/60">
                    <StateLabel entry={e} />
                    {e.createdByName && <span className="truncate">· {e.createdByName}</span>}
                  </span>
                </span>
              </button>
            ))}
          </div>
        )}
      </ScrollArea>

      {sheet ? (
        <EntrySheet
          key={sheet.mode === 'new' ? `new-${sheet.card.id}` : sheet.entry.id}
          sheet={sheet}
          day={day}
          entries={entries ?? []}
          onClose={() => setSheet(null)}
        />
      ) : (
        // Khay thẻ: chạm 1 thẻ để thêm hoạt động; phân trang (nút tam giác 2 bên)
        <GlassPanel className={TRAY_CLASS}>
          <PagedRow
            items={cards}
            getKey={(c) => c.id}
            itemWidth={TRAY_ITEM_WIDTH}
            empty={
              <p className="text-center text-xs leading-5 text-white/70">
                Chưa có thẻ hoạt động.{' '}
                <Link to="/baby/cards/new" className="font-semibold text-fuchsia-200 underline">
                  Tạo thẻ
                </Link>
              </p>
            }
            renderItem={(c) => (
              <button
                type="button"
                onClick={() => setSheet({ mode: 'new', card: c })}
                className="flex w-full flex-col items-center gap-1 transition active:scale-95"
              >
                <CardIcon icon={c.icon} color={c.color} />
                <span className="line-clamp-3 w-full text-center text-[10px] leading-3 font-medium">{c.name}</span>
              </button>
            )}
          />
        </GlassPanel>
      )}
    </PageShell>
  )
}

// Trạng thái của hoạt động: thời lượng nếu đã xong, còn lại là "Đang diễn ra" / "Sắp bắt đầu"
function StateLabel({ entry }: { entry: BabyEntry }) {
  const state = entryState(entry)
  if (state === 'done') return <span className="shrink-0">{formatDuration(entry.minutes ?? 0)}</span>
  return (
    <span className={`flex shrink-0 items-center gap-1 font-semibold ${state === 'ongoing' ? 'text-emerald-300' : 'text-amber-200'}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${state === 'ongoing' ? 'animate-pulse bg-emerald-300' : 'bg-amber-200'}`} />
      {state === 'ongoing' ? 'Đang diễn ra' : 'Sắp bắt đầu'}
    </span>
  )
}

const nowToMinute = () => {
  const now = new Date()
  now.setSeconds(0, 0)
  return now
}

// Giờ bắt đầu mặc định cho hoạt động mới, dựa vào hoạt động cuối cùng trong danh sách:
// - Hoạt động cuối đã kết thúc: lấy giờ kết thúc của nó
// - Hoạt động cuối chưa kết thúc: lấy giờ hiện tại (khi lưu sẽ kết thúc hoạt động cuối bằng giờ này)
// - Chưa có hoạt động nào: giờ hiện tại (hôm nay) hoặc 7:00 (ngày khác)
function defaultStart(day: Date, last: BabyEntry | null): Date {
  if (last) return last.end ?? nowToMinute()
  if (sameDay(day, new Date())) return nowToMinute()
  const d = new Date(day)
  d.setHours(7, 0, 0, 0)
  return d
}

function EntrySheet({ sheet, day, entries, onClose }: { sheet: Sheet; day: Date; entries: BabyEntry[]; onClose: () => void }) {
  const { actor } = useBaby()
  const isNew = sheet.mode === 'new'
  const look = isNew ? sheet.card : sheet.entry
  // Hoạt động cuối cùng trong danh sách; nếu nó chưa kết thúc thì khi lưu hoạt động mới sẽ kết thúc nó
  const [last] = useState(() => (isNew ? lastEntry(entries) : null))
  const unfinished = last && !last.end ? last : null
  const initialStart = isNew ? defaultStart(day, last) : sheet.entry.start

  // Ngày của giờ bắt đầu (nối tiếp qua nửa đêm thì là ngày hôm sau)
  const [baseDay] = useState(() => startOfDay(initialStart))
  const initialMinutes = isNew ? sheet.card.defaultMinutes : sheet.entry.minutes
  const [startText, setStartText] = useState(() => toTimeInput(initialStart))
  // Đã hoàn thành: mới nhập số phút / kết thúc. Thêm mới thì mặc định là chưa hoàn thành (đang diễn ra / sắp bắt đầu)
  const [completed, setCompleted] = useState(!isNew && sheet.entry.end !== null)
  const [minutesText, setMinutesText] = useState(initialMinutes === null ? '' : String(initialMinutes))
  const [endText, setEndText] = useState(() => (initialMinutes === null ? '' : toTimeInput(addMinutes(initialStart, initialMinutes))))
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const start = fromTimeInput(baseDay, startText)
  const minutes = Number(minutesText) || 0
  const end = start && minutes > 0 ? addMinutes(start, minutes) : null

  // Bấm "Đã hoàn thành": nếu chưa có số phút thì điền sẵn
  // (sửa hoạt động đang diễn ra: kết thúc = bây giờ; còn lại: thời gian mặc định của thẻ, hoặc 30 phút)
  function toggleCompleted() {
    const next = !completed
    setCompleted(next)
    if (!next || minutes > 0 || !start) return
    const now = nowToMinute()
    const m = !isNew && now > start ? Math.round((now.getTime() - start.getTime()) / 60000) : isNew ? sheet.card.defaultMinutes : 30
    setMinutesText(String(m))
    setEndText(toTimeInput(addMinutes(start, m)))
  }

  // 3 ô luôn khớp nhau: kết thúc = bắt đầu + số phút
  // - Sửa giờ bắt đầu: giữ số phút, giờ kết thúc dời theo
  function changeStart(text: string) {
    setStartText(text)
    const s = fromTimeInput(baseDay, text)
    if (s && minutes > 0) setEndText(toTimeInput(addMinutes(s, minutes)))
  }
  // - Sửa số phút (gõ hoặc bấm ▲▼): giờ kết thúc tự tính lại
  function changeMinutes(clean: string) {
    setMinutesText(clean)
    const m = Number(clean)
    if (start && m > 0) setEndText(toTimeInput(addMinutes(start, m)))
  }
  // - Sửa giờ kết thúc: số phút tự tính lại; kết thúc trước giờ bắt đầu thì hiểu là sang hôm sau
  function changeEnd(text: string) {
    setEndText(text)
    const e = fromTimeInput(baseDay, text)
    if (!start || !e) return
    let diff = Math.round((e.getTime() - start.getTime()) / 60000)
    if (diff < 0) diff += 24 * 60
    setMinutesText(String(diff))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (!start) return setError('Vui lòng chọn giờ bắt đầu.')
    if (completed && (minutes < 1 || minutes > MAX_MINUTES)) return setError('Thời gian phải từ 1 phút đến 24 giờ.')
    if (unfinished && start <= unfinished.start) {
      return setError(`Giờ bắt đầu phải sau ${formatTime(unfinished.start)} (lúc bắt đầu "${unfinished.name}").`)
    }
    setSaving(true)
    try {
      const card = isNew ? sheet.card : { id: sheet.entry.cardId, name: sheet.entry.name, icon: sheet.entry.icon, color: sheet.entry.color }
      const input = { card, start, minutes: completed ? minutes : null }
      if (isNew) await createEntry(input, actor, unfinished)
      else await updateEntry(sheet.entry.id, input)
      onClose()
    } catch (err) {
      console.error(err)
      setError('Lưu thất bại. Vui lòng thử lại.')
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (sheet.mode !== 'edit') return
    setDeleting(true)
    try {
      await deleteEntry(sheet.entry.id)
      onClose()
    } catch (err) {
      console.error(err)
      setError('Xoá thất bại. Vui lòng thử lại.')
      setDeleting(false)
    }
  }

  return (
    <>
      <GlassPanel className="space-y-3 !p-4">
        <form id={FORM_ID} onSubmit={handleSubmit} className="space-y-3" noValidate>
          <div className="flex h-10 items-center gap-3">
            <CardIcon icon={look.icon} color={look.color} box="h-10 w-10" img="h-7 w-7" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm leading-5 font-semibold">{look.name}</span>
              <span className="block truncate text-xs leading-4 text-white/60">{isNew ? 'Thêm hoạt động' : 'Sửa hoạt động'}</span>
            </span>
            <div className="w-16 shrink-0">
              <Button type="button" variant="secondary" className="!h-10" onClick={onClose}>
                Đóng
              </Button>
            </div>
          </div>

          {/* Bắt đầu, số phút, kết thúc: 3 ô bằng nhau, sửa ô nào thì ô còn lại tự cập nhật.
              Chưa hoàn thành thì khoá ô số phút / kết thúc (không cần nhập) */}
          <div className="grid grid-cols-3 gap-2">
            <TextField id="start" label="Bắt đầu" type="time" className={TIME_FIELD} value={startText} onChange={(e) => changeStart(e.target.value)} />
            <MinutesField
              id="minutes"
              label="Số phút"
              disabled={!completed}
              placeholder="--"
              className="!pl-2.5"
              value={completed ? minutesText : ''}
              onChange={changeMinutes}
            />
            <TextField
              id="end"
              label="Kết thúc"
              type={completed ? 'time' : 'text'}
              disabled={!completed}
              placeholder="--:--"
              className={`${TIME_FIELD} ${LOCKED}`}
              value={completed ? endText : ''}
              onChange={(e) => changeEnd(e.target.value)}
            />
          </div>

          {error && <Alert type="error">{error}</Alert>}
          {confirmDelete && <Alert type="error">Bấm thùng rác lần nữa để xoá hoạt động này</Alert>}

          {/* Ô check "Đã hoàn thành" + thời lượng; bên phải chừa chỗ cho nút nổi */}
          <div className="flex h-12 items-center pr-36">
            <button
              type="button"
              role="checkbox"
              aria-checked={completed}
              onClick={toggleCompleted}
              className="flex min-w-0 items-center gap-2.5 text-left"
            >
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 transition ${
                  completed ? 'border-emerald-300 bg-emerald-400' : 'border-white/50 bg-white/5'
                }`}
              >
                {completed && (
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="#ffffff" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M5 12.5l4.5 4.5L19 7" />
                  </svg>
                )}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm leading-5 font-semibold">Đã hoàn thành</span>
                <span className="block truncate text-xs leading-4 text-white/60">
                  {!completed
                    ? start && start > new Date()
                      ? 'Sắp bắt đầu'
                      : 'Đang diễn ra'
                    : end
                      ? `${formatDuration(minutes)}${sameDay(end, baseDay) ? '' : ', hết lúc hôm sau'}`
                      : 'Nhập số phút hoặc giờ kết thúc'}
                </span>
              </span>
            </button>
          </div>
          {/* Thêm khi hoạt động trước chưa kết thúc: báo trước sẽ tự kết thúc nó */}
          {unfinished && (
            <p className="truncate text-xs leading-4 text-amber-100">
              "{unfinished.name}" sẽ kết thúc lúc {start ? formatTime(start) : '--:--'}
            </p>
          )}
        </form>
      </GlassPanel>

      <SaveDeleteFabs
        formId={FORM_ID}
        canDelete={!isNew}
        confirming={confirmDelete}
        saving={saving}
        deleting={deleting}
        saveLabel={isNew ? 'Thêm vào time line' : 'Lưu thay đổi'}
        deleteLabel="Xoá hoạt động"
        onAskDelete={() => setConfirmDelete(true)}
        onCancelDelete={() => setConfirmDelete(false)}
        onDelete={handleDelete}
      />
    </>
  )
}

function TimelineRowsSkeleton() {
  return (
    <div className="divide-y divide-white/10">
      {Array.from({ length: SKELETON_ROWS }, (_, i) => (
        <div key={i} className={`${SIZE.row} flex items-center gap-3 px-4`}>
          <div className="w-12 space-y-1">
            <Skeleton className="ml-auto h-4 w-10 rounded-md" />
            <Skeleton className="ml-auto h-3 w-8 rounded-md" />
          </div>
          <Skeleton className="h-10 w-10 rounded-[22%]" />
          <div className="flex-1 space-y-1">
            <Skeleton className="h-4 w-24 rounded-md" />
            <Skeleton className="h-3 w-32 rounded-md" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function TimelinePageSkeleton() {
  return (
    <PageShell>
      <AppHeaderSkeleton />
      <DayBarSkeleton />
      <ScrollArea className={`${TABLE_CLASS} !overflow-hidden`}>
        <TimelineRowsSkeleton />
      </ScrollArea>
      <GlassPanel className={TRAY_CLASS}>
        <PagedRowSkeleton
          itemWidth={TRAY_ITEM_WIDTH}
          renderItem={() => (
            <div className="flex flex-col items-center gap-1">
              <Skeleton className="h-12 w-12 rounded-[22%]" />
              <Skeleton className="h-4 w-12 rounded-md" />
            </div>
          )}
        />
      </GlassPanel>
    </PageShell>
  )
}
