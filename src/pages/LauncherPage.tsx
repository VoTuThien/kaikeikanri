import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { APPS } from '../apps'
import { AddShortcutIcon, HOME_GRID, HomeIcon, HomeIconSkeleton, REMOVE_BADGE, shortcutLook } from '../components/HomeIcon'
import { Avatar } from '../components/Avatar'
import { revealBubble, useBubbleHidden } from '../components/NotificationBubble'
import { PageShell } from '../components/PageShell'
import { LinkButton } from '../components/ui/Button'
import { Fab, FabGroup, FabSkeleton, LineIcon } from '../components/ui/Fab'
import { GlassPanel } from '../components/ui/GlassPanel'
import { Icon3D } from '../components/ui/Icon3D'
import { Select } from '../components/ui/Select'
import { Skeleton } from '../components/ui/Skeleton'
import { SIZE } from '../components/ui/sizes'
import { useAuth } from '../contexts/AuthContext'
import { useFamily } from '../contexts/FamilyContext'
import {
  clearShortcutEntry,
  getCachedShortcuts,
  markShortcutEntry,
  removeShortcut,
  setSideScreen,
  useShortcuts,
  type Side,
} from '../lib/shortcuts'
import { shortcutById } from '../shortcuts'

const HEADER_CLASS = 'space-y-3'
// Hàng lời chào: [avatar] [Xin chào, tên] [nút sửa thông tin cá nhân]; nút và avatar cao bằng 2 dòng chữ (h-12)
const GREETING = 'flex items-center gap-3'
const EDIT_BUTTON = `${SIZE.control} flex w-12 shrink-0 items-center justify-center rounded-xl border border-white/25 bg-white/10 transition hover:bg-white/20 active:scale-95`
const ME_AVATAR = 'h-12 w-12 text-sm'
// Nhiều icon thì chỉ lưới icon cuộn (có thanh cuộn); chừa lề trên cho nút gỡ và icon rung không bị cắt,
// lề dưới để hàng icon cuối không bị nút nổi che
const GRID_PANEL_CLASS = 'min-h-0 !shrink overflow-y-auto overscroll-contain scroll-thin !pt-6 !pb-20'

// Ô đổi màn hình 2 bên (hiện khi nhấn giữ): 2 nút bằng nhau
const SIDES_CLASS = 'grid grid-cols-2 gap-3 !p-3'
const SIDE_BUTTON = `${SIZE.control} flex min-w-0 items-center gap-2 rounded-xl border border-white/25 bg-white/10 px-3 text-left transition active:scale-95`
const SIDE_LABEL: Record<Side, string> = { left: 'Bên trái', right: 'Bên phải' }
const SIDES_HINT = 'h-4 leading-4'

// Lựa chọn đặc biệt trong ô chọn gia đình: chuyển sang màn hình tạo / tham gia / quản lý
const CREATE = '__create'
const JOIN = '__join'
const MANAGE = '__manage'

// Mã gia đình (chủ gia đình chạm để sao chép, gửi cho người muốn tham gia)
function FamilyCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)
  async function copy() {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Trình duyệt không cho sao chép: người dùng tự đọc mã trên màn hình
    }
  }
  return (
    <button type="button" onClick={copy} className="truncate text-left">
      Mã gia đình: <span className="font-bold tracking-widest text-white">{code}</span>{' '}
      <span className="text-white/50">{copied ? '· Đã sao chép' : '· chạm để chép'}</span>
    </button>
  )
}

