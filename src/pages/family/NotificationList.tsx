import { useState, type CSSProperties, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Avatar } from '../../components/Avatar'
import { Alert } from '../../components/ui/Alert'
import { Button } from '../../components/ui/Button'
import { Icon3D } from '../../components/ui/Icon3D'
import { Skeleton } from '../../components/ui/Skeleton'
import { BLOCK_3D, GLOSS_3D } from '../../components/ui/style3d'
import { useFamily } from '../../contexts/FamilyContext'
import { useNotices, type Notice } from '../../lib/notifications'
import { monthLabel } from '../fund/data/orders'
import { useSalaryReminders } from '../fund/data/salary'
import { approveJoinRequest, rejectJoinRequest, type JoinRequest } from './data/api'

// Nội dung thông báo dùng chung cho trang /notifications và popup mở từ bong bóng thông báo (NotificationBubble), cập nhật realtime:
// - Nhắc nhập lương thực lãnh (app Quỹ): chạm để mở màn hình Thực thi đúng tháng
// - Xin gia nhập gia đình mình tạo: Từ chối / Duyệt ngay tại chỗ
// - Thông báo lưu lại (src/lib/notifications.ts): ghi chú được gửi đến mình, time line của con được cập nhật — luôn xem lại được

// Thẻ thông báo: khối glass bo góc, cao cố định
const ITEM = 'flex h-[4.5rem] items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.07] px-3'
// 2 nút Từ chối / Duyệt bằng nhau, cùng 1 hàng
const ACTIONS = 'grid w-40 shrink-0 grid-cols-2 gap-1.5'
const SECTION = 'px-1 pt-1 text-[11px] leading-5 font-semibold tracking-wide text-white/50 uppercase'

function when(d: Date | null) {
  if (!d) return ''
  return d.toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })
}

