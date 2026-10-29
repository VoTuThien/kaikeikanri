import { useEffect, useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { onSnapshot, orderBy, query, type Timestamp } from 'firebase/firestore'
import { AppHeader, AppHeaderSkeleton } from '../../components/AppHeader'
import { Avatar } from '../../components/Avatar'
import { PageShell, ScrollArea } from '../../components/PageShell'
import { Alert } from '../../components/ui/Alert'
import { Button } from '../../components/ui/Button'
import { FAB_SPACE, Fab, FabGroup, FabSkeleton } from '../../components/ui/Fab'
import { GLASS_CLASS, GlassPanel } from '../../components/ui/GlassPanel'
import { Skeleton } from '../../components/ui/Skeleton'
import { TextField, TextFieldSkeleton } from '../../components/ui/TextField'
import { SIZE } from '../../components/ui/sizes'
import { useAuth } from '../../contexts/AuthContext'
import { useFamily, type MyFamily } from '../../contexts/FamilyContext'
import { membersCol, removeMember, renameFamily, type Member } from './data/api'

const FORM_ID = 'family-manage-form'
const INFO_PANEL = 'space-y-3 !p-5'
// Danh sách thành viên: chiếm phần còn lại của màn hình, chỉ danh sách được cuộn; chừa chỗ cuối cho nút nổi
const LIST_CLASS = `${GLASS_CLASS} !p-0 ${FAB_SPACE}`
const REMOVE_BUTTON = 'w-24 shrink-0'

// Thành viên của gia đình đang chọn, cập nhật realtime. null = đang tải.
function useMembers(familyId: string | undefined): Member[] | null {
  const [members, setMembers] = useState<Member[] | null>(null)
  useEffect(() => {
    setMembers(null)
    if (!familyId) return
    return onSnapshot(query(membersCol(familyId), orderBy('joinedAt', 'asc')), (snap) =>
      setMembers(
        snap.docs.map((d) => {
          const v = d.data({ serverTimestamps: 'estimate' })
          return {
            uid: d.id,
            name: v.name ?? '',
            email: v.email ?? '',
            role: v.role === 'owner' ? 'owner' : 'member',
            joinedAt: v.joinedAt ? (v.joinedAt as Timestamp).toDate() : null,
          }
        }),
      ),
    )
  }, [familyId])
  return members
}

export function FamilyManagePage() {
  const { current } = useFamily()
  const members = useMembers(current?.familyId)
  if (!current) return <Navigate to="/" replace />
  if (!members) return <FamilyManagePageSkeleton />
  return <FamilyManage key={current.familyId} family={current} members={members} />
}

function FamilyManage({ family, members }: { family: MyFamily; members: Member[] }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const isOwner = family.role === 'owner'
  const owner = members.find((m) => m.role === 'owner')

  const [name, setName] = useState(family.name)
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null)
  const [saving, setSaving] = useState(false)
  // Xoá thành viên / rời gia đình: bấm lần 1 để hỏi lại, lần 2 mới thực hiện
  const [confirmUid, setConfirmUid] = useState<string | null>(null)
  const [removing, setRemoving] = useState<string | null>(null)
  const [confirmLeave, setConfirmLeave] = useState(false)
  const [leaving, setLeaving] = useState(false)

  async function handleRename(e: FormEvent) {
    e.preventDefault()
    setMessage(null)
    const trimmed = name.trim()
    if (!trimmed) return setMessage({ type: 'error', text: 'Vui lòng nhập tên gia đình.' })
    if (trimmed === family.name) return setMessage({ type: 'success', text: 'Tên gia đình không thay đổi.' })
    setSaving(true)
    try {
      await renameFamily(family, trimmed, members.map((m) => m.uid))
      setMessage({ type: 'success', text: 'Đã đổi tên gia đình.' })
    } catch (err) {
      console.error(err)
      setMessage({ type: 'error', text: 'Đổi tên thất bại. Vui lòng thử lại.' })
    } finally {
      setSaving(false)
    }
  }

  async function remove(member: Member) {
    if (confirmUid !== member.uid) return setConfirmUid(member.uid)
    setMessage(null)
    setRemoving(member.uid)
    try {
      await removeMember(family.familyId, member.uid)
      setMessage({ type: 'success', text: `Đã xoá ${member.name} khỏi gia đình.` })
    } catch (err) {
      console.error(err)
      setMessage({ type: 'error', text: 'Xoá thành viên thất bại. Vui lòng thử lại.' })
    } finally {
      setRemoving(null)
      setConfirmUid(null)
    }
  }

  async function leave() {
    if (!user) return
    setLeaving(true)
    try {
      await removeMember(family.familyId, user.uid)
      navigate('/')
    } catch (err) {
      console.error(err)
      setMessage({ type: 'error', text: 'Rời gia đình thất bại. Vui lòng thử lại.' })
      setLeaving(false)
    }
  }

  return (
    <PageShell>
      <AppHeader title="Quản lý gia đình" backTo="/" />

      <GlassPanel className={INFO_PANEL}>
        {isOwner ? (
          <form id={FORM_ID} onSubmit={handleRename} className="space-y-3" noValidate>
            <TextField id="family-name" label="Tên gia đình" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} />
            <p className={`${SIZE.label} truncate text-xs leading-5 text-white/60`}>
              Mã gia đình: <span className="font-bold tracking-widest text-white">{family.code}</span>
            </p>
          </form>
        ) : (
          <div className="space-y-1">
            <p className={`${SIZE.label} text-sm leading-5 text-white/70`}>Gia đình</p>
            <p className={`${SIZE.title} truncate text-2xl leading-8 font-bold`}>{family.name}</p>
            <p className={`${SIZE.label} truncate text-xs leading-5 text-white/60`}>Chủ gia đình: {owner?.name ?? '...'}</p>
          </div>
        )}
        {message && <Alert type={message.type}>{message.text}</Alert>}
        {confirmLeave && <Alert type="error">Bấm nút rời gia đình lần nữa để rời. Bạn sẽ không xem được dữ liệu của gia đình này nữa.</Alert>}
      </GlassPanel>

      <h2 className={`${SIZE.sectionTitle} px-1 text-sm leading-6 font-semibold text-white/70`}>Thành viên ({members.length})</h2>
      <ScrollArea className={LIST_CLASS}>
        <div className="divide-y divide-white/10">
          {members.map((m) => {
            const isMe = m.uid === user?.uid
            return (
              <div key={m.uid} className={`${SIZE.row} flex items-center gap-3 px-4`}>
                <Avatar uid={m.uid} name={m.name} me={isMe} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm leading-5 font-semibold">
                    {m.name}
                    {isMe && <span className="font-normal text-white/60"> (bạn)</span>}
                  </span>
                  <span className="block truncate text-xs leading-5 text-white/60">
                    {m.role === 'owner' ? 'Chủ gia đình' : m.email || 'Thành viên'}
                  </span>
                </span>
                {/* Chủ gia đình xoá được các thành viên khác */}
                {isOwner && m.role !== 'owner' && (
                  <div className={REMOVE_BUTTON}>
                    <Button
                      variant={confirmUid === m.uid ? 'danger' : 'secondary'}
                      className="!h-10 !px-1"
                      loading={removing === m.uid}
                      disabled={!!removing}
                      onClick={() => remove(m)}
                    >
                      {confirmUid === m.uid ? 'Xoá luôn' : 'Xoá'}
                    </Button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </ScrollArea>

      {isOwner ? (
        <FabGroup>
          <Fab type="submit" form={FORM_ID} icon="save" label="Lưu tên gia đình" loading={saving} />
        </FabGroup>
      ) : (
        // Thành viên rời gia đình: bấm lần 1 hỏi lại, lần 2 mới rời
        <FabGroup>
          {confirmLeave && <Fab icon="cancel" label="Huỷ" variant="secondary" onClick={() => setConfirmLeave(false)} />}
          <Fab
            icon="logout"
            label={confirmLeave ? 'Rời gia đình (xác nhận)' : 'Rời gia đình'}
            variant="danger"
            loading={leaving}
            onClick={() => (confirmLeave ? leave() : setConfirmLeave(true))}
            className={confirmLeave ? 'ring-4 ring-rose-300/60' : ''}
          />
        </FabGroup>
      )}
    </PageShell>
  )
}

export function FamilyManagePageSkeleton() {
  return (
    <PageShell>
      <AppHeaderSkeleton />
      <GlassPanel className={INFO_PANEL}>
        <TextFieldSkeleton />
        <Skeleton className={`${SIZE.label} w-40 rounded-md`} />
      </GlassPanel>
      <Skeleton className={`${SIZE.sectionTitle} w-32 rounded-md`} />
      <ScrollArea className={`${LIST_CLASS} !overflow-hidden`}>
        <div className="divide-y divide-white/10">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className={`${SIZE.row} flex items-center gap-3 px-4`}>
              <Skeleton className="h-9 w-9 rounded-full" />
              <div className="flex-1 space-y-1">
                <Skeleton className="h-4 w-28 rounded-md" />
                <Skeleton className="h-3 w-36 rounded-md" />
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
      <FabSkeleton />
    </PageShell>
  )
}
