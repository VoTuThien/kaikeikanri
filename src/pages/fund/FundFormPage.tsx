import { useState, type FormEvent } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { AppHeader, AppHeaderSkeleton } from '../../components/AppHeader'
import { FIT_CLASS, PageShell } from '../../components/PageShell'
import { Alert } from '../../components/ui/Alert'
import { FabSkeleton, SaveDeleteFabs } from '../../components/ui/Fab'
import { GlassPanel } from '../../components/ui/GlassPanel'
import { Icon3D } from '../../components/ui/Icon3D'
import { Skeleton } from '../../components/ui/Skeleton'
import { BLOCK_3D, GLOSS_3D, TILE_3D, TILE_3D_SELECTED } from '../../components/ui/style3d'
import { FieldLabel, TextField, TextFieldSkeleton } from '../../components/ui/TextField'
import { NumberField } from '../../components/ui/NumberField'
import { SIZE } from '../../components/ui/sizes'
import { MoneyField, MoneyFieldSkeleton } from '../../components/ui/MoneyField'
import { formatDate, formatMoney } from '../../lib/format'
import { createFund, deleteFund, updateFund } from './data/api'
import { useFund } from './data/FundContext'
import { nextInterestDate, projectBalance } from './data/interest'
import type { Fund } from './data/types'
import { submitForm, useChanged, useUnsavedChanges } from '../../components/UnsavedGuard'

const ICONS = [
  '💰', '🏠', '🦔', '✈️', '🎓', '🚗',
  '🏥', '🎁', '🛒', '💍', '📈', '🐷',
  // May mắn, lì xì Tết, sinh nhật, ăn uống, thú cưng, hoá đơn
  '🍀', '🧧', '🎂', '🍜', '🐶', '🧾',
]
const COLORS = [
  'from-amber-400 to-orange-500',
  'from-sky-400 to-blue-600',
  'from-emerald-400 to-teal-600',
  'from-pink-400 to-rose-600',
  'from-violet-400 to-purple-600',
  'from-slate-400 to-slate-600',
]

// Lưới 6 cột cho chọn biểu tượng và màu: mọi ô cùng kích thước, thẳng cột với nhau
const PICKER_GRID = 'grid grid-cols-6 gap-2'
// Thu gọn khoảng cách để form vừa 1 màn hình iPhone
const PANEL_CLASS = '!p-5'
const FORM_CLASS = 'space-y-3'
const FORM_ID = 'fund-form'
// Tên (ô rộng) + số thứ tự (ô hẹp) trên 1 hàng
const NAME_ROW = 'grid grid-cols-[1fr_5.5rem] gap-3'

export function FundFormPage() {
  const { id } = useParams()
  const { loading, funds } = useFund()
  const isNew = !id
  if (loading) return <FundFormPageSkeleton isNew={isNew} />

  const fund = funds.find((f) => f.id === id)
  if (!isNew && !fund) return <Navigate to="/fund/groups" replace />
  return <FundForm key={id ?? 'new'} fund={fund} />
}

