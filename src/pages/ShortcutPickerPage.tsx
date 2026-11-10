import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { APPS } from '../apps'
import { AppHeader, AppHeaderSkeleton } from '../components/AppHeader'
import { HOME_GRID, HomeIconSkeleton, IconFace, shortcutLook } from '../components/HomeIcon'
import { PageShell, ScrollArea } from '../components/PageShell'
import { Alert } from '../components/ui/Alert'
import { FAB_SPACE, Fab, FabGroup, FabSkeleton } from '../components/ui/Fab'
import { GLASS_CLASS } from '../components/ui/GlassPanel'
import { Skeleton } from '../components/ui/Skeleton'
import { SIZE } from '../components/ui/sizes'
import { useAuth } from '../contexts/AuthContext'
import { addShortcut, getCachedLauncher, setSideScreen, useShortcuts, type Side } from '../lib/shortcuts'
import { SHORTCUTS } from '../shortcuts'
import { SIDE_TEXT } from './SidePage'

// Chọn màn hình (mọi màn hình mở trực tiếp từ các app con, trừ Cài đặt) cho 2 việc:
//   /shortcuts             tạo phím tắt ở màn hình chính (màn hình đã thêm thì mờ đi)
//   /shortcuts?side=left   thiết đặt màn hình bên trái / phải của màn hình chính (đã thiết đặt thì có FAB xoá để bỏ)
// Chạm 1 màn hình: lưu rồi quay về màn hình chính.

const LIST_CLASS = `${GLASS_CLASS} space-y-4 !pt-6`
const SECTION_TITLE = `${SIZE.sectionTitle} flex items-center text-sm leading-6 font-semibold text-white/80`
const BADGE = 'absolute inset-x-0 top-0 truncate bg-white/90 text-center px-1.5 text-[10px] leading-4 font-semibold text-slate-700'

// Nhóm màn hình theo app con, theo thứ tự icon ở màn hình chính
const GROUPS = APPS.map((app) => ({ app, items: SHORTCUTS.filter((s) => s.appId === app.id) })).filter((g) => g.items.length > 0)

const sideOf = (s: string | null): Side | null => (s === 'left' || s === 'right' ? s : null)

export function ShortcutPickerPage() {
  const { user } = useAuth()
  const launcher = useShortcuts(user?.uid)
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const side = sideOf(params.get('side'))
  const current = side ? launcher[side] : null
  const [error, setError] = useState('')
  const [removing, setRemoving] = useState(false)

  async function save(write: () => Promise<void>) {
    setError('')
    try {
      await write()
      navigate('/')
    } catch (err) {
      console.error(err)
      setError('Lưu thất bại. Vui lòng thử lại.')
      setRemoving(false)
    }
  }

  function pick(id: string) {
    if (!user) return
    if (side) save(() => setSideScreen(user.uid, side, id))
    else if (!launcher.ids.includes(id)) save(() => addShortcut(user.uid, id))
  }

  return (
    <PageShell>
      <AppHeader title={side ? SIDE_TEXT[side].title : 'Thêm phím tắt'} backTo="/" />
      {error && <Alert type="error">{error}</Alert>}
      <ScrollArea className={`${LIST_CLASS} ${current ? FAB_SPACE : ''}`}>
        {GROUPS.map(({ app, items }) => (
          <section key={app.id} className="space-y-3">
            <h2 className={SECTION_TITLE}>{app.name}</h2>
            <div className={HOME_GRID}>
              {items.map((s) => {
                // Phím tắt: màn hình đã thêm thì không chọn lại được. Màn hình 2 bên: chọn màn hình nào cũng được
                const added = !side && launcher.ids.includes(s.id)
                const selected = side && current === s.id
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => pick(s.id)}
                    disabled={added}
                    className="block w-full transition active:scale-95 disabled:opacity-50"
                  >
                    <IconFace icon={s.icon} name={s.name} {...shortcutLook(s)}>
                      {added && <span className={BADGE}>Đã thêm</span>}
                      {selected && <span className={BADGE}>Đang chọn</span>}
                    </IconFace>
                  </button>
                )
              })}
            </div>
          </section>
        ))}
      </ScrollArea>
      {side && current && user && (
        <FabGroup>
          <Fab
            icon="delete"
            variant="danger"
            label="Bỏ thiết đặt"
            loading={removing}
            onClick={() => {
              setRemoving(true)
              save(() => setSideScreen(user.uid, side, null))
            }}
          />
        </FabGroup>
      )}
    </PageShell>
  )
}

export function ShortcutPickerPageSkeleton() {
  const [params] = useSearchParams()
  const side = sideOf(params.get('side'))
  const hasFab = !!side && !!getCachedLauncher()[side]
  return (
    <PageShell>
      <AppHeaderSkeleton />
      <ScrollArea className={`${LIST_CLASS} !overflow-hidden`}>
        {GROUPS.map(({ app, items }) => (
          <section key={app.id} className="space-y-3">
            <div className={SECTION_TITLE}>
              <Skeleton className="h-4 w-20 rounded-md" />
            </div>
            <div className={HOME_GRID}>
              {items.map((s) => (
                <HomeIconSkeleton key={s.id} />
              ))}
            </div>
          </section>
        ))}
      </ScrollArea>
      {hasFab && <FabSkeleton />}
    </PageShell>
  )
}
