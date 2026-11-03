import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { ScrollArea } from '../../components/PageShell'
import { LineIcon } from '../../components/ui/Fab'
import { GLASS_CLASS } from '../../components/ui/GlassPanel'
import { Icon3D } from '../../components/ui/Icon3D'
import { Skeleton } from '../../components/ui/Skeleton'
import { LONG_PRESS_CLASS } from '../../components/useLongPress'
import {
  blockBackground,
  blocksAt,
  CARD_PX,
  contentHeight,
  dragTiming,
  GAP_PX,
  LABEL_PX,
  labelLanes,
  layout,
  mixedBackground,
  overlapsOf,
  type Block,
} from './data/timeline'
import { addMinutes, entryState, formatDuration, formatTime, type BabyEntry } from './data/types'

// Time line: các thẻ CAO BẰNG NHAU xếp theo giờ bắt đầu (không có cột giờ); thẻ chồng giờ với thẻ trước thì vẽ đè lên thẻ đó.
// - Chạm thẻ: sửa hoạt động. Chạm vào VÙNG CHỒNG nhau: hiện các tag của những thẻ đang chồng ở phía trên để chọn đúng thẻ cần sửa
// - Nhấn giữ ~0.5 giây rồi kéo: thẻ đi theo ngón tay, thả ở đâu thì giờ bắt đầu theo chỗ đó so với các thẻ khác (dragTiming);
//   giờ sẽ lưu hiện ở bóng giờ trên đầu thẻ. Kéo đè lên thẻ khác = chồng thời gian, kéo ra lại = hết chồng
// - Trượt thẻ sang TRÁI: hiện nút nhân bản -> thêm 1 hoạt động chồng lên thời gian của thẻ đó
// Phần giao nhau giữa các thẻ tô màu trộn của các thẻ đó (data/timeline.ts).

export const TABLE_CLASS = `${GLASS_CLASS} !p-0`
const PAD = 12 // lề trong của bảng
const BUBBLE_PX = 28 // chỗ trống trên cùng cho bóng giờ khi kéo thẻ lên đầu
const LONG_PRESS_MS = 500
const MOVE_TOL = 10 // px: dịch quá chừng này trước khi nhấn giữ đủ lâu thì là cuộn / trượt
const COPY_W = 76 // bề rộng nút nhân bản
const EDGE = 48 // kéo thẻ tới gần mép trên / dưới thì tự cuộn
const EDGE_SPEED = 8
const SKELETON_ROWS = 6
const CARD_RADIUS = 12 // rounded-xl của thẻ

type Mode = 'pending' | 'drag' | 'swipe' | 'scroll' | 'done'
interface Gesture {
  x: number
  y: number
  scroll0: number
  lastY: number
  id: string | null
  mode: Mode
  timer: number
  auto: number // -1 / 0 / 1: đang tự cuộn lên / không / xuống
}

