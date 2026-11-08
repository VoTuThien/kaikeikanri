import { useState, type ChangeEvent, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { AppHeader, AppHeaderSkeleton } from '../components/AppHeader'
import { Avatar } from '../components/Avatar'
import { FIT_CLASS, PageShell } from '../components/PageShell'
import { Alert } from '../components/ui/Alert'
import { ImagePicker } from '../components/ui/ImagePicker'
import { Fab, FabGroup, FabSkeleton } from '../components/ui/Fab'
import { GlassPanel } from '../components/ui/GlassPanel'
import { Segmented, SegmentedSkeleton } from '../components/ui/Segmented'
import { Skeleton } from '../components/ui/Skeleton'
import { FieldLabel, TextField, TextFieldSkeleton } from '../components/ui/TextField'
import { SIZE } from '../components/ui/sizes'
import { useAuth } from '../contexts/AuthContext'
import { fileToSquareDataUrl } from '../lib/image'
import { PERSON_GENDERS, personAge, saveProfile, useProfile, type PersonGender, type ProfileInput } from '../lib/profile'

// Thông tin cá nhân (mở bằng nút cây bút ở màn hình chính): tên, nickname, ngày sinh, giới tính, nghề nghiệp, avatar.
// Giống form thông tin con: CHẠM VÀO AVATAR TRÒN ở đầu form để chọn / đổi ảnh (cắt vuông + thu nhỏ trên máy rồi lưu thẳng vào Firestore);
// chưa có ảnh thì hiện avatar 2 chữ cái như cũ. Lưu xong quay về màn hình chính.

const FORM_CLASS = 'space-y-3'
const ROW_2 = 'grid grid-cols-2 gap-3'
const PREVIEW = 'flex h-20 items-center gap-4'
const AVATAR = 'h-20 w-20'
const FORM_ID = 'profile-form'

export function ProfilePage() {
  const { user } = useAuth()
  const profile = useProfile(user?.uid)
  if (!user || profile === undefined) return <ProfilePageSkeleton />
  return <ProfileForm uid={user.uid} email={user.email ?? ''} displayName={user.displayName ?? ''} profile={profile} />
}

function ProfileForm({ uid, email, displayName, profile }: { uid: string; email: string; displayName: string; profile: ProfileInput | null }) {
  const { updateName } = useAuth()
  const navigate = useNavigate()
  const [name, setName] = useState(profile?.name || displayName)
  const [nickname, setNickname] = useState(profile?.nickname ?? '')
  const [birthDate, setBirthDate] = useState(profile?.birthDate ?? '')
  const [gender, setGender] = useState<PersonGender>(profile?.gender ?? '')
  const [job, setJob] = useState(profile?.job ?? '')
  const [photo, setPhoto] = useState<string | null>(profile?.photo ?? null)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  // Chọn ảnh: cắt vuông ở giữa, thu nhỏ 256px rồi giữ dạng data URL (lưu cùng hồ sơ)
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
    if (!name.trim()) return setError('Vui lòng nhập tên.')
    setSaving(true)
    try {
      await saveProfile(uid, { name: name.trim(), nickname: nickname.trim(), birthDate, gender, job: job.trim(), photo })
      // Tên hiển thị của tài khoản: lời chào ở màn hình chính, người thực hiện các thao tác sau này
      await updateName(name.trim())
      navigate('/')
    } catch (err) {
      console.error(err)
      setError('Lưu thất bại. Vui lòng thử lại.')
      setSaving(false)
    }
  }

  const info = [birthDate && personAge(birthDate), PERSON_GENDERS.find((g) => g.value === gender)?.label, job.trim()].filter(Boolean).join(' · ')

  return (
    <PageShell>
      <AppHeader title="Thông tin cá nhân" subtitle={email} backTo="/" />
      <GlassPanel className={FIT_CLASS}>
        <form id={FORM_ID} onSubmit={handleSubmit} className={FORM_CLASS} noValidate>
          {/* Avatar tròn: chạm để chọn / đổi ảnh; chưa có ảnh thì hiện 2 chữ cái. Bên cạnh là tên + thông tin xem trước */}
          <div className={PREVIEW}>
            <ImagePicker
              label={photo ? 'Đổi ảnh đại diện' : 'Chọn ảnh đại diện'}
              onChange={pickPhoto}
              className={`${AVATAR} relative shrink-0 rounded-full transition active:scale-95`}
            >
              {processing ? (
                <span className={`${AVATAR} flex items-center justify-center rounded-full border-2 border-white/30 bg-white/10`}>
                  <span className="h-6 w-6 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                </span>
              ) : (
                <Avatar uid={uid} name={name || email} photo={photo} size={`${AVATAR} text-2xl`} />
              )}
            </ImagePicker>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-base leading-6 font-semibold">
                {name.trim() || 'Tên của bạn'}
                {nickname.trim() && <span className="font-normal text-white/60"> ({nickname.trim()})</span>}
              </span>
              <span className="block truncate text-xs leading-5 text-white/60">{info || 'Chưa nhập ngày sinh, giới tính, nghề nghiệp'}</span>
              <span className="flex h-6 items-center gap-3 text-xs leading-6">
                <span className="text-white/50">{photo ? 'Chạm ảnh để đổi' : 'Chạm avatar để chọn ảnh'}</span>
                {photo && (
                  <button type="button" onClick={() => setPhoto(null)} className="font-semibold text-rose-200">
                    Bỏ ảnh
                  </button>
                )}
              </span>
            </span>
          </div>

          <TextField id="name" label="Tên" placeholder="Ví dụ: Vũ Quang" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} />
          <TextField
            id="nickname"
            label="Nickname (nếu có)"
            placeholder="Ví dụ: Bố Bin"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            maxLength={20}
          />

          <div className={ROW_2}>
            <TextField id="birthDate" label="Ngày sinh" type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
            <TextField id="job" label="Nghề nghiệp" placeholder="Ví dụ: Kỹ sư" value={job} onChange={(e) => setJob(e.target.value)} maxLength={40} />
          </div>

          <div className="space-y-1.5">
            <FieldLabel>Giới tính</FieldLabel>
            <Segmented options={PERSON_GENDERS} value={gender || null} onChange={setGender} />
          </div>

          {error && <Alert type="error">{error}</Alert>}
        </form>
      </GlassPanel>
      <FabGroup>
        <Fab type="submit" form={FORM_ID} icon="save" label="Lưu thông tin cá nhân" loading={saving || processing} />
      </FabGroup>
    </PageShell>
  )
}

export function ProfilePageSkeleton() {
  return (
    <PageShell>
      <AppHeaderSkeleton subtitle />
      <GlassPanel className={FIT_CLASS}>
        <div className={FORM_CLASS}>
          <div className={PREVIEW}>
            <Skeleton className={`${AVATAR} rounded-full`} />
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
            <SegmentedSkeleton count={PERSON_GENDERS.length} />
          </div>
        </div>
      </GlassPanel>
      <FabSkeleton />
    </PageShell>
  )
}
