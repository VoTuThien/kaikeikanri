import { useState, type FormEvent } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { AppHeader, AppHeaderSkeleton } from '../../components/AppHeader'
import { FIT_CLASS, PageShell } from '../../components/PageShell'
import { Alert } from '../../components/ui/Alert'
import { Button } from '../../components/ui/Button'
import { FabSkeleton, LineIcon, SaveDeleteFabs } from '../../components/ui/Fab'
import { GlassPanel } from '../../components/ui/GlassPanel'
import { Skeleton } from '../../components/ui/Skeleton'
import { FieldLabel, TextField, TextFieldSkeleton } from '../../components/ui/TextField'
import { SIZE } from '../../components/ui/sizes'
import { ChildAvatar } from './components'
import { useBaby } from './data/BabyContext'
import {
  ageAtDate,
  cleanVaccines,
  createGrowth,
  deleteGrowth,
  HEIGHT_RANGE,
  measureText,
  parseMeasure,
  todayText,
  updateGrowth,
  useAllGrowth,
  WEIGHT_RANGE,
  type GrowthRecord,
} from './data/growth'
import type { Child } from './data/types'
import { submitForm, useChanged, useUnsavedChanges } from '../../components/UnsavedGuard'

// Tạo / sửa 1 thẻ phát triển (/baby/growth/new, /baby/growth/:id): ngày, chiều cao, cân nặng, các vắc xin.
// Thẻ mới thuộc CON ĐANG CHỌN. 1 ngày tiêm được NHIỀU vắc xin: mỗi mũi 1 ô, nút "+ Thêm vắc xin", ô thừa có nút X để bỏ;
// không nhập vắc xin nào = hôm đó không tiêm. Dưới tên con hiện tuổi của con vào ngày thực hiện (theo tháng).

const FORM_ID = 'growth-form'
const FORM_CLASS = 'space-y-3'
const CHILD_ROW = `${SIZE.listItem} flex items-center gap-3 border border-white/15 bg-white/5 px-3`
const HINT = `${SIZE.hint} text-xs leading-5 text-white/60`
// Hàng ô vắc xin: [ô nhập] [nút X], nút X cùng cao với ô nhập
const VACCINE_ROW = 'grid grid-cols-[1fr_3rem] gap-2'

let seq = 0
const newRow = (text = '') => ({ key: `v${++seq}`, text })

export function GrowthFormPage() {
  const { id } = useParams()
  const { loading, children, child } = useBaby()
  const all = useAllGrowth()
  const isNew = !id
  if (loading || !all) return <GrowthFormPageSkeleton isNew={isNew} />

  const record = all.find((r) => r.id === id)
  if (!isNew && !record) return <Navigate to="/baby/growth" replace />
  // Thẻ đang sửa thuộc con nào thì hiện con đó; tạo mới thì là con đang chọn
  const owner = record ? (children.find((c) => c.id === record.childId) ?? null) : child
  if (isNew && !owner) return <Navigate to="/baby/growth" replace />

  // Tên vắc xin đã từng ghi của cả gia đình: gợi ý khi gõ
  const vaccineNames = [...new Set(all.flatMap((r) => r.vaccines))]
  return <GrowthForm key={id ?? 'new'} record={record} owner={owner} vaccineNames={vaccineNames} />
}