export function LauncherPage() {
  const { user, logout } = useAuth()
  // Bong bóng thông báo đang bị ẩn (đã kéo vào dấu X): hiện nút chuông để gọi lại
  const bubbleHidden = useBubbleHidden(user?.uid)
  const { families, current, selectFamily, owned, sentRequests } = useFamily()
  const navigate = useNavigate()
  const { ids: shortcuts, ...sides } = useShortcuts(user?.uid)
  // Nhấn giữ 1 icon: vào chế độ gỡ phím tắt (icon rung), bấm nút check để xong
  const [editing, setEditing] = useState(false)
  const startEditing = () => setEditing(true)
  // Về tới màn hình chính: bỏ dấu "mở từ phím tắt" để vào app con bằng icon app thì quay lại như bình thường
  useEffect(clearShortcutEntry, [])

  function onSelect(value: string) {
    if (value === CREATE) return navigate('/family/create')
    if (value === JOIN) return navigate('/family/join')
    if (value === MANAGE) return navigate('/family/manage')
    selectFamily(value)
  }

  return (
    // Đang gỡ phím tắt thì tắt vuốt ngang sang 2 bên (SideSwipe bỏ qua vùng có data-no-swipe)
    <div className="contents" data-no-swipe={editing || undefined}>
      <PageShell>
        <GlassPanel className={HEADER_CLASS}>
          <div className={GREETING}>
            {/* Avatar của mình (ảnh trong Thông tin cá nhân, chưa có thì 2 chữ cái) */}
            {user && <Avatar uid={user.uid} name={user.displayName || user.email || ''} size={ME_AVATAR} />}
            <div className="min-w-0 flex-1">
              <p className={`${SIZE.subtitle} text-sm leading-5 text-white/70`}>Xin chào,</p>
              <h1 className={`${SIZE.title} truncate text-2xl leading-8 font-bold`}>{user?.displayName || user?.email}</h1>
            </div>
            {/* Sửa thông tin cá nhân: icon nét thường (không 3D) */}
            <Link to="/profile" aria-label="Sửa thông tin cá nhân" title="Sửa thông tin cá nhân" className={EDIT_BUTTON}>
              <LineIcon icon="edit" className="h-5 w-5" />
            </Link>
          </div>
          {/* Chọn gia đình ngay tại màn hình chính; dữ liệu các app bên dưới thuộc gia đình đang chọn */}
          {current && (
            <div className="space-y-1.5">
              <Select id="family" label="Gia đình" hideLabel value={current.familyId} onChange={(e) => onSelect(e.target.value)}>
                {families.map((f) => (
                  <option key={f.familyId} value={f.familyId}>
                    {f.name}
                    {f.role === 'owner' ? ' (của bạn)' : ''}
                  </option>
                ))}
                <option disabled>──────────</option>
                <option value={MANAGE}>Quản lý gia đình...</option>
                {!owned && <option value={CREATE}>+ Tạo gia đình mới</option>}
                <option value={JOIN}>Tham gia gia đình khác...</option>
              </Select>
              <div className={`${SIZE.label} flex items-center gap-2 text-xs leading-5 text-white/60`}>
                <span className="flex min-w-0 flex-1">
                  {current.role === 'owner' ? <FamilyCode code={current.code} /> : <span className="truncate">Bạn là thành viên</span>}
                </span>
                <Link to="/family/manage" className="shrink-0 font-semibold text-fuchsia-200">
                  Quản lý ›
                </Link>
              </div>
            </div>
          )}
        </GlassPanel>

        {/* Đang gỡ phím tắt: đổi / gỡ màn hình bên trái / phải (vuốt ở màn hình chính để mở).
            Chạm ô để đổi màn hình, chạm nút "−" ở góc để gỡ ngay */}
        {current && editing && (
          <GlassPanel className={SIDES_CLASS}>
            {(['left', 'right'] as const).map((side) => {
              const s = sides[side] ? shortcutById.get(sides[side]) : undefined
              return (
                <div key={side} className="relative">
                  <Link to={`/shortcuts?side=${side}`} className={SIDE_BUTTON}>
                    <Icon3D emoji={s?.icon ?? '➕'} className="h-7 w-7 shrink-0" />
                    <span className="min-w-0">
                      <span className="block truncate text-[11px] leading-4 text-white/60">{SIDE_LABEL[side]}</span>
                      <span className="block truncate text-sm leading-5 font-semibold">{s?.name ?? 'Chưa đặt'}</span>
                    </span>
                  </Link>
                  {s && user && (
                    <button
                      type="button"
                      aria-label={`Gỡ màn hình ${SIDE_LABEL[side].toLowerCase()}`}
                      onClick={() => setSideScreen(user.uid, side, null).catch((e) => console.error('Gỡ màn hình 2 bên thất bại', e))}
                      className={`${REMOVE_BADGE} -top-2 -left-2`}
                    >
                      <span className="-mt-0.5">−</span>
                    </button>
                  )}
                </div>
              )
            })}
            <p className={`${SIDES_HINT} col-span-2 truncate text-center text-xs text-white/60`}>
              Vuốt ở màn hình chính để mở · chạm ô để đổi · chạm − để gỡ
            </p>
          </GlassPanel>
        )}

        {current ? (
          <GlassPanel className={GRID_PANEL_CLASS}>
            <div className={HOME_GRID}>
              {/* Icon các app con: không gỡ được */}
              {APPS.map((app, i) => (
                <HomeIcon
                  key={app.id}
                  icon={app.icon}
                  name={app.name}
                  gradient={app.gradient}
                  to={app.path}
                  soon={!app.path}
                  editing={editing}
                  index={i}
                  onLongPress={startEditing}
                />
              ))}
              {/* Phím tắt riêng của tài khoản này */}
              {shortcuts.map((id, i) => {
                const s = shortcutById.get(id)!
                return (
                  <HomeIcon
                    key={id}
                    icon={s.icon}
                    name={s.name}
                    to={s.path}
                    {...shortcutLook(s)}
                    editing={editing}
                    index={APPS.length + i}
                    onLongPress={startEditing}
                    onOpen={() => markShortcutEntry(s.path)}
                    onRemove={() => user && removeShortcut(user.uid, id).catch((e) => console.error('Gỡ phím tắt thất bại', e))}
                  />
                )
              })}
              <AddShortcutIcon />
            </div>
          </GlassPanel>
        ) : (
          // Chưa thuộc gia đình nào: tạo mới hoặc tham gia bằng mã
          <GlassPanel className="space-y-4 text-center">
            <div className="flex h-12 justify-center">
              <Icon3D emoji="🏠" className="h-12 w-12" />
            </div>
            <p className="text-sm leading-5 text-white/80">
              Dữ liệu Quỹ, Trạng thái, Chăm con thuộc về từng gia đình. Hãy tạo gia đình mới hoặc tham gia gia đình của người thân bằng mã.
            </p>
            {sentRequests.length > 0 && (
              <p className="text-xs leading-5 text-amber-100">Đang chờ duyệt: {sentRequests.map((r) => r.name).join(', ')}</p>
            )}
            <div className="grid grid-cols-2 gap-3">
              <LinkButton to="/family/create" variant="primary">
                Tạo gia đình
              </LinkButton>
              <LinkButton to="/family/join">Tham gia</LinkButton>
            </div>
          </GlassPanel>
        )}

        {/* Nút thoát; thông báo là bong bóng nổi trên mọi màn hình (NotificationBubble).
            Bong bóng đang ẩn thì thêm nút chuông sát góc phải: chạm để hiện lại bong bóng và mở popup thông báo */}
        {editing ? (
          // Đang gỡ phím tắt: chỉ còn nút xong (dấu check)
          <FabGroup>
            <Fab icon="save" label="Xong" onClick={() => setEditing(false)} />
          </FabGroup>
        ) : (
          <FabGroup>
            <Fab icon="logout" label="Đăng xuất" variant="secondary" onClick={logout} />
            {bubbleHidden && user && <Fab icon="bell" label="Hiện bong bóng thông báo" onClick={() => revealBubble(user.uid)} />}
          </FabGroup>
        )}
      </PageShell>
    </div>
  )
}