export function TimelineView({
  day,
  entries,
  editingId,
  onEdit,
  onCopy,
  onMove,
}: {
  day: Date
  entries: BabyEntry[]
  editingId: string | null
  onEdit: (entry: BabyEntry) => void
  onCopy: (entry: BabyEntry) => void
  onMove: (entry: BabyEntry, start: Date) => void
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const [now, setNow] = useState(() => new Date())
  const [drag, setDrag] = useState<{ id: string; dy: number } | null>(null)
  // Thẻ đang trượt sang trái (active = ngón tay còn đang kéo) hoặc đang mở nút nhân bản
  const [swipe, setSwipe] = useState<{ id: string; pull: number; active: boolean } | null>(null)
  // Tag các thẻ đang chồng nhau tại chỗ vừa chạm
  const [tags, setTags] = useState<{ y: number; ids: string[] } | null>(null)
  const g = useRef<Gesture | null>(null)
  const autoTimer = useRef(0)

  // Hoạt động đang diễn ra tính tới bây giờ (ảnh hưởng phần chồng nhau): cập nhật mỗi phút
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 60000)
    return () => window.clearInterval(t)
  }, [])

  // Đang kéo / trượt thẻ thì chặn cuộn trang (iOS cần touchmove không passive mới chặn được)
  useEffect(() => {
    const el = contentRef.current
    if (!el) return
    const block = (e: TouchEvent) => {
      const m = g.current?.mode
      if (m === 'drag' || m === 'swipe') e.preventDefault()
    }
    el.addEventListener('touchmove', block, { passive: false })
    return () => el.removeEventListener('touchmove', block)
  }, [entries.length === 0])

  useEffect(
    () => () => {
      window.clearTimeout(g.current?.timer)
      window.clearInterval(autoTimer.current)
    },
    [],
  )

  const byId = new Map(entries.map((e) => [e.id, e]))
  // Các thẻ khác đứng yên trong lúc kéo; thẻ đang kéo đi theo ngón tay
  const placed = layout(entries, now)
  const blocks: Block[] = placed.map((b) => (drag && b.entry.id === drag.id ? { ...b, top: b.top + drag.dy, bottom: b.bottom + drag.dy } : b))
  const draggedBlock = drag ? placed.find((b) => b.entry.id === drag.id) : undefined
  const others = placed.filter((b) => b.entry.id !== drag?.id)
  const preview = draggedBlock && drag ? dragTiming(draggedBlock, others, drag.dy, day, now) : null
  const blockById = new Map(blocks.map((b) => [b.entry.id, b]))
  const overlaps = overlapsOf(blocks)
  const lanes = labelLanes(blocks)
  const pullOf = (id: string) => (swipe?.id === id ? swipe.pull : 0)
  const height = contentHeight(placed) + BUBBLE_PX + PAD

  // ---- Chạm / kéo ----
  function point(clientX: number, clientY: number) {
    const r = contentRef.current!.getBoundingClientRect()
    return { x: clientX - r.left - PAD, y: clientY - r.top - BUBBLE_PX, width: r.width - PAD * 2 }
  }

  // Thẻ dưới ngón tay (để nhấn giữ kéo / trượt): ưu tiên nhãn (icon + tên) của thẻ — nhờ vậy kéo được cả thẻ nằm dưới khi 2 thẻ trùng nhau;
  // còn lại là thẻ bắt đầu muộn nhất trong các thẻ đang có mặt ở đó
  function hit(clientX: number, clientY: number): string | null {
    const { x, y, width } = point(clientX, clientY)
    if (x < 0 || x > width) return null
    for (const b of blocks) {
      const slot = lanes.get(b.entry.id)
      if (!slot) continue
      const left = (slot.lane * width) / slot.lanes
      if (y >= b.top && y < b.top + slot.height && x >= left && x < left + width / slot.lanes) return b.entry.id
    }
    const under = blocksAt(blocks, y).sort((a, b) => a.entry.start.getTime() - b.entry.start.getTime())
    return under.length ? under[under.length - 1].entry.id : null
  }

  function stopAuto() {
    window.clearInterval(autoTimer.current)
    autoTimer.current = 0
  }

  const dragDy = (st: Gesture) => st.lastY - st.y + ((scrollRef.current?.scrollTop ?? 0) - st.scroll0)

  function updateDrag() {
    const st = g.current
    if (!st || st.mode !== 'drag' || !st.id) return
    setDrag({ id: st.id, dy: dragDy(st) })
  }

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    // Đang mở nút nhân bản / tag: chạm ra ngoài thì chỉ đóng lại
    if (swipe || tags) {
      setSwipe(null)
      setTags(null)
      g.current = { x: e.clientX, y: e.clientY, scroll0: 0, lastY: e.clientY, id: null, mode: 'done', timer: 0, auto: 0 }
      return
    }
    const h = hit(e.clientX, e.clientY)
    const st: Gesture = {
      x: e.clientX,
      y: e.clientY,
      scroll0: scrollRef.current?.scrollTop ?? 0,
      lastY: e.clientY,
      id: h,
      mode: 'pending',
      timer: 0,
      auto: 0,
    }
    if (h) {
      // Nhấn giữ đủ lâu (không dịch ngón tay) thì bắt đầu kéo thẻ
      st.timer = window.setTimeout(() => {
        if (g.current !== st || st.mode !== 'pending') return
        st.mode = 'drag'
        navigator.vibrate?.(15)
        setDrag({ id: h, dy: 0 })
      }, LONG_PRESS_MS)
    }
    g.current = st
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    const st = g.current
    if (!st) return
    const dx = e.clientX - st.x
    const dy = e.clientY - st.y
    if (st.mode === 'pending' && Math.hypot(dx, dy) > MOVE_TOL) {
      window.clearTimeout(st.timer)
      st.mode = st.id && dx < 0 && Math.abs(dx) > Math.abs(dy) ? 'swipe' : 'scroll'
    }
    if (st.mode === 'swipe' && st.id) {
      setSwipe({ id: st.id, pull: Math.max(0, Math.min(COPY_W * 1.3, -dx)), active: true })
    } else if (st.mode === 'drag') {
      st.lastY = e.clientY
      updateDrag()
      // Gần mép trên / dưới của bảng thì tự cuộn để kéo được xa hơn
      const r = scrollRef.current?.getBoundingClientRect()
      st.auto = r ? (e.clientY < r.top + EDGE ? -1 : e.clientY > r.bottom - EDGE ? 1 : 0) : 0
      if (st.auto && !autoTimer.current) {
        autoTimer.current = window.setInterval(() => {
          const el = scrollRef.current
          if (!el || !g.current?.auto) return stopAuto()
          el.scrollTop += g.current.auto * EDGE_SPEED
          updateDrag()
        }, 16)
      } else if (!st.auto) stopAuto()
    }
  }

  function onPointerUp(e: PointerEvent<HTMLDivElement>) {
    const st = g.current
    g.current = null
    stopAuto()
    if (!st) return
    window.clearTimeout(st.timer)
    if (st.mode === 'pending') return tap(st, e.clientY)
    if (st.mode === 'swipe' && st.id) {
      const pull = swipe?.id === st.id ? swipe.pull : 0
      return setSwipe(pull >= COPY_W / 2 ? { id: st.id, pull: COPY_W, active: false } : null)
    }
    if (st.mode === 'drag' && st.id) {
      const block = placed.find((b) => b.entry.id === st.id)
      setDrag(null)
      if (!block) return
      const t = dragTiming(block, placed.filter((b) => b.entry.id !== st.id), dragDy(st), day, now)
      if (t.changed) onMove(block.entry, t.start)
    }
  }

  function onPointerCancel() {
    const st = g.current
    g.current = null
    stopAuto()
    if (st) window.clearTimeout(st.timer)
    setDrag(null)
    setSwipe((s) => (s?.active ? null : s))
  }

  // Chạm (không kéo): vùng chỉ có 1 thẻ -> sửa thẻ đó; vùng chồng nhau (kể cả chạm vào nhãn) -> hiện tag để chọn đúng thẻ
  function tap(st: Gesture, clientY: number) {
    if (!st.id) return
    const { y } = point(st.x, clientY)
    const under = blocksAt(blocks, y)
    if (under.length === 1) return onEdit(under[0].entry)
    if (under.length > 1) setTags({ y, ids: under.map((b) => b.entry.id) })
  }

  const swiped = swipe ? blockById.get(swipe.id) : undefined
  const dragged = drag ? blockById.get(drag.id) : undefined

  if (entries.length === 0) {
    return (
      <ScrollArea className={TABLE_CLASS}>
        <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
          <Icon3D emoji="🕒" className="h-12 w-12" />
          <span className="text-sm leading-5 text-white/70">Chưa có hoạt động nào. Chạm một thẻ bên dưới để ghi lại.</span>
        </div>
      </ScrollArea>
    )
  }

  return (
    <ScrollArea ref={scrollRef} className={TABLE_CLASS}>
      {/* Vùng time line: kéo / trượt thẻ không phải vuốt sang màn hình bên cạnh */}
      <div
        ref={contentRef}
        data-no-swipe
        className={`relative touch-pan-y ${LONG_PRESS_CLASS}`}
        style={{ height }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onContextMenu={(e) => e.preventDefault()}
      >
        <div className="absolute" style={{ top: BUBBLE_PX, left: PAD, right: PAD, bottom: PAD }}>
          {/* Nút nhân bản: nằm dưới thẻ, lộ ra khi trượt thẻ sang trái */}
          {swiped && swipe && swipe.pull > 0 && (
            <button
              type="button"
              aria-label={`Thêm hoạt động chồng lên "${swiped.entry.name}"`}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => {
                setSwipe(null)
                onCopy(swiped.entry)
              }}
              className="absolute right-0 z-[25] flex flex-col items-center justify-center gap-0.5 rounded-xl bg-sky-500/90 pl-4 text-[11px] font-semibold"
              style={{ top: swiped.top, height: CARD_PX, width: COPY_W + 16 }}
            >
              <LineIcon icon="copy" className="h-5 w-5" />
              Nhân bản
            </button>
          )}

          {/* Thẻ (cao bằng nhau) */}
          {blocks.map((b) => {
            const id = b.entry.id
            const isDrag = id === drag?.id
            // Thẻ đang trượt nổi lên trên để lộ nút nhân bản bên dưới; thẻ đang kéo nằm trên các thẻ khác nhưng dưới lớp màu trộn để thấy ngay phần chồng nhau
            return (
              <div
                key={id}
                className={`pointer-events-none absolute right-0 left-0 rounded-xl border shadow-md shadow-black/30 ${
                  id === swipe?.id ? 'z-30' : isDrag ? 'z-[5]' : 'z-0'
                } ${isDrag ? 'border-white shadow-xl ring-2 ring-white/70' : editingId === id ? 'border-white ring-2 ring-white' : 'border-white/25'} ${
                  b.open ? 'border-b-2 border-b-white/80' : ''
                } ${(swipe?.id === id && swipe.active) || isDrag ? '' : 'transition-[transform,top] duration-200'}`}
                style={{
                  top: b.top,
                  height: CARD_PX,
                  background: blockBackground(b.entry.color),
                  // Chưa có giờ kết thúc: đuôi thẻ nét đứt
                  borderBottomStyle: b.open ? 'dashed' : undefined,
                  transform: `translateX(${-pullOf(id)}px)`,
                }}
              />
            )
          })}

          {/* Phần chồng nhau: màu trộn của các thẻ (ẩn đi khi 1 trong các thẻ đó đang trượt sang trái) */}
          {overlaps.map((o) => {
            // Mọi thẻ trong vùng cùng bắt đầu / cùng kết thúc ở mép vùng thì bo góc theo thẻ ở mép đó
            const inside = o.ids.map((i) => blockById.get(i)!)
            const r = (edge: boolean) => (edge ? CARD_RADIUS : 0)
            return (
              <div
                key={`${o.top}-${o.ids.join()}`}
                className={`pointer-events-none absolute right-0 left-0 z-10 border-x border-white/25 ${swipe && o.ids.includes(swipe.id) ? 'opacity-0' : ''}`}
                style={{
                  top: o.top,
                  height: o.bottom - o.top,
                  background: mixedBackground(o.ids.map((i) => byId.get(i)!.color)),
                  borderTopLeftRadius: r(inside.every((b) => b.top === o.top)),
                  borderTopRightRadius: r(inside.every((b) => b.top === o.top)),
                  borderBottomLeftRadius: r(inside.every((b) => b.bottom === o.bottom)),
                  borderBottomRightRadius: r(inside.every((b) => b.bottom === o.bottom)),
                }}
              />
            )
          })}

          {/* Nhãn đầu mỗi thẻ: icon, tên, giờ (đủ chỗ thì thêm trạng thái / người ghi) */}
          {blocks.map((b) => {
            const id = b.entry.id
            const slot = lanes.get(id) ?? { lane: 0, lanes: 1, height: LABEL_PX }
            const e = b.entry
            const start = id === drag?.id && preview ? preview.start : e.start
            const end = e.minutes === null ? null : addMinutes(start, e.minutes)
            return (
              <div
                key={id}
                className={`pointer-events-none absolute flex flex-col justify-center px-2 [text-shadow:0_1px_2px_rgba(0,0,0,0.6)] ${
                  id === drag?.id || id === swipe?.id ? 'z-40' : 'z-20'
                } ${(swipe?.id === id && swipe.active) || id === drag?.id ? '' : 'transition-[transform,top] duration-200'}`}
                style={{
                  top: b.top,
                  height: slot.height,
                  left: `${(slot.lane / slot.lanes) * 100}%`,
                  width: `${100 / slot.lanes}%`,
                  transform: `translateX(${-pullOf(id)}px)`,
                }}
              >
                <span className="flex min-w-0 items-center gap-1.5 text-sm leading-5">
                  <Icon3D emoji={e.icon} className="h-5 w-5 shrink-0" />
                  <span className="min-w-0 truncate font-semibold">{e.name}</span>
                  {slot.lanes === 1 && (
                    <span className="ml-auto shrink-0 text-xs font-semibold text-white/90 tabular-nums">
                      {formatTime(start)}–{end ? formatTime(end) : '...'}
                    </span>
                  )}
                </span>
                {slot.height > LABEL_PX &&
                  (slot.lanes === 1 ? (
                    <span className="flex min-w-0 items-center gap-1.5 truncate text-xs leading-4 text-white/85">
                      <StateLabel entry={{ ...e, start, end }} />
                      {e.createdByName && <span className="truncate">· {e.createdByName}</span>}
                    </span>
                  ) : (
                    <span className="truncate text-xs leading-4 font-semibold text-white/90 tabular-nums">
                      {formatTime(start)}–{end ? formatTime(end) : '...'}
                    </span>
                  ))}
              </div>
            )
          })}

          {/* Đang kéo: giờ sẽ lưu hiện trên đầu thẻ */}
          {dragged && preview && (
            <span
              className="pointer-events-none absolute left-1 z-50 -translate-y-full rounded-md bg-white px-1.5 text-xs leading-5 font-bold text-indigo-900 tabular-nums shadow-md"
              style={{ top: dragged.top - 2 }}
            >
              {formatTime(preview.start)}
              {dragged.entry.minutes !== null && `–${formatTime(addMinutes(preview.start, dragged.entry.minutes))}`}
            </span>
          )}

          {/* Tag các thẻ đang chồng nhau tại chỗ vừa chạm (hiện phía trên chỗ chạm): chạm tag để sửa đúng thẻ đó */}
          {tags && (
            <div
              className="absolute right-0 left-0 z-50 flex flex-wrap gap-1.5 rounded-xl border border-white/20 bg-indigo-950/90 p-1.5 shadow-xl shadow-black/40 backdrop-blur-xl"
              style={{
                top: tags.y > 60 ? tags.y - 8 : tags.y + 8,
                transform: tags.y > 60 ? 'translateY(-100%)' : undefined,
              }}
              onPointerDown={(e) => e.stopPropagation()}
            >
              {tags.ids.map((id) => {
                const e = byId.get(id)
                if (!e) return null
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => {
                      setTags(null)
                      onEdit(e)
                    }}
                    className="flex h-9 max-w-full min-w-0 items-center gap-1.5 rounded-lg border border-white/30 px-2 text-xs font-semibold shadow-md transition [text-shadow:0_1px_2px_rgba(0,0,0,0.6)] active:scale-95"
                    style={{ background: blockBackground(e.color) }}
                  >
                    <Icon3D emoji={e.icon} className="h-5 w-5 shrink-0" />
                    <span className="truncate">{e.name}</span>
                    <span className="shrink-0 text-[10px] text-white/90 tabular-nums">
                      {formatTime(e.start)}–{e.end ? formatTime(e.end) : '...'}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </ScrollArea>
  )
}

// Trạng thái của hoạt động: thời lượng nếu đã xong, còn lại là "Đang diễn ra" / "Sắp bắt đầu"
export function StateLabel({ entry }: { entry: BabyEntry }) {
  const state = entryState(entry)
  if (state === 'done') return <span className="shrink-0">{formatDuration(entry.minutes ?? 0)}</span>
  return (
    <span className={`flex shrink-0 items-center gap-1 font-semibold ${state === 'ongoing' ? 'text-emerald-300' : 'text-amber-200'}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${state === 'ongoing' ? 'animate-pulse bg-emerald-300' : 'bg-amber-200'}`} />
      {state === 'ongoing' ? 'Đang diễn ra' : 'Sắp bắt đầu'}
    </span>
  )
}

// Skeleton: cùng khung cuộn, các thẻ cao bằng thẻ thật
export function TimelineViewSkeleton() {
  return (
    <ScrollArea className={`${TABLE_CLASS} !overflow-hidden`}>
      <div className="flex flex-col" style={{ padding: `${BUBBLE_PX}px ${PAD}px ${PAD}px`, gap: GAP_PX }}>
        {Array.from({ length: SKELETON_ROWS }, (_, i) => (
          <div key={i} style={{ height: CARD_PX }}>
            <Skeleton className="h-full w-full" />
          </div>
        ))}
      </div>
    </ScrollArea>
  )
}
