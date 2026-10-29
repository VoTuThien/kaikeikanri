import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { AppHeader, AppHeaderSkeleton } from '../../components/AppHeader'
import { PageShell } from '../../components/PageShell'
import { Button } from '../../components/ui/Button'
import { GLASS_CLASS, GlassPanel } from '../../components/ui/GlassPanel'
import { PagedRow, PagedRowSkeleton } from '../../components/ui/PagedRow'
import { Skeleton } from '../../components/ui/Skeleton'
import { SIZE } from '../../components/ui/sizes'
import { PlaceIcon } from './components'
import { setPlaceCell, swapPlaceCells } from './data/api'
import { useStatus } from './data/StatusContext'
import { anchorAt, footprint, planDrop } from './data/layout'
import { placeTypeInfo, sameCell, type Cell } from './data/types'
import type { BoardHandle } from './models/BoardScene'

// Thư viện 3D chỉ tải khi mở màn hình này
const BoardScene = lazy(() => import('./models/BoardScene'))

// Bàn cờ chiếm hết phần chiều cao còn lại của màn hình, không cuộn
const BOARD_CLASS = `${GLASS_CLASS} relative min-h-0 flex-1 !shrink overflow-hidden !p-0`
const INFO_CLASS = `${SIZE.infoBar} flex items-center gap-3 !px-4 !py-0`
const TRAY_CLASS = `${SIZE.tray} !p-0`
// Bề rộng 1 mục trong khay (icon + tên tối đa 3 dòng)
const TRAY_ITEM_WIDTH = 64
// Di chuyển quá khoảng này (px) mới tính là kéo; ít hơn là chạm để chọn
const DRAG_THRESHOLD = 6

interface Drag {
  placeId: string
  from: 'tray' | 'board'
  started: boolean
  startX: number
  startY: number
  x: number
  y: number
  cell: Cell | null // chỗ đang rê tới (ô góc của mô hình), null = ngoài bản đồ
}

export function MiniMapPage() {
  const { loading } = useStatus()
  if (loading) return <MiniMapPageSkeleton />
  return <MiniMap />
}

