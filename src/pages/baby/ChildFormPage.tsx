import { useState, type ChangeEvent, type FormEvent } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { AppHeader, AppHeaderSkeleton } from '../../components/AppHeader'
import { FIT_CLASS, PageShell } from '../../components/PageShell'
import { Alert } from '../../components/ui/Alert'
import { ImagePicker } from '../../components/ui/ImagePicker'
import { FabSkeleton, SaveDeleteFabs } from '../../components/ui/Fab'
import { GlassPanel } from '../../components/ui/GlassPanel'
import { Icon3D } from '../../components/ui/Icon3D'
import { Segmented, SegmentedSkeleton } from '../../components/ui/Segmented'
import { Skeleton } from '../../components/ui/Skeleton'
import { FieldLabel, TextField, TextFieldSkeleton } from '../../components/ui/TextField'
import { SIZE } from '../../components/ui/sizes'
import { TimeField } from '../../components/ui/TimeField'
import { fileToSquareDataUrl } from '../../lib/image'
import { birthLabel, ChildAvatar } from './components'
import { createChild, deleteChild, updateChild } from './data/api'
import { useBaby } from './data/BabyContext'
import { CHILD_AVATARS, childAge, GENDERS, type Child, type Gender } from './data/types'

// Thêm / sửa thông tin con: tên, nickname (không bắt buộc), ngày sinh, giờ sinh (không bắt buộc), giới tính, avatar.
// Avatar hình tròn ở đầu form: CHẠM VÀO AVATAR để chọn / đổi ảnh (thư viện hoặc chụp; cắt vuông + thu nhỏ trên máy rồi lưu
// thẳng vào Firestore). Chưa có ảnh thì hiện hình camera.

const FORM_CLASS = 'space-y-3'
const ROW_2 = 'grid grid-cols-2 gap-3'
const PREVIEW = 'flex h-20 items-center gap-4'
const AVATAR = 'h-20 w-20'
const FORM_ID = 'child-form'

export function ChildFormPage() {
  const { id } = useParams()
  const { loading, children } = useBaby()
  const isNew = !id
  if (loading) return <ChildFormPageSkeleton isNew={isNew} />

  const child = children.find((c) => c.id === id)
  if (!isNew && !child) return <Navigate to="/baby/children" replace />
  return <ChildForm key={id ?? 'new'} child={child} />
}

