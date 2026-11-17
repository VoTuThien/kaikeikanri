import { useState, type FormEvent } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { AppHeader, AppHeaderSkeleton } from '../../components/AppHeader'
import { FIT_CLASS, PageShell } from '../../components/PageShell'
import { Alert } from '../../components/ui/Alert'
import { CheckBox } from '../../components/ui/CheckBox'
import { FabSkeleton, SaveDeleteFabs } from '../../components/ui/Fab'
import { GlassPanel } from '../../components/ui/GlassPanel'
import { Skeleton } from '../../components/ui/Skeleton'
import { TextField, TextFieldSkeleton } from '../../components/ui/TextField'
import { SIZE } from '../../components/ui/sizes'
import { ChildAvatar } from './components'
import { useBaby } from './data/BabyContext'
import {
  ageAtDate,
  cleanShots,
  createGrowth,
  deleteGrowth,
  HEIGHT_RANGE,
  lastShot,
  measureText,
  nextDose,
  parseMeasure,
  todayText,
  updateGrowth,
  useAllGrowth,
  WEIGHT_RANGE,
  type GrowthRecord,
  type VaccineShot,
} from './data/growth'
import { newShotRow, VaccineFields, type ShotRow } from './VaccineFields'
import type { Child } from './data/types'
import { submitForm, useChanged, useUnsavedChanges } from '../../components/UnsavedGuard'

// Tạo / sửa 1 thẻ phát triển (/baby/growth/new, /baby/growth/:id): ngày, chiều cao, cân nặng, các mũi vắc xin.
// Thẻ mới thuộc CON ĐANG CHỌN. Ô check "Có tiêm vắc xin": check thì hiện các khung nhập mũi tiêm (VaccineFields: phòng bệnh, vaccine,
// mũi, nơi tiêm, giá; 1 ngày tiêm được NHIỀU mũi); không check = hôm đó không tiêm. Dưới tên con hiện tuổi của con vào ngày thực hiện (theo tháng).

const FORM_ID = 'growth-form'
const FORM_CLASS = 'space-y-3'
const CHILD_ROW = `${SIZE.listItem} flex items-center gap-3 border border-white/15 bg-white/5 px-3`
const HINT = `${SIZE.hint} text-xs leading-5 text-white/60`

// Mũi tiêm đã lưu -> khung nhập
const toRow = (v: VaccineShot) => newShotRow({ disease: v.disease, name: v.name, doseText: v.dose ? String(v.dose) : '', price: v.price, place: v.place })
// Khung nhập -> mũi tiêm (bỏ khung trống)
const toShots = (rows: ShotRow[]) =>
  cleanShots(rows.map((r) => ({ disease: r.disease, name: r.name, dose: Number(r.doseText) || null, price: r.price, place: r.place })))
const uniq = (list: string[]) => [...new Set(list.map((v) => v.trim()).filter(Boolean))]

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

  // Gợi ý khi gõ: những gì cả gia đình đã từng nhập
  const shots = all.flatMap((r) => r.vaccines)
  const suggest = { diseases: uniq(shots.map((v) => v.disease)), names: uniq(shots.map((v) => v.name)), places: uniq(shots.map((v) => v.place)) }
  // Các thẻ của con này: tính mũi thứ mấy, điền sẵn theo lần tiêm trước
  const childRecords = all.filter((r) => r.childId === (record?.childId ?? owner?.id))
  return <GrowthForm key={id ?? 'new'} record={record} owner={owner} suggest={suggest} childRecords={childRecords} />
}

function GrowthForm({
  record,
  owner,
  suggest,
  childRecords,
}: {
  record?: GrowthRecord
  owner: Child | null
  suggest: { diseases: string[]; names: string[]; places: string[] }
  childRecords: GrowthRecord[]
}) {
  const { actor } = useBaby()
  const isNew = !record

  const [date, setDate] = useState(record?.date ?? todayText())
  const [heightText, setHeightText] = useState(measureText(record?.height ?? null))
  const [weightText, setWeightText] = useState(measureText(record?.weight ?? null))
  // Có tiêm vắc xin không; các khung nhập mũi tiêm (luôn có ít nhất 1 khung)
  const [hasVaccine, setHasVaccine] = useState(!!record?.vaccines.length)
  const [rows, setRows] = useState<ShotRow[]>(() => (record?.vaccines.length ? record.vaccines.map(toRow) : [newShotRow()]))
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  // Có thay đổi chưa lưu: chấm đỏ trên nút lưu, rời màn hình thì hỏi lại (UnsavedGuard)
  const dirty = useChanged({ date, heightText, weightText, vaccines: hasVaccine ? toShots(rows) : [] })
  const age = owner ? ageAtDate(owner.birthDate, date) : ''
  const leave = useUnsavedChanges(dirty && !(saving || deleting), () => submitForm(FORM_ID))

  // Rời ô "Phòng bệnh": điền sẵn mũi thứ mấy + tên vaccine / nơi tiêm / giá theo lần tiêm gần nhất cùng bệnh (ô nào đã có thì giữ)
  function fillFromHistory(key: string) {
    setRows((list) =>
      list.map((r) => {
        if (r.key !== key || !r.disease.trim()) return r
        const last = lastShot(childRecords, r.disease, record?.id)
        const dose = nextDose(childRecords, r.disease, date, record?.id)
        return {
          ...r,
          doseText: r.doseText || (dose ? String(dose) : ''),
          name: r.name || last?.name || '',
          place: r.place || last?.place || '',
          price: r.price || last?.price || 0,
        }
      }),
    )
  }

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
    const vaccines = hasVaccine ? toShots(rows) : []
    if (hasVaccine && vaccines.length === 0) return setError('Nhập phòng bệnh hoặc tên vaccine của mũi tiêm (hoặc bỏ check "Có tiêm vắc xin").')
    if (height === null && weight === null && vaccines.length === 0) return setError('Nhập ít nhất chiều cao, cân nặng hoặc 1 mũi vắc xin.')
    const childId = record?.childId ?? owner?.id
    if (!childId) return setError('Chưa chọn con.')

    setSaving(true)
    try {
      const input = {
        childId,
        date,
        height: height === null ? null : Math.round(height * 10) / 10,
        weight: weight === null ? null : Math.round(weight * 100) / 100,
        vaccines,
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

          {/* Có tiêm vắc xin: check thì hiện các khung nhập mũi tiêm */}
          <CheckBox
            checked={hasVaccine}
            onChange={setHasVaccine}
            label="Có tiêm vắc xin"
            hint={hasVaccine ? 'Phòng bệnh, vaccine, mũi, nơi tiêm, giá' : 'Không check = hôm đó không tiêm'}
          />
          {hasVaccine && <VaccineFields rows={rows} onChange={setRows} onDiseaseDone={fillFromHistory} suggest={suggest} />}
          <p className={HINT}>Bỏ trống chiều cao / cân nặng nếu hôm đó không đo. 1 ngày tiêm nhiều mũi thì bấm "Thêm vắc xin".</p>

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
          <Skeleton className={`${SIZE.control} w-full`} />
          <Skeleton className={`${SIZE.hint} w-full rounded-md`} />
        </div>
      </GlassPanel>
      <FabSkeleton count={isNew ? 1 : 2} />
    </PageShell>
  )
}