function MiniMap() {
  const { places } = useStatus()
  const boardRef = useRef<BoardHandle>(null)
  const trayRef = useRef<HTMLDivElement>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [drag, setDragState] = useState<Drag | null>(null)
  // Bản sao để đọc giá trị mới nhất trong sự kiện của window
  const dragRef = useRef<Drag | null>(null)
  const setDrag = (d: Drag | null) => {
    dragRef.current = d
    setDragState(d)
  }

  const onBoard = places.filter((p) => p.cell)
  const inTray = places.filter((p) => !p.cell)
  const selected = places.find((p) => p.id === selectedId && p.cell)
  const dragging = drag?.started ? places.find((p) => p.id === drag.placeId) : undefined
  // Thả ở chỗ đang rê tới thì sẽ: đặt / đổi chỗ / không được (mô hình 2x2 cần đủ 4 ô trống)
  const plan = dragging && drag?.cell ? planDrop(places, dragging, drag.cell) : null

  function beginDrag(placeId: string, from: Drag['from'], x: number, y: number) {
    setDrag({ placeId, from, started: false, startX: x, startY: y, x, y, cell: null })
  }

  // Nghe sự kiện kéo trên toàn trang để ngón tay đi ra ngoài bàn cờ / khay vẫn theo dõi được
  const active = drag !== null
  useEffect(() => {
    if (!active) return

    const overTray = (x: number, y: number) => {
      const r = trayRef.current?.getBoundingClientRect()
      return !!r && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom
    }

    // Vị trí ngón tay -> ô góc của mô hình đang kéo (theo số ô mô hình chiếm)
    const cellAt = (placeId: string, x: number, y: number) => {
      const place = places.find((p) => p.id === placeId)
      const point = boardRef.current?.pick(x, y)
      return place && point ? anchorAt(point, footprint(place.type)) : null
    }

    const onMove = (e: PointerEvent) => {
      const d = dragRef.current
      if (!d) return
      const started = d.started || Math.hypot(e.clientX - d.startX, e.clientY - d.startY) > DRAG_THRESHOLD
      setDrag({ ...d, started, x: e.clientX, y: e.clientY, cell: started ? cellAt(d.placeId, e.clientX, e.clientY) : null })
    }

    const onUp = (e: PointerEvent) => {
      const d = dragRef.current
      setDrag(null)
      if (!d) return
      if (!d.started) {
        // Chạm (không kéo): chọn mô hình trên bàn cờ để xem thông tin
        if (d.from === 'board') setSelectedId(d.placeId)
        return
      }
      const moving = places.find((p) => p.id === d.placeId)
      if (!moving) return
      const target = cellAt(moving.id, e.clientX, e.clientY)
      if (target) {
        if (sameCell(moving.cell, target)) return
        const result = planDrop(places, moving, target)
        if (result.kind === 'blocked') return // không đủ chỗ: giữ nguyên như cũ
        // Vướng 1 mô hình thì đổi chỗ (mô hình kia về chỗ cũ, hoặc về khay nếu kéo từ khay lên)
        const save =
          result.kind === 'swap'
            ? swapPlaceCells({ id: moving.id, cell: target }, { id: result.other.id, cell: result.otherCell })
            : setPlaceCell(moving.id, target)
        save.catch((err) => console.error('Lưu vị trí thất bại', err))
        setSelectedId(moving.id)
      } else if (d.from === 'board' && overTray(e.clientX, e.clientY)) {
        // Kéo mô hình xuống khay: gỡ khỏi bản đồ
        setPlaceCell(moving.id, null).catch((err) => console.error('Gỡ thất bại', err))
        setSelectedId(null)
      }
    }

    // Trình duyệt giành lại thao tác (vd vuốt ngang khay) thì huỷ kéo
    const onCancel = () => setDrag(null)

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onCancel)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onCancel)
    }
  }, [active, places])

  return (
    <PageShell>
      <AppHeader title="Bản đồ mini" backTo="/status" />

      <div className={BOARD_CLASS}>
        <Suspense fallback={<Skeleton className="h-full w-full rounded-none" />}>
          <BoardScene
            ref={boardRef}
            places={onBoard}
            selectedId={drag?.started ? null : (selected?.id ?? null)}
            preview={dragging ? { placeId: dragging.id, type: dragging.type, cell: drag?.cell ?? null, status: plan?.kind ?? 'place' } : null}
            onModelPointerDown={(id, x, y) => beginDrag(id, 'board', x, y)}
            onEmptyTap={() => setSelectedId(null)}
          />
        </Suspense>
      </div>

      {/* Thanh thông tin: đang kéo / đang chọn / hướng dẫn */}
      <GlassPanel className={INFO_CLASS}>
        {dragging ? (
          <p className="truncate text-sm leading-5 text-white/80">
            {plan
              ? plan.kind === 'blocked'
                ? 'Không đủ chỗ trống ở đây'
                : plan.kind === 'swap'
                  ? plan.otherCell
                    ? `Thả để đổi chỗ với "${plan.other.name}"`
                    : `Thả để đặt vào đây, "${plan.other.name}" sẽ về khay`
                  : `Thả để đặt "${dragging.name}" vào chỗ này`
              : drag?.from === 'board'
                ? 'Thả xuống khay bên dưới để gỡ khỏi bản đồ'
                : 'Kéo lên bản đồ rồi thả vào chỗ muốn đặt'}
          </p>
        ) : selected ? (
          <>
            <PlaceIcon type={selected.type} box="h-10 w-10" img="h-7 w-7" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm leading-5 font-semibold">{selected.name}</span>
              <span className="block truncate text-xs leading-4 text-white/60">{placeTypeInfo(selected.type).label}</span>
            </span>
            <div className="w-20 shrink-0">
              <Button variant="secondary" className="!h-10" onClick={() => setPlaceCell(selected.id, null).then(() => setSelectedId(null))}>
                Gỡ
              </Button>
            </div>
          </>
        ) : (
          <p className="line-clamp-2 text-xs leading-5 text-white/70">
            Kéo địa điểm từ khay lên bản đồ. 1 ngón: xoay. 2 ngón: phóng to, dịch chuyển. Chạm mô hình để xem tên.
          </p>
        )}
      </GlassPanel>

      {/* Khay: các địa điểm chưa đặt lên bản đồ, phân trang (nút tam giác 2 bên) */}
      <GlassPanel className={TRAY_CLASS}>
        <div ref={trayRef} className="h-full">
          <PagedRow
            items={inTray}
            getKey={(p) => p.id}
            itemWidth={TRAY_ITEM_WIDTH}
            empty={
              <p className="text-center text-xs leading-5 text-white/70">
                {places.length === 0 ? (
                  <>
                    Chưa có địa điểm nào.{' '}
                    <Link to="/status/places/new" className="font-semibold text-fuchsia-200 underline">
                      Tạo địa điểm
                    </Link>
                  </>
                ) : drag?.from === 'board' && drag.started ? (
                  'Thả vào đây để gỡ khỏi bản đồ'
                ) : (
                  'Tất cả địa điểm đã nằm trên bản đồ'
                )}
              </p>
            }
            renderItem={(p) => (
              <button
                type="button"
                // Khay không cuộn nên chạm là kéo được ngay
                style={{ touchAction: 'none' }}
                onPointerDown={(e) => beginDrag(p.id, 'tray', e.clientX, e.clientY)}
                className={`flex w-full flex-col items-center gap-1 transition ${drag?.started && drag.placeId === p.id ? 'opacity-40' : ''}`}
              >
                <PlaceIcon type={p.type} />
                <span className="line-clamp-3 w-full text-center text-[10px] leading-3 font-medium">{p.name}</span>
              </button>
            )}
          />
        </div>
      </GlassPanel>

      {/* Icon đi theo ngón tay khi đang kéo ở ngoài bàn cờ */}
      {dragging && !drag?.cell && (
        <div className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-1/2 scale-110" style={{ left: drag!.x, top: drag!.y }}>
          <PlaceIcon type={dragging.type} />
        </div>
      )}
    </PageShell>
  )
}

export function MiniMapPageSkeleton() {
  return (
    <PageShell>
      <AppHeaderSkeleton />
      <Skeleton className={`${BOARD_CLASS} !border-0 !shadow-none`} />
      <GlassPanel className={INFO_CLASS}>
        <Skeleton className="h-4 w-full rounded-md" />
      </GlassPanel>
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
