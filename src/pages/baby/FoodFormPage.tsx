import { useState, type FormEvent } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { AppHeader, AppHeaderSkeleton } from '../../components/AppHeader'
import { FIT_CLASS, PageShell } from '../../components/PageShell'
import { submitForm, useChanged, useUnsavedChanges } from '../../components/UnsavedGuard'
import { Alert } from '../../components/ui/Alert'
import { CheckBox } from '../../components/ui/CheckBox'
import { FabSkeleton, SaveDeleteFabs } from '../../components/ui/Fab'
import { GlassPanel } from '../../components/ui/GlassPanel'
import { Segmented, SegmentedSkeleton } from '../../components/ui/Segmented'
import { Select } from '../../components/ui/Select'
import { Skeleton } from '../../components/ui/Skeleton'
import { FieldLabel, TextField, TextFieldSkeleton } from '../../components/ui/TextField'
import { SIZE } from '../../components/ui/sizes'
import { useBaby } from './data/BabyContext'
import {
  createFood,
  deleteFood,
  FOOD_GROUPS,
  FOOD_STATUSES,
  foodKey,
  looksAllergen,
  TRIAL_DAYS,
  trialInfo,
  updateFood,
  useChildFoods,
  type BabyFood,
  type FoodStatus,
} from './data/foods'
import { todayText } from './data/growth'

// Thêm / sửa 1 thực phẩm của con đang chọn (/baby/foods/new, /baby/foods/:id): tên, nhóm, dễ dị ứng, ngày thử lần đầu,
// kết quả (đang thử / ăn được / có phản ứng + ghi chú phản ứng). Tên có từ dễ dị ứng (trứng, tôm, sữa…) thì tự đánh dấu "Dễ dị ứng" (bỏ được).

const FORM_ID = 'food-form'
const FORM_CLASS = 'space-y-3'
const ROW_2 = 'grid grid-cols-2 gap-3'
const HINT = `${SIZE.hint} text-xs leading-5 text-white/60`

export function FoodFormPage() {
  const { id } = useParams()
  const { loading, child } = useBaby()
  const foods = useChildFoods()
  const isNew = !id
  if (loading || !foods) return <FoodFormPageSkeleton isNew={isNew} />
  const food = foods.find((f) => f.id === id)
  if (!isNew && !food) return <Navigate to="/baby/foods" replace />
  if (!child) return <Navigate to="/baby/foods" replace />
  return <FoodForm key={id ?? 'new'} food={food} childId={food?.childId ?? child.id} others={foods.filter((f) => f.id !== id)} />
}