export function NotificationList({ onNavigate, animated = false }: { onNavigate?: () => void; animated?: boolean }) {
  const { owned, requests } = useFamily()
  const { pending } = useSalaryReminders()
  const notices = useNotices()
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

  // Popup: các dòng hiện lần lượt (trượt lên + hiện dần)
  let order = 0
  const enter = () =>
    animated ? { className: 'animate-notify-item', style: { animationDelay: `${80 + order++ * 45}ms` } } : { className: '', style: undefined }

  const joins = owned ? requests : []
  if (pending.length === 0 && joins.length === 0 && notices.list.length === 0) {
    const e = enter()
    return (
      <div className={`flex flex-col items-center justify-center gap-2 px-6 py-8 text-center ${e.className}`} style={e.style}>
        <Icon3D emoji="🔔" className="h-12 w-12" />
        <span className="text-sm leading-5 font-semibold">Không có thông báo mới</span>
        <span className="text-xs leading-4 text-white/60">
          {owned ? 'Bạn đã xử lý hết rồi.' : 'Bạn chưa tạo gia đình nên không có thông báo xin gia nhập.'}
        </span>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {error && <Alert type="error">{error}</Alert>}

      {/* Nhắc nhập lương thực lãnh: còn hiện cho tới khi nhập xong (useSalaryReminders) */}
      {pending.length > 0 && <Section enter={enter()}>Nhắc lương</Section>}
      {pending.map((m) => {
        const e = enter()
        return (
          <Link key={m} to={`/fund/execute?month=${m}`} onClick={onNavigate} className={`${ITEM} transition active:scale-[0.98] ${e.className}`} style={e.style}>
            <span className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-orange-500 ${BLOCK_3D}`}>
              <span className={GLOSS_3D} />
              <Icon3D emoji="💰" className="h-7 w-7" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm leading-5 font-semibold">Đến ngày nhận lương · {monthLabel(m)}</span>
              <span className="block truncate text-xs leading-4 text-amber-100">Chạm để nhập lương thực lãnh</span>
            </span>
            <span className="shrink-0 text-xl text-white/50">›</span>
          </Link>
        )
      })}

      {joins.length > 0 && owned && <Section enter={enter()}>Xin gia nhập · {owned.name}</Section>}
      {joins.map((r) => {
        const e = enter()
        return (
          <div key={r.uid} className={`${ITEM} ${e.className}`} style={e.style}>
            <Avatar uid={r.uid} name={r.name} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm leading-5 font-semibold">{r.name}</span>
              <span className="block truncate text-xs leading-4 text-white/60">{r.email}</span>
              <span className="block truncate text-[11px] leading-4 text-white/40">{when(r.createdAt)}</span>
            </span>
            <div className={ACTIONS}>
              <Button variant="secondary" className="!h-9 !px-1 !text-xs" loading={busy === r.uid + ':no'} disabled={!!busy} onClick={() => act(r, false)}>
                Từ chối
              </Button>
              <Button className="!h-9 !px-1 !text-xs" loading={busy === r.uid + ':ok'} disabled={!!busy} onClick={() => act(r, true)}>
                Duyệt
              </Button>
            </div>
          </div>
        )
      })}

      {/* Ghi chú được gửi đến / time line của con được cập nhật: luôn còn đây để xem lại (đã xong / đã xem thì mờ đi) */}
      {notices.list.length > 0 && <Section enter={enter()}>Ghi chú & time line</Section>}
      {notices.list.map((n) => {
        const e = enter()
        return <NoticeRow key={n.id} notice={n} enter={e} onNavigate={onNavigate} />
      })}
    </div>
  )
}

// 1 thông báo lưu lại: chạm để mở ghi chú / time line tương ứng; trạng thái ở bên phải
function NoticeRow({ notice: n, enter, onNavigate }: { notice: Notice; enter: { className: string; style?: CSSProperties }; onNavigate?: () => void }) {
  const note = n.kind === 'note'
  const to = note ? `/note/inbox/${n.noteId}` : n.childId ? `/baby/timeline?child=${n.childId}` : '/baby/timeline'
  const title = note ? `${n.fromName} gửi ghi chú "${n.noteName}"` : `Time line của ${n.childName || 'bé'}`
  const sub = note ? when(n.updatedAt) : `${n.byName}: ${n.detail} · ${when(n.updatedAt)}`
  // Trạng thái: ghi chú Chưa xong -> Hoàn thành; time line Mới -> Đã xem
  const status = note ? (n.done ? 'Hoàn thành' : 'Chưa xong') : n.seen ? 'Đã xem' : 'Mới'
  return (
    <Link
      to={to}
      onClick={onNavigate}
      className={`${ITEM} transition active:scale-[0.98] ${n.active ? '' : 'opacity-60'} ${enter.className}`}
      style={enter.style}
    >
      <span
        className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${note ? 'from-sky-400 to-blue-600' : 'from-pink-400 to-rose-600'} ${BLOCK_3D}`}
      >
        <span className={GLOSS_3D} />
        <Icon3D emoji={note ? '📝' : '👶'} className="h-7 w-7" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm leading-5 font-semibold">{title}</span>
        <span className="block truncate text-xs leading-4 text-white/60">{sub}</span>
      </span>
      <span
        className={`flex h-6 w-[4.75rem] shrink-0 items-center justify-center gap-1 rounded-full text-[11px] font-semibold ${
          n.active ? (note ? 'bg-amber-400/25 text-amber-100' : 'bg-fuchsia-500/30 text-fuchsia-100') : 'bg-white/10 text-white/70'
        }`}
      >
        {n.active && <span className={`h-1.5 w-1.5 rounded-full ${note ? 'bg-amber-300' : 'animate-pulse bg-fuchsia-300'}`} />}
        {status}
      </span>
    </Link>
  )
}

// Tiêu đề nhóm thông báo (chữ nhỏ in hoa)
function Section({ enter, children }: { enter: { className: string; style?: CSSProperties }; children: ReactNode }) {
  return (
    <p className={`${SECTION} truncate ${enter.className}`} style={enter.style}>
      {children}
    </p>
  )
}

export function NotificationListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className={ITEM}>
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex-1 space-y-1">
            <Skeleton className="h-4 w-24 rounded-md" />
            <Skeleton className="h-3 w-32 rounded-md" />
          </div>
          <div className={ACTIONS}>
            <Skeleton className="h-9 rounded-xl" />
            <Skeleton className="h-9 rounded-xl" />
          </div>
        </div>
      ))}
    </div>
  )
}
