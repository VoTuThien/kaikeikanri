import { useState, type FormEvent } from 'react'
import { AppHeader, AppHeaderSkeleton } from '../../components/AppHeader'
import { PageShell, ScrollArea } from '../../components/PageShell'
import { Alert } from '../../components/ui/Alert'
import { Button } from '../../components/ui/Button'
import { FAB_SPACE, Fab, FabGroup, FabSkeleton } from '../../components/ui/Fab'
import { GLASS_CLASS, GlassPanel } from '../../components/ui/GlassPanel'
import { Skeleton } from '../../components/ui/Skeleton'
import { TextField, TextFieldSkeleton } from '../../components/ui/TextField'
import { SIZE } from '../../components/ui/sizes'
import { useAuth } from '../../contexts/AuthContext'
import { useFamily } from '../../contexts/FamilyContext'
import { cancelJoinRequest, CODE_LENGTH, findFamilyByCode, normalizeCode, sendJoinRequest } from './data/api'

const FORM_ID = 'family-join-form'
const FORM_PANEL = 'space-y-3 !p-5'
// Danh sách yêu cầu đã gửi: chiếm phần còn lại của màn hình, chỉ danh sách được cuộn
const LIST_CLASS = `${GLASS_CLASS} !p-0 ${FAB_SPACE}`

export function FamilyJoinPage() {
  const { user } = useAuth()
  const { families, sentRequests } = useFamily()
  const [code, setCode] = useState('')
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null)
  const [sending, setSending] = useState(false)
  const [cancelling, setCancelling] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setMessage(null)
    if (!user) return
    if (code.length !== CODE_LENGTH) return setMessage({ type: 'error', text: `Mã gia đình gồm ${CODE_LENGTH} ký tự.` })

    setSending(true)
    try {
      const family = await findFamilyByCode(code)
      if (!family) return setMessage({ type: 'error', text: 'Không tìm thấy gia đình với mã này.' })
      if (families.some((f) => f.familyId === family.familyId)) {
        return setMessage({ type: 'error', text: `Bạn đã là thành viên của "${family.name}".` })
      }
      if (sentRequests.some((r) => r.familyId === family.familyId)) {
        return setMessage({ type: 'error', text: `Bạn đã gửi yêu cầu tới "${family.name}", đang chờ duyệt.` })
      }
      await sendJoinRequest(family, { uid: user.uid, name: user.displayName || user.email || '', email: user.email ?? '' })
      setCode('')
      setMessage({ type: 'success', text: `Đã gửi yêu cầu tới "${family.name}". Bạn sẽ thấy gia đình ở màn hình chính ngay khi được duyệt.` })
    } catch (err) {
      console.error(err)
      setMessage({ type: 'error', text: 'Gửi yêu cầu thất bại. Vui lòng thử lại.' })
    } finally {
      setSending(false)
    }
  }

  async function cancel(familyId: string) {
    if (!user) return
    setCancelling(familyId)
    try {
      await cancelJoinRequest(familyId, user.uid)
    } catch (err) {
      console.error(err)
      setMessage({ type: 'error', text: 'Huỷ yêu cầu thất bại. Vui lòng thử lại.' })
    } finally {
      setCancelling(null)
    }
  }

  return (
    <PageShell>
      <AppHeader title="Tham gia gia đình" backTo="/" />
      <GlassPanel className={FORM_PANEL}>
        <form id={FORM_ID} onSubmit={handleSubmit} className="space-y-3" noValidate>
          <TextField
            id="family-code"
            label="Mã gia đình"
            placeholder="AB7K2Q"
            autoComplete="off"
            autoCapitalize="characters"
            className="text-lg font-bold tracking-[0.3em] uppercase"
            value={code}
            onChange={(e) => setCode(normalizeCode(e.target.value))}
          />
          <p className={`${SIZE.hint} text-xs leading-5 text-white/60`}>Hỏi chủ gia đình mã 6 ký tự. Bạn chỉ xem được dữ liệu sau khi chủ gia đình duyệt.</p>
          {message && <Alert type={message.type}>{message.text}</Alert>}
        </form>
      </GlassPanel>

      <h2 className={`${SIZE.sectionTitle} px-1 text-sm leading-6 font-semibold text-white/70`}>Yêu cầu đang chờ duyệt</h2>
      <ScrollArea className={LIST_CLASS}>
        {sentRequests.length === 0 ? (
          <p className="p-6 text-center text-sm leading-5 text-white/60">Chưa có yêu cầu nào đang chờ.</p>
        ) : (
          <div className="divide-y divide-white/10">
            {sentRequests.map((r) => (
              <div key={r.familyId} className={`${SIZE.row} flex items-center gap-3 px-5`}>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm leading-5 font-semibold">{r.name}</span>
                  <span className="block truncate text-xs leading-5 text-amber-100">Đang chờ chủ gia đình duyệt</span>
                </span>
                <div className="w-20 shrink-0">
                  <Button variant="secondary" className="!h-10" loading={cancelling === r.familyId} onClick={() => cancel(r.familyId)}>
                    Huỷ
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      <FabGroup>
        <Fab type="submit" form={FORM_ID} icon="send" label="Gửi yêu cầu tham gia" loading={sending} />
      </FabGroup>
    </PageShell>
  )
}

export function FamilyJoinPageSkeleton() {
  return (
    <PageShell>
      <AppHeaderSkeleton />
      <GlassPanel className={FORM_PANEL}>
        <TextFieldSkeleton />
        <Skeleton className={`${SIZE.hint} w-full rounded-md`} />
      </GlassPanel>
      <Skeleton className={`${SIZE.sectionTitle} w-44 rounded-md`} />
      <ScrollArea className={`${LIST_CLASS} !overflow-hidden`}>
        <div className="divide-y divide-white/10">
          {Array.from({ length: 2 }, (_, i) => (
            <div key={i} className={`${SIZE.row} flex items-center gap-3 px-5`}>
              <div className="flex-1 space-y-1">
                <Skeleton className="h-4 w-32 rounded-md" />
                <Skeleton className="h-3 w-44 rounded-md" />
              </div>
              <Skeleton className="h-10 w-20 rounded-xl" />
            </div>
          ))}
        </div>
      </ScrollArea>
      <FabSkeleton />
    </PageShell>
  )
}
