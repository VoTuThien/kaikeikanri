import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { APPS, type AppEntry } from '../apps'
import { PageShell } from '../components/PageShell'
import { LinkButton } from '../components/ui/Button'
import { Fab, FabGroup, FabLink, FabSkeleton } from '../components/ui/Fab'
import { GlassPanel } from '../components/ui/GlassPanel'
import { Icon3D } from '../components/ui/Icon3D'
import { Select } from '../components/ui/Select'
import { Skeleton } from '../components/ui/Skeleton'
import { SIZE } from '../components/ui/sizes'
import { BLOCK_3D, GLOSS_3D } from '../components/ui/style3d'
import { useAuth } from '../contexts/AuthContext'
import { useFamily } from '../contexts/FamilyContext'

// Lưới 4 cột như màn hình chính iPhone: icon luôn thẳng hàng theo cả hàng và cột
const GRID = 'grid grid-cols-4 gap-x-2 gap-y-5'
const HEADER_CLASS = 'space-y-3'

// Lựa chọn đặc biệt trong ô chọn gia đình: chuyển sang màn hình tạo / tham gia / quản lý
const CREATE = '__create'
const JOIN = '__join'
const MANAGE = '__manage'

function AppIcon({ app }: { app: AppEntry }) {
  const content = (
    <>
      <span className={`${SIZE.appIcon} relative flex items-center justify-center rounded-[22%] bg-gradient-to-br ${BLOCK_3D} ${app.gradient}`}>
        <span className={GLOSS_3D} />
        <Icon3D emoji={app.icon} className="h-11 w-11" />
        {!app.path && (
          <span className="absolute -top-1.5 -right-1.5 rounded-full bg-white/90 px-1.5 text-[10px] leading-4 font-semibold text-slate-700">
            Sắp có
          </span>
        )}
      </span>
      <span className={`${SIZE.appLabel} w-full truncate text-center text-xs leading-4 font-medium`}>{app.name}</span>
    </>
  )
  const cls = 'flex flex-col items-center gap-1.5 transition active:scale-95'

  return app.path ? (
    <Link to={app.path} className={cls}>
      {content}
    </Link>
  ) : (
    <div className={`${cls} opacity-60`} aria-disabled="true">
      {content}
    </div>
  )
}

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
  const { families, current, selectFamily, owned, requests, sentRequests } = useFamily()
  const navigate = useNavigate()

  function onSelect(value: string) {
    if (value === CREATE) return navigate('/family/create')
    if (value === JOIN) return navigate('/family/join')
    if (value === MANAGE) return navigate('/family/manage')
    selectFamily(value)
  }

  return (
    <PageShell>
      <GlassPanel className={HEADER_CLASS}>
        <div>
          <p className={`${SIZE.subtitle} text-sm leading-5 text-white/70`}>Xin chào,</p>
          <h1 className={`${SIZE.title} truncate text-2xl leading-8 font-bold`}>{user?.displayName || user?.email}</h1>
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

      {current ? (
        <GlassPanel>
          <div className={GRID}>
            {APPS.map((app) => (
              <AppIcon key={app.id} app={app} />
            ))}
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

      {/* Nút chính (chuông thông báo) sát góc phải, bên trái là nút thoát */}
      <FabGroup>
        <Fab icon="logout" label="Đăng xuất" variant="secondary" onClick={logout} />
        {/* Chuông luôn màu nút chính để khác hẳn nút thoát (xám); có yêu cầu thì thêm số đếm đỏ */}
        <FabLink to="/notifications" icon="bell" label="Thông báo xin gia nhập" badge={requests.length} />
      </FabGroup>
    </PageShell>
  )
}

export function LauncherPageSkeleton() {
  return (
    <PageShell>
      <GlassPanel className={HEADER_CLASS}>
        <div>
          <Skeleton className={`${SIZE.subtitle} w-20 rounded-md`} />
          <Skeleton className={`${SIZE.title} w-48`} />
        </div>
        <div className="space-y-1.5">
          <Skeleton className={`${SIZE.control} w-full`} />
          <Skeleton className={`${SIZE.label} w-52 rounded-md`} />
        </div>
      </GlassPanel>
      <GlassPanel>
        <div className={GRID}>
          {APPS.map((app) => (
            <div key={app.id} className="flex flex-col items-center gap-1.5">
              <Skeleton className={`${SIZE.appIcon} rounded-[22%]`} />
              <Skeleton className={`${SIZE.appLabel} w-10 rounded-md`} />
            </div>
          ))}
        </div>
      </GlassPanel>
      <FabSkeleton count={2} />
    </PageShell>
  )
}