function ChildForm({ child }: { child?: Child }) {
  const { actor, selectChild } = useBaby()
  const navigate = useNavigate()
  const isNew = !child

  const [name, setName] = useState(child?.name ?? '')
  const [nickname, setNickname] = useState(child?.nickname ?? '')
  const [birthDate, setBirthDate] = useState(child?.birthDate ?? '')
  const [birthTime, setBirthTime] = useState(child?.birthTime ?? '')
  const [gender, setGender] = useState<Gender>(child?.gender ?? 'male')
  // Icon dự phòng (ô chọn con dạng sổ xuống không hiện được ảnh nên vẫn dùng emoji)
  const avatar = child?.avatar ?? CHILD_AVATARS[0]
  const [photo, setPhoto] = useState<string | null>(child?.photo ?? null)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Chọn ảnh: cắt vuông ở giữa, thu nhỏ 256px rồi giữ dạng data URL (lưu cùng thông tin con)
  async function pickPhoto(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // chọn lại cùng 1 ảnh vẫn chạy
    if (!file) return
    setError('')
    setProcessing(true)
    try {
      setPhoto(await fileToSquareDataUrl(file))
    } catch (err) {
      console.error(err)
      setError('Không đọc được ảnh này. Hãy thử ảnh khác.')
    } finally {
      setProcessing(false)
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (!name.trim()) return setError('Vui lòng nhập tên của con.')
    if (!birthDate) return setError('Vui lòng chọn ngày sinh.')
    setSaving(true)
    try {
      const input = { name: name.trim(), nickname: nickname.trim(), birthDate, birthTime: birthTime || null, gender, avatar, photo }
      if (isNew) await createChild(input, actor)
      else await updateChild(child.id, input)
      navigate('/baby/children')
    } catch (err) {
      console.error(err)
      setError('Lưu thất bại. Vui lòng thử lại.')
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!child) return
    setDeleting(true)
    try {
      await deleteChild(child.id)
      selectChild('')
      navigate('/baby/children')
    } catch (err) {
      console.error(err)
      setError('Xoá thất bại. Vui lòng thử lại.')
      setDeleting(false)
    }
  }

  return (
    <PageShell>
      <AppHeader title={isNew ? 'Thêm con' : 'Sửa thông tin con'} backTo="/baby/children" />
      <GlassPanel className={FIT_CLASS}>
        <form id={FORM_ID} onSubmit={handleSubmit} className={FORM_CLASS} noValidate>
          {/* Avatar tròn: chạm để chọn / đổi ảnh; chưa có ảnh thì hiện camera. Bên cạnh là tên + tuổi xem trước */}
          <div className={PREVIEW}>
            <ImagePicker
              round
              label={photo ? 'Đổi ảnh của con' : 'Chọn ảnh của con'}
              onChange={pickPhoto}
              className={`${AVATAR} relative shrink-0 rounded-full transition active:scale-95`}
            >
              {processing ? (
                <span className={`${AVATAR} flex items-center justify-center rounded-full border-2 border-white/30 bg-white/10`}>
                  <span className="h-6 w-6 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                </span>
              ) : photo ? (
                <ChildAvatar child={{ avatar, gender, photo }} box={AVATAR} />
              ) : (
                <span className={`${AVATAR} flex items-center justify-center rounded-full border-2 border-dashed border-white/40 bg-white/10`}>
                  <Icon3D emoji="📷" className="h-10 w-10" />
                </span>
              )}
            </ImagePicker>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-base leading-6 font-semibold">
                {name.trim() || 'Tên của con'}
                {nickname.trim() && <span className="font-normal text-white/60"> ({nickname.trim()})</span>}
              </span>
              <span className="block truncate text-xs leading-5 text-white/60">
                {birthDate ? `${childAge(birthDate)} · ${birthLabel({ birthDate, birthTime: birthTime || null })}` : 'Chưa nhập ngày sinh'}
              </span>
              <span className="flex h-6 items-center gap-3 text-xs leading-6">
                <span className="text-white/50">{photo ? 'Chạm ảnh để đổi' : 'Chạm camera để chọn ảnh'}</span>
                {photo && (
                  <button type="button" onClick={() => setPhoto(null)} className="font-semibold text-rose-200">
                    Bỏ ảnh
                  </button>
                )}
              </span>
            </span>
          </div>

          <TextField id="name" label="Tên" placeholder="Ví dụ: Bé Na" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} />
          <TextField
            id="nickname"
            label="Nickname (nếu có)"
            placeholder="Ví dụ: Bin, Sữa"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            maxLength={20}
          />

          <div className={ROW_2}>
            <TextField id="birthDate" label="Ngày sinh" type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
            {/* Ô giờ dùng chung (vòng tròn chọn giờ / phút); giờ sinh không bắt buộc nên có "Bỏ giờ" */}
            <TimeField id="birthTime" label="Giờ sinh (nếu có)" clearable value={birthTime} onChange={setBirthTime} />
          </div>

          <div className="space-y-1.5">
            <FieldLabel>Giới tính</FieldLabel>
            <Segmented options={GENDERS} value={gender} onChange={setGender} />
          </div>

          {error && <Alert type="error">{error}</Alert>}
          {confirmDelete && <Alert type="error">Bấm thùng rác lần nữa để xoá. Các hoạt động đã ghi của con vẫn được giữ lại.</Alert>}
        </form>
      </GlassPanel>
      <SaveDeleteFabs
        formId={FORM_ID}
        canDelete={!isNew}
        confirming={confirmDelete}
        saving={saving || processing}
        deleting={deleting}
        saveLabel={isNew ? 'Thêm con' : 'Lưu thay đổi'}
        deleteLabel="Xoá thông tin con"
        onAskDelete={() => setConfirmDelete(true)}
        onCancelDelete={() => setConfirmDelete(false)}
        onDelete={handleDelete}
      />
    </PageShell>
  )
}

export function ChildFormPageSkeleton({ isNew }: { isNew: boolean }) {
  return (
    <PageShell>
      <AppHeaderSkeleton />
      <GlassPanel className={FIT_CLASS}>
        <div className={FORM_CLASS}>
          <div className={PREVIEW}>
            <Skeleton round className={`${AVATAR} rounded-full`} />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-5 w-32 rounded-md" />
              <Skeleton className="h-4 w-44 rounded-md" />
            </div>
          </div>
          <TextFieldSkeleton />
          <TextFieldSkeleton />
          <div className={ROW_2}>
            <TextFieldSkeleton />
            <TextFieldSkeleton />
          </div>
          <div className="space-y-1.5">
            <Skeleton className={`${SIZE.label} w-20 rounded-md`} />
            <SegmentedSkeleton count={GENDERS.length} />
          </div>
        </div>
      </GlassPanel>
      <FabSkeleton count={isNew ? 1 : 2} />
    </PageShell>
  )
}
