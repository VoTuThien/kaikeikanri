import { useState } from 'react'
import { AppHeader, AppHeaderSkeleton } from '../../components/AppHeader'
import { Avatar } from '../../components/Avatar'
import { PageShell, ScrollArea } from '../../components/PageShell'
import { Alert } from '../../components/ui/Alert'
import { Button } from '../../components/ui/Button'
import { GLASS_CLASS } from '../../components/ui/GlassPanel'
import { Icon3D } from '../../components/ui/Icon3D'
import { Skeleton } from '../../components/ui/Skeleton'
import { SIZE } from '../../components/ui/sizes'
import { useFamily } from '../../contexts/FamilyContext'
import { approveJoinRequest, rejectJoinRequest, type JoinRequest } from './data/api'

// Danh sách yêu cầu: chiếm phần còn lại của màn hình, chỉ danh sách được cuộn
const LIST_CLASS = `${GLASS_CLASS} !p-0`
// 2 nút Từ chối / Duyệt bằng nhau, cùng 1 hàng
const ACTIONS = 'grid w-44 shrink-0 grid-cols-2 gap-2'

function when(d: Date | null) {
  if (!d) return ''
  return d.toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })
}

// Thông báo xin gia nhập gia đình mình tạo; danh sách cập nhật realtime (FamilyContext)
export function NotificationsPage() {
  const { owned, requests } = useFamily()
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')

  async function act(req: JoinRequest, approve: boolean) {
    if (!owned) return
    setError('')
    setBusy(req.uid + (approve ? ':ok' : ':no'))
    try {
      if (approve) await approveJoinRequest(owned, req)
      else await rejectJoinRequest(owned.familyId, req.uid)
    } catch (err) {
      console.error(err)
      setError('Xử lý yêu cầu thất bại. Vui lòng thử lại.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <PageShell>
      <AppHeader title="Thông báo" backTo="/" />
      {owned && (
        <p className={`${SIZE.subtitle} truncate px-1 text-sm leading-5 text-white/70`}>
          Xin gia nhập <span className="font-semibold text-white">{owned.name}</span>
        </p>
      )}
      {error && <Alert type="error">{error}</Alert>}
      <ScrollArea className={LIST_CLASS}>
        {!owned || requests.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
            <Icon3D emoji="🏠" className="h-12 w-12" />
            <span className="text-sm leading-5 text-white/70">
              {owned ? 'Chưa có ai xin gia nhập gia đình của bạn.' : 'Bạn chưa tạo gia đình nên chưa có thông báo xin gia nhập.'}
            </span>
          </div>
        ) : (
          <div className="divide-y divide-white/10">
            {requests.map((r) => (
              <div key={r.uid} className={`${SIZE.listItem} flex items-center gap-3 px-4`}>
                <Avatar uid={r.uid} name={r.name} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm leading-5 font-semibold">{r.name}</span>
                  <span className="block truncate text-xs leading-4 text-white/60">{r.email}</span>
                  <span className="block truncate text-[11px] leading-4 text-white/40">{when(r.createdAt)}</span>
                </span>
                <div className={ACTIONS}>
                  <Button variant="secondary" className="!h-10 !px-1" loading={busy === r.uid + ':no'} disabled={!!busy} onClick={() => act(r, false)}>
                    Từ chối
                  </Button>
                  <Button className="!h-10 !px-1" loading={busy === r.uid + ':ok'} disabled={!!busy} onClick={() => act(r, true)}>
                    Duyệt
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </PageShell>
  )
}

export function NotificationsPageSkeleton() {
  return (
    <PageShell>
      <AppHeaderSkeleton />
      <Skeleton className={`${SIZE.subtitle} w-48 rounded-md`} />
      <ScrollArea className={`${LIST_CLASS} !overflow-hidden`}>
        <div className="divide-y divide-white/10">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className={`${SIZE.listItem} flex items-center gap-3 px-4`}>
              <Skeleton className="h-9 w-9 rounded-full" />
              <div className="flex-1 space-y-1">
                <Skeleton className="h-4 w-24 rounded-md" />
                <Skeleton className="h-3 w-32 rounded-md" />
              </div>
              <div className={ACTIONS}>
                <Skeleton className="h-10 rounded-xl" />
                <Skeleton className="h-10 rounded-xl" />
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </PageShell>
  )
}