function GrowthForm({ record, owner, vaccineNames }: { record?: GrowthRecord; owner: Child | null; vaccineNames: string[] }) {
  const { actor } = useBaby()
  const isNew = !record

  const [date, setDate] = useState(record?.date ?? todayText())
  const [heightText, setHeightText] = useState(measureText(record?.height ?? null))
  const [weightText, setWeightText] = useState(measureText(record?.weight ?? null))
  // Các ô vắc xin (mỗi mũi 1 ô); luôn có ít nhất 1 ô
  const [vaccines, setVaccines] = useState(() => (record?.vaccines.length ? record.vaccines.map((v) => newRow(v)) : [newRow()]))
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  // Có thay đổi chưa lưu: chấm đỏ trên nút lưu, rời màn hình thì hỏi lại (UnsavedGuard)
  const dirty = useChanged({ date, heightText, weightText, vaccines: cleanVaccines(vaccines.map((v) => v.text)) })
  const age = owner ? ageAtDate(owner.birthDate, date) : ''
  const leave = useUnsavedChanges(dirty && !(saving || deleting), () => submitForm(FORM_ID))

  // Chỉ cho gõ số và 1 dấu phẩy / chấm thập phân
  const onlyNumber = (v: string) => v.replace(/[^\d.,]/g, '').slice(0, 6)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (!date) return setError('Vui lòng chọn ngày thực hiện.')
    const height = parseMeasure(heightText)
    const weight = parseMeasure(weightText)
    if (height !== null && (Number.isNaN(height) || height < HEIGHT_RANGE.min || height > HEIGHT_RANGE.max))
      return setError(`Chiều cao phải từ ${HEIGHT_RANGE.min} đến ${HEIGHT_RANGE.max} cm.`)
    if (weight !== null && (Number.isNaN(weight) || weight < WEIGHT_RANGE.min || weight > WEIGHT_RANGE.max))
      return setError(`Cân nặng phải từ 0,5 đến ${WEIGHT_RANGE.max} kg.`)
    const names = cleanVaccines(vaccines.map((v) => v.text))
    if (height === null && weight === null && names.length === 0) return setError('Nhập ít nhất chiều cao, cân nặng hoặc 1 vắc xin.')
    const childId = record?.childId ?? owner?.id
    if (!childId) return setError('Chưa chọn con.')

    setSaving(true)
    try {
      const input = {
        childId,
        date,
        height: height === null ? null : Math.round(height * 10) / 10,
        weight: weight === null ? null : Math.round(weight * 100) / 100,
        vaccines: names,
      }
      if (record) await updateGrowth(record.id, input)
      else await createGrowth(input, actor)
      leave('/baby/growth')
    } catch (err) {
      console.error(err)
      setError('Lưu thất bại. Vui lòng thử lại.')
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!record) return
    setDeleting(true)
    try {
      await deleteGrowth(record.id)
      leave('/baby/growth')
    } catch (err) {
      console.error(err)
      setError('Xoá thất bại. Vui lòng thử lại.')
      setDeleting(false)
    }
  }

  return (
    <PageShell>
      <AppHeader title={isNew ? 'Thêm thẻ phát triển' : 'Sửa thẻ phát triển'} backTo="/baby/growth" />
      <GlassPanel className={`!p-5 ${FIT_CLASS}`}>
        <form id={FORM_ID} onSubmit={handleSubmit} className={FORM_CLASS} noValidate>
          {/* Thẻ này của con nào */}
          <div className={CHILD_ROW}>
            {owner && <ChildAvatar child={owner} />}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-base leading-6 font-semibold">
                {owner ? (owner.nickname ? `${owner.name} (${owner.nickname})` : owner.name) : 'Con đã bị xoá'}
              </span>
              {/* Tuổi của con vào ngày thực hiện (đổi ngày là tính lại) */}
              <span className="block truncate text-xs leading-5 text-fuchsia-200">
                {age ? `Lúc thực hiện: ${age}` : owner?.birthDate ? 'Ngày thực hiện trước ngày sinh' : 'Chưa nhập ngày sinh của con'}
              </span>
            </span>
          </div>

          <TextField id="date" label="Ngày thực hiện" type="date" value={date} onChange={(e) => setDate(e.target.value)} />

          {/* 2 ô số đo ngắn đặt cạnh nhau cho gọn */}
          <div className="grid grid-cols-2 gap-3">
            <TextField
              id="height"
              label="Chiều cao"
              suffix="cm"
              inputMode="decimal"
              placeholder="75,5"
              value={heightText}
              onChange={(e) => setHeightText(onlyNumber(e.target.value))}
            />
            <TextField
              id="weight"
              label="Cân nặng"
              suffix="kg"
              inputMode="decimal"
              placeholder="9,2"
              value={weightText}
              onChange={(e) => setWeightText(onlyNumber(e.target.value))}
            />
          </div>

          {/* Các vắc xin tiêm trong ngày: mỗi mũi 1 ô */}
          <div className="space-y-2">
            <FieldLabel>Vắc xin</FieldLabel>
            {vaccines.map((v, i) => (
              <div key={v.key} className={VACCINE_ROW}>
                <TextField
                  id={`vaccine-${v.key}`}
                  label={`Vắc xin ${i + 1}`}
                  hideLabel
                  placeholder={i === 0 ? 'Bỏ trống nếu hôm đó không tiêm' : `Vắc xin thứ ${i + 1}`}
                  list="vaccine-names"
                  autoComplete="off"
                  maxLength={60}
                  value={v.text}
                  onChange={(e) => setVaccines((list) => list.map((x) => (x.key === v.key ? { ...x, text: e.target.value } : x)))}
                />
                <Button
                  type="button"
                  variant="secondary"
                  aria-label={`Bỏ vắc xin ${i + 1}`}
                  className="!px-0"
                  onClick={() => setVaccines((list) => (list.length > 1 ? list.filter((x) => x.key !== v.key) : [newRow()]))}
                >
                  <LineIcon icon="cancel" className="h-5 w-5" />
                </Button>
              </div>
            ))}
            <Button type="button" variant="secondary" onClick={() => setVaccines((list) => [...list, newRow()])}>
              + Thêm vắc xin
            </Button>
          </div>
          <datalist id="vaccine-names">
            {vaccineNames.map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>
          <p className={HINT}>Bỏ trống ô nào thì hôm đó không đo / không tiêm. 1 ngày tiêm nhiều mũi thì bấm "Thêm vắc xin".</p>

          {confirmDelete && <Alert type="error">Bấm thùng rác lần nữa để xoá thẻ này.</Alert>}
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
        saveLabel={isNew ? 'Thêm thẻ' : 'Lưu thay đổi'}
        deleteLabel="Xoá thẻ"
        onAskDelete={() => setConfirmDelete(true)}
        onCancelDelete={() => setConfirmDelete(false)}
        onDelete={handleDelete}
      />
    </PageShell>
  )
}

export function GrowthFormPageSkeleton({ isNew }: { isNew: boolean }) {
  return (
    <PageShell>
      <AppHeaderSkeleton />
      <GlassPanel className={`!p-5 ${FIT_CLASS}`}>
        <div className={FORM_CLASS}>
          <Skeleton className={`${SIZE.listItem} w-full`} />
          <TextFieldSkeleton />
          <div className="grid grid-cols-2 gap-3">
            <TextFieldSkeleton />
            <TextFieldSkeleton />
          </div>
          <div className="space-y-2">
            <Skeleton className={`${SIZE.label} w-16 rounded-md`} />
            <TextFieldSkeleton />
            <Skeleton className={`${SIZE.control} w-full`} />
          </div>
          <Skeleton className={`${SIZE.hint} w-full rounded-md`} />
        </div>
      </GlassPanel>
      <FabSkeleton count={isNew ? 1 : 2} />
    </PageShell>
  )
}