function FoodForm({ food, childId, others }: { food?: BabyFood; childId: string; others: BabyFood[] }) {
  const { actor } = useBaby()
  const isNew = !food
  const [name, setName] = useState(food?.name ?? '')
  const [group, setGroup] = useState(food?.group ?? FOOD_GROUPS[0])
  const [allergen, setAllergen] = useState(food?.allergen ?? false)
  // Người dùng tự bấm ô "Dễ dị ứng" thì không tự đổi theo tên nữa
  const [allergenTouched, setAllergenTouched] = useState(!isNew)
  const [firstTried, setFirstTried] = useState(food?.firstTried ?? todayText())
  const [status, setStatus] = useState<FoodStatus>(food?.status ?? 'trying')
  const [reaction, setReaction] = useState(food?.reaction ?? '')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  // Có thay đổi chưa lưu: chấm đỏ trên nút lưu, rời màn hình thì hỏi lại (UnsavedGuard)
  const dirty = useChanged({ name, group, allergen, firstTried, status, reaction })
  const leave = useUnsavedChanges(dirty && !(saving || deleting), () => submitForm(FORM_ID))

  // Quy tắc 3 ngày: đang thêm món mới mà còn món khác trong 3 ngày theo dõi thì nhắc
  const otherTrials = isNew ? others.filter((f) => trialInfo(f, firstTried) && !trialInfo(f, firstTried)!.due) : []
  const trial = trialInfo({ status, firstTried: firstTried || null })

  function changeName(value: string) {
    setName(value)
    if (!allergenTouched) setAllergen(looksAllergen(value))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    const clean = name.trim().replace(/\s+/g, ' ')
    if (!clean) return setError('Vui lòng nhập tên thực phẩm.')
    if (others.some((f) => foodKey(f.name) === foodKey(clean))) return setError(`"${clean}" đã có trong danh sách của con.`)
    setSaving(true)
    try {
      const input = {
        childId,
        name: clean,
        group,
        allergen,
        firstTried: firstTried || null,
        status,
        reaction: status === 'reaction' ? reaction.trim() : '',
      }
      if (food) await updateFood(food.id, input)
      else await createFood(input, actor)
      leave('/baby/foods')
    } catch (err) {
      console.error(err)
      setError('Lưu thất bại. Vui lòng thử lại.')
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!food) return
    setDeleting(true)
    try {
      await deleteFood(food.id)
      leave('/baby/foods')
    } catch (err) {
      console.error(err)
      setError('Xoá thất bại. Vui lòng thử lại.')
      setDeleting(false)
    }
  }

  return (
    <PageShell>
      <AppHeader title={isNew ? 'Thêm thực phẩm' : 'Sửa thực phẩm'} backTo="/baby/foods" />
      <GlassPanel className={`!p-5 ${FIT_CLASS}`}>
        <form id={FORM_ID} onSubmit={handleSubmit} className={FORM_CLASS} noValidate>
          <TextField id="food-name" label="Tên thực phẩm" placeholder="Ví dụ: Cà rốt" autoComplete="off" maxLength={40} value={name} onChange={(e) => changeName(e.target.value)} />
          <div className={ROW_2}>
            <Select id="food-group" label="Nhóm" value={group} onChange={(e) => setGroup(e.target.value)}>
              {FOOD_GROUPS.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </Select>
            <TextField id="food-first" label="Thử lần đầu" type="date" value={firstTried} onChange={(e) => setFirstTried(e.target.value)} />
          </div>
          <CheckBox
            checked={allergen}
            onChange={(v) => {
              setAllergen(v)
              setAllergenTouched(true)
            }}
            label="Dễ dị ứng"
            hint="Trứng, tôm cua, đậu phộng, sữa bò, lúa mì, cá…"
          />
          <div className="space-y-1.5">
            <FieldLabel>Kết quả</FieldLabel>
            <Segmented options={FOOD_STATUSES} value={status} onChange={setStatus} />
          </div>
          {status === 'reaction' && (
            <TextField
              id="food-reaction"
              label="Phản ứng"
              placeholder="Ví dụ: nổi mẩn quanh miệng, tiêu chảy"
              maxLength={80}
              value={reaction}
              onChange={(e) => setReaction(e.target.value)}
            />
          )}
          <p className={HINT}>
            {status === 'trying' && trial
              ? trial.due
                ? `Đã đủ ${TRIAL_DAYS} ngày theo dõi. Chọn "Ăn được" hoặc "Có phản ứng".`
                : `Đang theo dõi ngày ${trial.day}/${TRIAL_DAYS}. Thử 1 món mới mỗi lần, theo dõi ${TRIAL_DAYS} ngày rồi mới thử món khác.`
              : status === 'reaction'
                ? 'Món có phản ứng sẽ được cảnh báo đỏ khi chọn trong bữa ăn dặm.'
                : `Thử 1 món mới mỗi lần, theo dõi ${TRIAL_DAYS} ngày rồi mới thử món khác.`}
          </p>
          {otherTrials.length > 0 && (
            <Alert type="error">
              {`Đang theo dõi ${otherTrials.map((f) => f.name).join(', ')}: chưa nên cho thử thêm món mới trong ${TRIAL_DAYS} ngày.`}
            </Alert>
          )}
          {confirmDelete && <Alert type="error">Bấm thùng rác lần nữa để xoá thực phẩm này.</Alert>}
          {error && <Alert type="error">{error}</Alert>}
        </form>
      </GlassPanel>
      <SaveDeleteFabs
        dirty={dirty}
        formId={FORM_ID}
        canDelete={!isNew}
        confirming={confirmDelete}
        saving={saving}
        deleting={deleting}
        saveLabel={isNew ? 'Thêm thực phẩm' : 'Lưu thay đổi'}
        deleteLabel="Xoá thực phẩm"
        onAskDelete={() => setConfirmDelete(true)}
        onCancelDelete={() => setConfirmDelete(false)}
        onDelete={handleDelete}
      />
    </PageShell>
  )
}

export function FoodFormPageSkeleton({ isNew }: { isNew: boolean }) {
  return (
    <PageShell>
      <AppHeaderSkeleton />
      <GlassPanel className={`!p-5 ${FIT_CLASS}`}>
        <div className={FORM_CLASS}>
          <TextFieldSkeleton />
          <div className={ROW_2}>
            <TextFieldSkeleton />
            <TextFieldSkeleton />
          </div>
          <Skeleton className={`${SIZE.control} w-full`} />
          <div className="space-y-1.5">
            <Skeleton className={`${SIZE.label} w-16 rounded-md`} />
            <SegmentedSkeleton count={FOOD_STATUSES.length} />
          </div>
          <Skeleton className={`${SIZE.hint} w-full rounded-md`} />
        </div>
      </GlassPanel>
      <FabSkeleton count={isNew ? 1 : 2} />
    </PageShell>
  )
}