export function LauncherPageSkeleton() {
  // Cùng số nút nổi với trang thật (thêm nút chuông khi bong bóng thông báo đang ẩn)
  const bubbleHidden = useBubbleHidden(useAuth().user?.uid)
  return (
    <PageShell>
      <GlassPanel className={HEADER_CLASS}>
        <div className={GREETING}>
          <Skeleton className={`${ME_AVATAR} shrink-0 rounded-full`} />
          <div className="min-w-0 flex-1">
            <Skeleton className={`${SIZE.subtitle} w-20 rounded-md`} />
            <Skeleton className={`${SIZE.title} w-48`} />
          </div>
          <Skeleton className={`${SIZE.control} w-12 shrink-0`} />
        </div>
        <div className="space-y-1.5">
          <Skeleton className={`${SIZE.control} w-full`} />
          <Skeleton className={`${SIZE.label} w-52 rounded-md`} />
        </div>
      </GlassPanel>
      <GlassPanel className={GRID_PANEL_CLASS}>
        <div className={HOME_GRID}>
          {/* App con + phím tắt đã lưu lần trước + ô "+" */}
          {Array.from({ length: APPS.length + getCachedShortcuts().length + 1 }, (_, i) => (
            <HomeIconSkeleton key={i} />
          ))}
        </div>
      </GlassPanel>
      <FabSkeleton count={bubbleHidden ? 2 : 1} />
    </PageShell>
  )
}
