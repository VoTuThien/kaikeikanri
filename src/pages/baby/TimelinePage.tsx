import { useEffect, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { AppHeader, AppHeaderSkeleton } from '../../components/AppHeader'
import { PageShell } from '../../components/PageShell'
import { Alert } from '../../components/ui/Alert'
import { Button } from '../../components/ui/Button'
import { Fab, FabGroup, FabSkeleton, raisedAbove, SaveDeleteFabs } from '../../components/ui/Fab'
import { GlassPanel } from '../../components/ui/GlassPanel'
import { MinutesField } from '../../components/ui/MinutesField'
import { PagedRow, PagedRowSkeleton } from '../../components/ui/PagedRow'
import { Skeleton } from '../../components/ui/Skeleton'
import { TimeField } from '../../components/ui/TimeField'
import { SIZE } from '../../components/ui/sizes'
import { CardIcon, ChildPicker, ChildPickerSkeleton, DayBar, DayBarSkeleton } from './components'
import { babyNoticeId, markBabySeen, useNotices } from '../../lib/notifications'
import {
  applyHistory,
  closeStaleEntries,
  createEntry,
  deleteEntry,
  HistoryConflict,
  historyScope,
  updateEntry,
  type EntryTiming,
  type TimelineNotice,
} from './data/api'
import { useHistory } from './data/history'
import { useBaby, useDayEntries } from './data/BabyContext'
import { TimelineView, TimelineViewSkeleton } from './TimelineView'
import { submitForm, useChanged, useUnsavedChanges } from '../../components/UnsavedGuard'
import {
  addMinutes,
  formatDuration,
  formatTime,
  fromTimeInput,
  lastEntry,
  MAX_MINUTES,
  nextMidnight,
  sameDay,
  startOfDay,
  toTimeInput,
  type BabyCard,
  type BabyEntry,
  type Child,
} from './data/types'

// Thông báo cho các thành viên khác khi time line của con đang xem được cập nhật (mỗi con 1 thông báo, ghi đè)
const timelineNotice = (child: Child | null, by: { uid: string; name: string }, detail: string): TimelineNotice => ({
  child: child ? { id: child.id, name: child.nickname || child.name } : null,
  by,
  detail,
})

const TRAY_CLASS = `${SIZE.tray} !p-0`
const TRAY_PX = 96 // = SIZE.tray (h-24): 2 nút Hoàn tác / Làm lại nằm ngay trên khay
// Bề rộng 1 thẻ trong khay (icon + tên tối đa 3 dòng)
const TRAY_ITEM_WIDTH = 64
const FORM_ID = 'baby-entry-form'
// Khung nhập đang mở: thêm từ 1 thẻ, hoặc sửa 1 hoạt động đã có.
// overlap: thêm bằng nút NHÂN BẢN của 1 hoạt động -> cùng giờ với hoạt động đó và được chồng thời gian lên nó (không đẩy hoạt động liền kề)
type Sheet = { mode: 'new'; card: BabyCard; overlap?: BabyEntry } | { mode: 'edit'; entry: BabyEntry }

export function TimelinePage() {
  const { loading } = useBaby()
  const [day, setDay] = useState(() => startOfDay(new Date()))
  const entries = useDayEntries(day)
  // Mở màn hình (hoặc mở lại app từ nền): hoạt động dở dang của các ngày trước tự kết thúc lúc 24:00 ngày đó
  useEffect(() => {
    const close = () => closeStaleEntries().catch((err) => console.error(err))
    const onVisible = () => document.visibilityState === 'visible' && close()
    close()
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])
  if (loading) return <TimelinePageSkeleton />
  return <Timeline day={day} setDay={setDay} entries={entries} />
}

function Timeline({ day, setDay, entries }: { day: Date; setDay: (d: Date) => void; entries: BabyEntry[] | null }) {
  const { cards, child, children, selectChild, actor } = useBaby()
  const [params, setParams] = useSearchParams()
  const notices = useNotices()
  const [sheet, setSheet] = useState<Sheet | null>(null)
  // Đã bấm nút nhân bản của 1 hoạt động: chọn thẻ ở khay để thêm hoạt động chồng lên thời gian của nó
  const [copyOf, setCopyOf] = useState<BabyEntry | null>(null)
  const [error, setError] = useState('')
  // Đổi con thì đóng khung nhập đang mở (khung đó thuộc con cũ)
  const childId = child?.id
  useEffect(() => {
    setSheet(null)
    setCopyOf(null)
  }, [childId])

  // Mở từ thông báo (/baby/timeline?child=id): chọn đúng con đó rồi bỏ tham số trên URL
  const wanted = params.get('child')
  useEffect(() => {
    if (!wanted) return
    if (children.some((c) => c.id === wanted)) selectChild(wanted)
    setParams({}, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wanted, children.length])

  // Đang xem time line của con này: thông báo cập nhật time line của con đó thành "Đã xem"
  const unseen = notices.list.some((n) => n.kind === 'baby' && n.id === babyNoticeId(childId ?? null) && !n.seen)
  useEffect(() => {
    if (unseen && !wanted) markBabySeen(childId ?? null, actor.uid).catch((err) => console.error(err))
  }, [unseen, childId, wanted, actor.uid])

  function changeDay(next: Date) {
    setSheet(null)
    setCopyOf(null)
    setDay(next)
  }

  // Kéo thẻ (nhấn giữ rồi kéo): dời cả thẻ (giữ số phút), không đẩy các hoạt động khác (được phép chồng thời gian)
  function move(entry: BabyEntry, start: Date) {
    const minutes = entry.minutes
    setError('')
    if (sheet?.mode === 'edit' && sheet.entry.id === entry.id) setSheet(null)
    const card = { id: entry.cardId, name: entry.name, icon: entry.icon, color: entry.color }
    updateEntry(
      entry.id,
      { childId: entry.childId ?? child?.id ?? null, card, start, minutes },
      actor,
      [],
      timelineNotice(child, actor, `Dời ${entry.name} sang ${formatTime(start)}`),
    ).catch((err) => {
      console.error(err)
      setError('Lưu giờ mới thất bại. Vui lòng thử lại.')
    })
  }

  const editingId = sheet?.mode === 'edit' ? sheet.entry.id : null

  // Hoàn tác / Làm lại thao tác gần nhất trên time line (thêm, sửa, xoá, kéo...), xem data/history.ts
  const history = useHistory(historyScope())
  const [busy, setBusy] = useState<'undo' | 'redo' | null>(null)
  async function runHistory(kind: 'undo' | 'redo') {
    setError('')
    if (!navigator.onLine) return setError('Cần có mạng để hoàn tác / làm lại.')
    setBusy(kind)
    try {
      await applyHistory(kind, actor)
    } catch (err) {
      console.error(err)
      setError(err instanceof HistoryConflict ? err.message : 'Hoàn tác / làm lại thất bại. Vui lòng thử lại.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <PageShell>
      <AppHeader title="Time line" backTo="/baby" right={<ChildPicker />} />

      <DayBar day={day} onChange={changeDay} />
      {error && <Alert type="error">{error}</Alert>}

      {/* Trục thời gian của ngày: thẻ cao theo số phút, được phép chồng nhau */}
      {entries === null ? (
        <TimelineViewSkeleton />
      ) : (
        <TimelineView
          key={`${day.getTime()}-${childId ?? ''}`}
          day={day}
          entries={entries}
          editingId={editingId}
          onEdit={(entry) => {
            setCopyOf(null)
            setSheet({ mode: 'edit', entry })
          }}
          onCopy={(entry) => {
            setSheet(null)
            setCopyOf(entry)
          }}
          onMove={move}
        />
      )}

      {/* Đang nhân bản: nhắc chọn thẻ ở khay bên dưới */}
      {!sheet && copyOf && (
        <GlassPanel className="flex h-12 items-center gap-3 !px-3 !py-0">
          <span className="min-w-0 flex-1 truncate text-xs leading-4 text-white/80">
            Chọn hoạt động chồng lên <span className="font-semibold text-white">"{copyOf.name}"</span> ({formatTime(copyOf.start)}–
            {copyOf.end ? formatTime(copyOf.end) : '...'})
          </span>
          <div className="w-16 shrink-0">
            <Button type="button" variant="secondary" className="!h-9" onClick={() => setCopyOf(null)}>
              Huỷ
            </Button>
          </div>
        </GlassPanel>
      )}

      {sheet ? (
        <EntrySheet
          key={sheet.mode === 'new' ? `new-${sheet.card.id}-${sheet.overlap?.id ?? ''}` : sheet.entry.id}
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
                onClick={() => {
                  setSheet({ mode: 'new', card: c, overlap: copyOf ?? undefined })
                  setCopyOf(null)
                }}
                className="flex w-full flex-col items-center gap-1 transition active:scale-95"
              >
                <CardIcon icon={c.icon} color={c.color} />
                <span className="line-clamp-3 w-full text-center text-[10px] leading-3 font-medium">{c.name}</span>
              </button>
            )}
          />
        </GlassPanel>
      )}

      {/* Hoàn tác / Làm lại: nổi ngay trên khay thẻ (không che khay); ẩn khi đang mở khung nhập / đang nhân bản */}
      {!sheet && !copyOf && (
        <FabGroup bottom={raisedAbove(TRAY_PX)}>
          <Fab
            type="button"
            variant="secondary"
            icon="undo"
            label={history.undo ? `Hoàn tác: ${history.undo.label}` : 'Không có thao tác để hoàn tác'}
            disabled={!history.undo || busy !== null}
            loading={busy === 'undo'}
            className="disabled:!opacity-35"
            onClick={() => runHistory('undo')}
          />
          <Fab
            type="button"
            variant="secondary"
            icon="redo"
            label={history.redo ? `Làm lại: ${history.redo.label}` : 'Không có thao tác để làm lại'}
            disabled={!history.redo || busy !== null}
            loading={busy === 'redo'}
            className="disabled:!opacity-35"
            onClick={() => runHistory('redo')}
          />
        </FabGroup>
      )}
    </PageShell>
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

const minutesBetween = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / 60000)

// Sửa 1 hoạt động thì các hoạt động liền kề đổi theo để time line nối liền, không chồng lên nhau:
// - Đổi giờ bắt đầu: hoạt động liền TRƯỚC kết thúc đúng bằng giờ bắt đầu mới
// - Đổi giờ kết thúc: hoạt động liền SAU bắt đầu đúng bằng giờ kết thúc mới (giữ nguyên giờ kết thúc của nó)
function linkNeighbors(
  entry: BabyEntry,
  start: Date,
  end: Date | null,
  prev: BabyEntry | null,
  next: BabyEntry | null,
): { linked: EntryTiming[]; notes: string[]; error: string; minutes?: number | null } {
  const linked: EntryTiming[] = []
  const notes: string[] = []
  if (prev && start.getTime() !== entry.start.getTime() && start.getTime() !== prev.end?.getTime()) {
    const m = minutesBetween(prev.start, start)
    if (m < 1 || m > MAX_MINUTES) {
      return { linked, notes, error: `Giờ bắt đầu phải sau ${formatTime(prev.start)} (lúc bắt đầu "${prev.name}").` }
    }
    linked.push({ id: prev.id, start: prev.start, minutes: m })
    notes.push(`"${prev.name}" kết thúc lúc ${formatTime(start)}`)
  }
  if (next && end && end.getTime() !== entry.end?.getTime() && end.getTime() !== next.start.getTime()) {
    const m = next.end ? minutesBetween(end, next.end) : null
    if (next.end && (m === null || m < 1)) {
      return { linked, notes, error: `Giờ kết thúc phải trước ${formatTime(next.end)} (lúc kết thúc "${next.name}").` }
    }
    linked.push({ id: next.id, start: end, minutes: m })
    notes.push(`"${next.name}" bắt đầu lúc ${formatTime(end)}`)
  }
  // Chưa hoàn thành (không có giờ kết thúc) thì không được dời qua hoạt động liền sau
  if (next && !end && start >= next.start) {
    return { linked, notes, error: `Giờ bắt đầu phải trước ${formatTime(next.start)} (lúc bắt đầu "${next.name}").` }
  }
  return { linked, notes, error: '' }
}

// Thêm hoạt động mới ở vị trí bất kỳ theo giờ bắt đầu (cuối danh sách hoặc chèn vào giữa), time line luôn nối liền:
// - Hoạt động liền TRƯỚC (bắt đầu trước giờ mới) kết thúc đúng bằng giờ bắt đầu mới; không có thì chèn lên đầu
// - Hoạt động liền SAU (bắt đầu từ giờ mới trở đi) bắt đầu đúng bằng giờ kết thúc mới (giữ nguyên giờ kết thúc của nó)
// - Chèn vào giữa mà chưa hoàn thành (không nhập kết thúc) thì tự kết thúc lúc hoạt động liền sau bắt đầu
// - Hoạt động mới LỌT HẲN vào trong hoạt động liền trước (kết thúc trước lúc nó kết thúc): TÁCH hoạt động đó làm 2 —
//   phần đầu kết thúc lúc hoạt động mới bắt đầu, phần sau (`split`, cùng thẻ) bắt đầu lúc hoạt động mới kết thúc và giữ giờ kết thúc cũ;
//   hoạt động liền sau giữ nguyên. Vd chơi 7:00–9:00, ngủ 9:00–…; chèn bú 8:00–8:30 -> chơi 7:00–8:00, bú, chơi 8:30–9:00, ngủ 9:00–…
function linkInsert(
  entries: BabyEntry[],
  start: Date,
  end: Date | null,
): { linked: EntryTiming[]; notes: string[]; error: string; minutes: number | null; split?: { of: BabyEntry; start: Date; minutes: number } } {
  const linked: EntryTiming[] = []
  const notes: string[] = []
  const sorted = [...entries].sort((a, b) => a.start.getTime() - b.start.getTime())
  const prev = sorted.filter((e) => e.start < start).pop() ?? null
  const [next = null, afterNext = null] = sorted.filter((e) => e.start >= start)
  const fail = (error: string) => ({ linked, notes, error, minutes: null })

  if (prev?.end && end && end < prev.end) {
    linked.push({ id: prev.id, start: prev.start, minutes: minutesBetween(prev.start, start) })
    notes.push(`Tách "${prev.name}": ${formatTime(prev.start)}–${formatTime(start)} và ${formatTime(end)}–${formatTime(prev.end)}`)
    return { linked, notes, error: '', minutes: minutesBetween(start, end), split: { of: prev, start: end, minutes: minutesBetween(end, prev.end) } }
  }

  let finish = end
  if (next && !finish) {
    if (minutesBetween(start, next.start) < 1) {
      return fail(`Giờ bắt đầu phải trước ${formatTime(next.start)} (lúc bắt đầu "${next.name}"), hoặc nhập giờ kết thúc.`)
    }
    finish = next.start
    notes.push(`Kết thúc lúc ${formatTime(finish)} (nối "${next.name}")`)
  }
  if (prev && start.getTime() !== prev.end?.getTime()) {
    const m = minutesBetween(prev.start, start)
    if (m > MAX_MINUTES) return fail(`"${prev.name}" sẽ dài quá 24 giờ. Vui lòng chọn giờ bắt đầu khác.`)
    linked.push({ id: prev.id, start: prev.start, minutes: m })
    notes.push(`"${prev.name}" kết thúc lúc ${formatTime(start)}`)
  }
  if (next && finish && finish.getTime() !== next.start.getTime()) {
    // Không được trùm hết hoạt động liền sau
    const limit = next.end ?? afterNext?.start ?? null
    if (limit && finish >= limit) {
      const what = next.end ? `lúc kết thúc "${next.name}"` : `lúc bắt đầu "${afterNext!.name}"`
      return fail(`Giờ kết thúc phải trước ${formatTime(limit)} (${what}).`)
    }
    linked.push({ id: next.id, start: finish, minutes: next.end ? minutesBetween(finish, next.end) : null })
    notes.push(`"${next.name}" bắt đầu lúc ${formatTime(finish)}`)
  }
  return { linked, notes, error: '', minutes: finish ? minutesBetween(start, finish) : null }
}

function EntrySheet({ sheet, day, entries, onClose }: { sheet: Sheet; day: Date; entries: BabyEntry[]; onClose: () => void }) {
  const { actor, child } = useBaby()
  const isNew = sheet.mode === 'new'
  // Nhân bản: hoạt động mới cùng giờ với hoạt động này, chồng thời gian lên nó
  const overlap = sheet.mode === 'new' ? (sheet.overlap ?? null) : null
  const look = isNew ? sheet.card : sheet.entry
  // Hoạt động cuối cùng trong danh sách: giờ bắt đầu mặc định nối tiếp nó (đổi giờ bắt đầu để chèn vào giữa)
  const [last] = useState(() => (isNew ? lastEntry(entries) : null))
  // Sửa: hoạt động liền trước / liền sau trong ngày (danh sách đã xếp theo giờ bắt đầu)
  const [neighbors] = useState(() => {
    const i = isNew ? -1 : entries.findIndex((e) => e.id === sheet.entry.id)
    return i < 0 ? { prev: null, next: null } : { prev: entries[i - 1] ?? null, next: entries[i + 1] ?? null }
  })
  const initialStart = overlap ? overlap.start : isNew ? defaultStart(day, last) : sheet.entry.start

  // Ngày của giờ bắt đầu (nối tiếp qua nửa đêm thì là ngày hôm sau)
  const [baseDay] = useState(() => startOfDay(initialStart))
  const initialMinutes = overlap?.minutes ?? (isNew ? sheet.card.defaultMinutes : sheet.entry.minutes)
  const [startText, setStartText] = useState(() => toTimeInput(initialStart))
  // Đã hoàn thành: mới nhập số phút / kết thúc. Thêm mới thì mặc định là chưa hoàn thành (đang diễn ra / sắp bắt đầu);
  // nhân bản thì giống hoạt động gốc
  const [completed, setCompleted] = useState(overlap ? overlap.end !== null : !isNew && sheet.entry.end !== null)
  const [minutesText, setMinutesText] = useState(initialMinutes === null ? '' : String(initialMinutes))
  const [endText, setEndText] = useState(() => (initialMinutes === null ? '' : toTimeInput(addMinutes(initialStart, initialMinutes))))
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  // Chưa lưu: hoạt động mới đang nhập (chưa thêm vào time line), hoặc đã sửa giờ / số phút của hoạt động cũ.
  // Chấm đỏ trên nút lưu, rời màn hình thì hỏi lại (UnsavedGuard)
  const changed = useChanged({ startText, completed, minutesText, endText })
  const dirty = isNew || changed
  useUnsavedChanges(dirty && !saving && !deleting, () => submitForm(FORM_ID))

  const start = fromTimeInput(baseDay, startText)
  const minutes = Number(minutesText) || 0
  const end = start && minutes > 0 ? addMinutes(start, minutes) : null
  const link = !start
    ? null
    : overlap
      ? // Nhân bản: được chồng thời gian, không đẩy các hoạt động liền kề
        { linked: [], notes: [`Chồng lên "${overlap.name}"`], error: '', minutes: null }
      : isNew
      ? linkInsert(entries, start, completed ? end : null)
      : linkNeighbors(sheet.entry, start, completed ? end : null, neighbors.prev, neighbors.next)

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
    if (link?.error) return setError(link.error)
    // Chèn vào giữa mà chưa hoàn thành: tự kết thúc lúc hoạt động liền sau bắt đầu
    const saveMinutes: number | null = completed ? minutes : isNew ? (link?.minutes ?? null) : null
    if (saveMinutes !== null && saveMinutes > MAX_MINUTES) return setError('Thời gian phải từ 1 phút đến 24 giờ.')
    setSaving(true)
    try {
      const card = isNew ? sheet.card : { id: sheet.entry.cardId, name: sheet.entry.name, icon: sheet.entry.icon, color: sheet.entry.color }
      // Hoạt động thuộc con đang chọn; sửa hoạt động cũ chưa gắn con thì gắn luôn vào con đang chọn
      const input = { childId: isNew ? (child?.id ?? null) : (sheet.entry.childId ?? child?.id ?? null), card, start, minutes: saveMinutes }
      // Chèn lọt hẳn vào 1 hoạt động: phần sau của hoạt động đó thành 1 hoạt động mới (cùng thẻ, cùng con)
      const split = (link as { split?: { of: BabyEntry; start: Date; minutes: number } } | null)?.split
      const extra = split
        ? [
            {
              childId: split.of.childId ?? input.childId,
              card: { id: split.of.cardId, name: split.of.name, icon: split.of.icon, color: split.of.color },
              start: split.start,
              minutes: split.minutes,
            },
          ]
        : []
      if (isNew) await createEntry(input, actor, link?.linked, timelineNotice(child, actor, `Thêm ${card.name} lúc ${formatTime(start)}`), extra)
      else await updateEntry(sheet.entry.id, input, actor, link?.linked, timelineNotice(child, actor, `Sửa ${card.name} lúc ${formatTime(start)}`))
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
      await deleteEntry(sheet.entry.id, timelineNotice(child, actor, `Xoá ${sheet.entry.name} lúc ${formatTime(sheet.entry.start)}`))
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
              <span className="block truncate text-xs leading-4 text-white/60">{overlap ? `Thêm chồng lên "${overlap.name}"` : isNew ? 'Thêm hoạt động' : 'Sửa hoạt động'}</span>
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
            {/* Ô giờ dùng chung TimeField: chạm mở vòng tròn chọn giờ (vòng trong) / phút (vòng ngoài) */}
            <TimeField id="start" label="Bắt đầu" value={startText} onChange={changeStart} />
            <MinutesField
              id="minutes"
              label="Số phút"
              disabled={!completed}
              placeholder="--"
              className="!pl-2.5"
              value={completed ? minutesText : ''}
              onChange={changeMinutes}
            />
            <TimeField id="end" label="Kết thúc" disabled={!completed} value={completed ? endText : ''} onChange={changeEnd} />
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
                      ? `${formatDuration(minutes)}${end <= nextMidnight(baseDay) ? '' : ', tách 1 thẻ sang hôm sau'}`
                      : 'Nhập số phút hoặc giờ kết thúc'}
                </span>
              </span>
            </button>
          </div>
          {/* Thêm / chèn vào giữa / sửa giờ: báo trước các hoạt động liền kề sẽ đổi theo cho nối liền */}
          {link && link.notes.length > 0 && <p className="line-clamp-2 text-xs leading-4 text-amber-100">{link.notes.join(' · ')}</p>}
        </form>
      </GlassPanel>

      <SaveDeleteFabs
        dirty={dirty}
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

export function TimelinePageSkeleton() {
  return (
    <PageShell>
      <AppHeaderSkeleton right={<ChildPickerSkeleton />} />
      <DayBarSkeleton />
      <TimelineViewSkeleton />
      <GlassPanel className={TRAY_CLASS}>
        <PagedRowSkeleton
          itemWidth={TRAY_ITEM_WIDTH}
          renderItem={() => (
            <div className="flex flex-col items-center gap-1">
              <Skeleton className="h-12 w-12 rounded-none" />
              <Skeleton className="h-4 w-12 rounded-md" />
            </div>
          )}
        />
      </GlassPanel>
      <FabSkeleton count={2} bottom={raisedAbove(TRAY_PX)} />
    </PageShell>
  )
}
