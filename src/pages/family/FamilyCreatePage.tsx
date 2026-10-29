import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { AppHeader, AppHeaderSkeleton } from '../../components/AppHeader'
import { PageShell } from '../../components/PageShell'
import { Alert } from '../../components/ui/Alert'
import { Fab, FabGroup, FabSkeleton } from '../../components/ui/Fab'
import { GlassPanel } from '../../components/ui/GlassPanel'
import { Icon3D } from '../../components/ui/Icon3D'
import { Skeleton } from '../../components/ui/Skeleton'
import { TextField, TextFieldSkeleton } from '../../components/ui/TextField'
import { SIZE } from '../../components/ui/sizes'
import { useAuth } from '../../contexts/AuthContext'
import { useFamily } from '../../contexts/FamilyContext'
import { createFamily } from './data/api'

const FORM_ID = 'family-create-form'
const PANEL_CLASS = 'space-y-4'

export function FamilyCreatePage() {
  const { user } = useAuth()
  const { owned, selectFamily } = useFamily()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (!user) return
    if (!name.trim()) return setError('Vui lòng nhập tên gia đình.')
    setSaving(true)
    try {
      const familyId = await createFamily(name.trim(), {
        uid: user.uid,
        name: user.displayName || user.email || '',
        email: user.email ?? '',
      })
      selectFamily(familyId)
      navigate('/')
    } catch (err) {
      console.error(err)
      setError(
        err instanceof Error && err.message === 'already-owner'
          ? 'Mỗi người chỉ được tạo 1 gia đình.'
          : 'Tạo gia đình thất bại. Vui lòng thử lại.',
      )
      setSaving(false)
    }
  }

  // Mỗi người chỉ tạo được 1 gia đình
  if (owned) {
    return (
      <PageShell>
        <AppHeader title="Tạo gia đình" backTo="/" />
        <GlassPanel className={`${PANEL_CLASS} text-center`}>
          <div className="flex h-12 justify-center">
            <Icon3D emoji="🏠" className="h-12 w-12" />
          </div>
          <p className="text-sm leading-6 text-white/80">
            Bạn đã tạo gia đình <span className="font-bold text-white">{owned.name}</span>. Mỗi người chỉ được tạo 1 gia đình, nhưng có
            thể tham gia nhiều gia đình khác.
          </p>
          <p className="text-sm leading-6 text-white/80">
            Mã gia đình: <span className="text-lg font-bold tracking-widest text-white">{owned.code}</span>
          </p>
        </GlassPanel>
      </PageShell>
    )
  }

  return (
    <PageShell>
      <AppHeader title="Tạo gia đình" backTo="/" />
      <GlassPanel className={PANEL_CLASS}>
        <form id={FORM_ID} onSubmit={handleSubmit} className="space-y-4" noValidate>
          <TextField
            id="family-name"
            label="Tên gia đình"
            placeholder="Ví dụ: Gia đình nhà Vũ"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={40}
          />
          <p className={`${SIZE.hint} text-xs leading-5 text-white/60`}>
            Tạo xong sẽ có mã 6 ký tự. Gửi mã cho người thân để họ xin tham gia; bạn duyệt thì họ mới xem được dữ liệu của gia đình.
          </p>
          {error && <Alert type="error">{error}</Alert>}
        </form>
      </GlassPanel>
      <FabGroup>
        <Fab type="submit" form={FORM_ID} icon="save" label="Tạo gia đình" loading={saving} />
      </FabGroup>
    </PageShell>
  )
}

export function FamilyCreatePageSkeleton() {
  return (
    <PageShell>
      <AppHeaderSkeleton />
      <GlassPanel className={PANEL_CLASS}>
        <TextFieldSkeleton />
        <div className={`${SIZE.hint} space-y-1`}>
          <Skeleton className="h-4 w-full rounded-md" />
          <Skeleton className="h-4 w-48 rounded-md" />
        </div>
      </GlassPanel>
      <FabSkeleton />
    </PageShell>
  )
}
