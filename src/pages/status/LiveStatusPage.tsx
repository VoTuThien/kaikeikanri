import { lazy, Suspense } from 'react'
import { AppHeader, AppHeaderSkeleton } from '../../components/AppHeader'
import { PageShell } from '../../components/PageShell'
import { Fab, FabGroup, FabSkeleton } from '../../components/ui/Fab'
import { GLASS_CLASS, GlassPanel } from '../../components/ui/GlassPanel'
import { PagedRow, PagedRowSkeleton } from '../../components/ui/PagedRow'
import { Skeleton } from '../../components/ui/Skeleton'
import { SIZE } from '../../components/ui/sizes'
import { Avatar } from './components'
import { RADIUS_M } from './data/presence'
import { useStatus, type GpsState } from './data/StatusContext'
import type { Presence } from './data/types'

// Thư viện 3D chỉ tải khi mở màn hình này
const StatusScene = lazy(() => import('./models/StatusScene'))

// Bản đồ chiếm hết phần chiều cao còn lại của màn hình, không cuộn
const BOARD_CLASS = `${GLASS_CLASS} relative min-h-0 flex-1 !shrink overflow-hidden !p-0`
const INFO_CLASS = `${SIZE.infoBar} flex items-center gap-3 !px-4 !py-0`
const PEOPLE_CLASS = `${SIZE.tray} !p-0`
// Chừa bên phải dải "Ai đang ở đâu" cho nút nổi (để nút tam giác không bị nút nổi che)
const PEOPLE_ROW = 'pr-[4.75rem]'
// Bề rộng 1 người: đủ hiện tên và tên địa điểm 2 dòng
const PERSON_WIDTH = 64

const time = (d: Date) => d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })

// "từ 08:30" nếu trong hôm nay, "từ 28/10" nếu từ hôm trước
function sinceText(d: Date | null) {
  if (!d) return ''
  const today = new Date().toDateString() === d.toDateString()
  return `từ ${today ? time(d) : d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}`
}

function gpsText(gps: GpsState) {
  switch (gps.kind) {
    case 'idle':
    case 'locating':
      return 'Đang lấy vị trí...'
    case 'ok':
      return gps.nearest && gps.nearest.distance > RADIUS_M
        ? `Cách "${gps.nearest.name}" ${Math.round(gps.nearest.distance)}m · ±${Math.round(gps.accuracy)}m lúc ${time(gps.at)}`
        : `Vị trí ±${Math.round(gps.accuracy)}m, cập nhật lúc ${time(gps.at)}`
    case 'inaccurate':
      return `GPS chưa chính xác (±${Math.round(gps.accuracy)}m), đang chờ tín hiệu tốt hơn`
    case 'denied':
      return 'Chưa cho phép dùng vị trí: Cài đặt > Quyền riêng tư > Định vị'
    case 'error':
      return 'Không lấy được vị trí, bấm nút định vị để thử lại'
    case 'unsupported':
      return 'Thiết bị không hỗ trợ lấy vị trí'
  }
}

export function LiveStatusPage() {
  const { loading } = useStatus()
  if (loading) return <LiveStatusPageSkeleton />
  return <LiveStatus />
}

function LiveStatus() {
  const { actor, places, presences, gps, refreshLocation } = useStatus()
  const placeName = (id: string | null) => places.find((p) => p.id === id)?.name
  const me: Presence = presences.find((p) => p.uid === actor.uid) ?? { uid: actor.uid, name: actor.name, placeId: null, since: null }
  const myPlace = placeName(me.placeId)

  // Mình đứng đầu, sau đó ai mới đổi chỗ gần đây nhất
  const people = [...presences].sort(
    (a, b) => Number(b.uid === actor.uid) - Number(a.uid === actor.uid) || (b.since?.getTime() ?? 0) - (a.since?.getTime() ?? 0),
  )

  return (
    <PageShell>
      <AppHeader title="Trạng thái" backTo="/status" />

      <div className={BOARD_CLASS}>
        <Suspense fallback={<Skeleton className="h-full w-full rounded-none" />}>
          <StatusScene places={places} presences={presences} myUid={actor.uid} />
        </Suspense>
      </div>

      {/* Mình đang ở đâu + tình trạng GPS */}
      <GlassPanel className={INFO_CLASS}>
        <Avatar uid={me.uid} name={me.name} me size="h-10 w-10 text-xs" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm leading-5 font-semibold">
            {myPlace ? `Bạn đang ở: ${myPlace}` : 'Chưa xác định bạn đang ở đâu'}
            {myPlace && <span className="font-normal text-white/60"> · {sinceText(me.since)}</span>}
          </span>
          <span className="block truncate text-xs leading-4 text-white/60">{gpsText(gps)}</span>
        </span>
      </GlassPanel>

      {/* Ai đang ở đâu: phân trang (nút tam giác 2 bên), bên phải chừa chỗ cho nút nổi */}
      <GlassPanel className={PEOPLE_CLASS}>
        <PagedRow
          items={people}
          getKey={(p) => p.uid}
          itemWidth={PERSON_WIDTH}
          className={PEOPLE_ROW}
          empty={<p className="text-center text-xs leading-5 text-white/70">Chưa có ai được xác định vị trí.</p>}
          renderItem={(p) => (
            <div className="flex w-full flex-col items-center gap-0.5">
              <Avatar uid={p.uid} name={p.name} me={p.uid === actor.uid} />
              <span className="w-full truncate text-center text-[11px] leading-4 font-semibold">{p.uid === actor.uid ? 'Bạn' : p.name}</span>
              <span className="line-clamp-2 w-full text-center text-[10px] leading-3 text-white/60">{placeName(p.placeId) ?? 'Chưa rõ'}</span>
            </div>
          )}
        />
      </GlassPanel>

      <FabGroup>
        <Fab icon="locate" label="Cập nhật vị trí của tôi" loading={gps.kind === 'locating'} onClick={refreshLocation} />
      </FabGroup>
    </PageShell>
  )
}

export function LiveStatusPageSkeleton() {
  return (
    <PageShell>
      <AppHeaderSkeleton />
      <Skeleton className={`${BOARD_CLASS} !border-0 !shadow-none`} />
      <GlassPanel className={INFO_CLASS}>
        <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
        <div className="flex-1 space-y-1">
          <Skeleton className="h-4 w-40 rounded-md" />
          <Skeleton className="h-3 w-52 rounded-md" />
        </div>
      </GlassPanel>
      <GlassPanel className={PEOPLE_CLASS}>
        <PagedRowSkeleton
          itemWidth={PERSON_WIDTH}
          className={PEOPLE_ROW}
          renderItem={() => (
            <div className="flex flex-col items-center gap-1">
              <Skeleton className="h-9 w-9 rounded-full" />
              <Skeleton className="h-3 w-12 rounded-md" />
              <Skeleton className="h-2.5 w-10 rounded-md" />
            </div>
          )}
        />
      </GlassPanel>
      <FabSkeleton />
    </PageShell>
  )
}