function FundForm({ fund }: { fund?: Fund }) {
  const { actor, settings, funds } = useFund()
  const isNew = !fund
  const ids = funds.map((f) => f.id)
  // Số thứ tự: tạo mới mặc định = tổng số quỹ tính cả quỹ đang thêm (đứng cuối); gõ lớn hơn thì tự đưa về số đó
  const count = isNew ? funds.length + 1 : funds.length
  const [position, setPosition] = useState(fund?.position ?? count)

  const [name, setName] = useState(fund?.name ?? '')
  const [icon, setIcon] = useState(fund?.icon ?? ICONS[0])
  const [color, setColor] = useState(fund?.color ?? COLORS[0])
  const [rateText, setRateText] = useState(String(fund?.interestRate ?? settings.defaultInterestRate))
  const [initialBalance, setInitialBalance] = useState(0)
  const [transferred, setTransferred] = useState(fund?.transferred ?? false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  // Có thay đổi chưa lưu: chấm đỏ trên nút lưu, rời màn hình thì hỏi lại (UnsavedGuard)
  const dirty = useChanged({ position, name, icon, color, rateText, initialBalance, transferred })
  const leave = useUnsavedChanges(dirty && !(saving || deleting), () => submitForm(FORM_ID))

  const rate = Number(rateText.replace(',', '.'))
  const baseBalance = isNew ? initialBalance : fund.balance
  const next = fund && nextInterestDate(fund)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (!name.trim()) return setError('Vui lòng nhập tên nhóm quỹ.')
    if (!Number.isFinite(rate) || rate < 0 || rate > 100) return setError('Lãi suất phải từ 0 đến 100 %/năm.')

    setSaving(true)
    try {
      const input = { name: name.trim(), icon, color, interestRate: rate, transferred }
      if (isNew) await createFund(input, initialBalance, actor, ids, position)
      else await updateFund(fund, input, ids, position)
      leave('/fund/groups')
    } catch (err) {
      console.error(err)
      setError('Lưu thất bại. Vui lòng thử lại.')
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!fund) return
    setDeleting(true)
    try {
      await deleteFund(fund.id, ids)
      leave('/fund/groups')
    } catch (err) {
      console.error(err)
      setError('Xoá thất bại. Vui lòng thử lại.')
      setDeleting(false)
    }
  }

  return (
    <PageShell>
      <AppHeader title={isNew ? 'Tạo nhóm quỹ' : 'Sửa nhóm quỹ'} backTo="/fund/groups" />
      <GlassPanel className={`${PANEL_CLASS} ${FIT_CLASS}`}>
        <form id={FORM_ID} onSubmit={handleSubmit} className={FORM_CLASS} noValidate>
          {/* Tên + số thứ tự trên 1 hàng; đổi số thì các quỹ khác tự dời để số luôn liên tục, không trùng */}
          <div className={NAME_ROW}>
            <TextField
              id="name"
              label="Tên nhóm quỹ"
              placeholder="Ví dụ: Quỹ du lịch"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={40}
            />
            <NumberField id="position" label="Số thứ tự" value={position} onChange={setPosition} max={count} />
          </div>

          <div className="space-y-1.5">
            <FieldLabel>Biểu tượng</FieldLabel>
            <div className={PICKER_GRID}>
              {ICONS.map((i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setIcon(i)}
                  aria-pressed={i === icon}
                  className={`${SIZE.control} flex items-center justify-center rounded-none transition duration-150 ${
                    i === icon ? TILE_3D_SELECTED : TILE_3D
                  }`}
                >
                  <Icon3D emoji={i} className={`h-8 w-8 transition-transform ${i === icon ? 'scale-110' : ''}`} />
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <FieldLabel>Màu</FieldLabel>
            <div className={PICKER_GRID}>
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  aria-pressed={c === color}
                  aria-label={`Màu ${c}`}
                  className={`${SIZE.control} relative rounded-xl bg-gradient-to-br transition duration-150 active:translate-y-0.5 ${c} ${BLOCK_3D} ${
                    c === color ? '-translate-y-0.5 ring-2 ring-white ring-offset-2 ring-offset-indigo-900' : ''
                  }`}
                >
                  <span className={GLOSS_3D} />
                </button>
              ))}
            </div>
          </div>

          {/* Tạo mới: lãi suất và số dư ban đầu nằm cạnh nhau cho gọn */}
          <div className={isNew ? 'grid grid-cols-2 gap-3' : ''}>
            <TextField
              id="rate"
              label="Lãi suất"
              suffix="%/năm"
              inputMode="decimal"
              placeholder="0"
              value={rateText}
              onChange={(e) => setRateText(e.target.value.replace(/[^\d.,]/g, ''))}
            />
            {isNew && (
              <MoneyField
                id="initial"
                label="Số dư ban đầu"
                placeholder="0"
                value={initialBalance}
                onChange={setInitialBalance}
              />
            )}
          </div>

          {/* Ô check "Đã chuyển đi"; bên phải chừa chỗ cho nút nổi */}
          <div className={`${SIZE.control} flex items-center pr-36`}>
            <button
              type="button"
              role="checkbox"
              aria-checked={transferred}
              onClick={() => setTransferred((v) => !v)}
              className="flex min-w-0 items-center gap-2.5 text-left"
            >
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 transition ${
                  transferred ? 'border-emerald-300 bg-emerald-400' : 'border-white/50 bg-white/5'
                }`}
              >
                {transferred && (
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="#ffffff" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M5 12.5l4.5 4.5L19 7" />
                  </svg>
                )}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm leading-5 font-semibold">Đã chuyển đi</span>
                <span className="block truncate text-xs leading-4 text-white/60">
                  {transferred ? 'Không tính vào tổng số dư' : 'Tiền vẫn trong tài khoản'}
                </span>
              </span>
            </button>
          </div>

          {/* Luôn 2 dòng để chiều cao không đổi khi nhập */}
          <div className={`${SIZE.hint} text-xs leading-5 text-white/60`}>
            <p className={`truncate ${confirmDelete ? 'text-rose-100' : ''}`}>
              {confirmDelete
                ? 'Bấm thùng rác lần nữa để xoá quỹ và cả lịch sử.'
                : rate > 0
                  ? 'Lãi được cộng dồn vào quỹ mỗi tháng (lãi kép).'
                  : 'Để 0 nếu quỹ này không có lãi.'}
            </p>
            <p className="truncate">
              {rate > 0 && baseBalance > 0
                ? `Ước tính sau 12 tháng: ${formatMoney(projectBalance(baseBalance, rate, 12))}`
                : next
                  ? `Lần cộng lãi tiếp theo: ${formatDate(next)}`
                  : ''}
            </p>
          </div>

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
        saveLabel={isNew ? 'Tạo nhóm quỹ' : 'Lưu thay đổi'}
        deleteLabel="Xoá nhóm quỹ"
        onAskDelete={() => setConfirmDelete(true)}
        onCancelDelete={() => setConfirmDelete(false)}
        onDelete={handleDelete}
      />
    </PageShell>
  )
}

export function FundFormPageSkeleton({ isNew }: { isNew: boolean }) {
  const picker = (n: number) => (
    <div className="space-y-1.5">
      <Skeleton className={`${SIZE.label} w-20 rounded-md`} />
      <div className={PICKER_GRID}>
        {Array.from({ length: n }, (_, i) => (
          <Skeleton key={i} className={SIZE.control} />
        ))}
      </div>
    </div>
  )
  return (
    <PageShell>
      <AppHeaderSkeleton />
      <GlassPanel className={`${PANEL_CLASS} ${FIT_CLASS}`}>
        <div className={FORM_CLASS}>
          <div className={NAME_ROW}>
            <TextFieldSkeleton />
            <TextFieldSkeleton />
          </div>
          {picker(ICONS.length)}
          {picker(COLORS.length)}
          <div className={isNew ? 'grid grid-cols-2 gap-3' : ''}>
            <TextFieldSkeleton />
            {isNew && <MoneyFieldSkeleton />}
          </div>
          <div className={`${SIZE.control} flex items-center gap-2.5`}>
            <Skeleton className="h-6 w-6 rounded-md" />
            <Skeleton className="h-9 w-40 rounded-md" />
          </div>
          <div className={`${SIZE.hint} space-y-1`}>
            <Skeleton className="h-4 w-56 rounded-md" />
            <Skeleton className="h-4 w-44 rounded-md" />
          </div>
        </div>
      </GlassPanel>
      <FabSkeleton count={isNew ? 1 : 2} />
    </PageShell>
  )
}
