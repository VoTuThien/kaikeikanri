import { useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AppHeader, AppHeaderSkeleton } from '../../components/AppHeader'
import { FIT_CLASS, PageShell } from '../../components/PageShell'
import { Alert } from '../../components/ui/Alert'
import { Fab, FabGroup, FabSkeleton } from '../../components/ui/Fab'
import { GlassPanel } from '../../components/ui/GlassPanel'
import { Segmented, SegmentedSkeleton } from '../../components/ui/Segmented'
import { Select } from '../../components/ui/Select'
import { Skeleton } from '../../components/ui/Skeleton'
import { TextField, TextFieldSkeleton } from '../../components/ui/TextField'
import { SIZE } from '../../components/ui/sizes'
import { MoneyField, MoneyFieldSkeleton } from '../../components/ui/MoneyField'
import { formatMoney, fromDateInputValue } from '../../lib/format'
import { EmptyState, prefillAmount, prefillDate } from './components'
import { transferFunds } from './data/api'
import { getCachedSettings, useFund } from './data/FundContext'
import type { Fund } from './data/types'
import { submitForm, useUnsavedChanges } from '../../components/UnsavedGuard'

const FORM_ID = 'transfer-form'
// Thu gọn khoảng cách vì màn hình chuyển có 2 ô chọn quỹ (nhiều hơn màn hình nạp / rút 1 ô)
const FORM_CLASS = 'space-y-3'

const QUICK_AMOUNTS = [
  { value: 100_000, label: '100K' },
  { value: 500_000, label: '500K' },
  { value: 1_000_000, label: '1 Tr' },
  { value: 5_000_000, label: '5 Tr' },
]

export function TransferPage() {
  const { loading, funds } = useFund()
  if (loading) return <TransferPageSkeleton />

  if (funds.length < 2) {
    return (
      <PageShell>
        <AppHeader title="Chuyển quỹ" backTo="/fund" />
        <EmptyState
          icon="🔄"
          text="Cần có ít nhất 2 nhóm quỹ để chuyển tiền qua lại giữa các quỹ."
          action={{ to: '/fund/groups/new', label: '+ Tạo nhóm quỹ' }}
        />
      </PageShell>
    )
  }
  return <TransferForm />
}

function TransferForm() {
  const { actor, funds, settings, showMoney } = useFund()
  const [params] = useSearchParams()

  const [fromId, setFromId] = useState(() => {
    const fromUrl = params.get('fund')
    return funds.some((f) => f.id === fromUrl) ? fromUrl! : funds[0].id
  })
  const [toId, setToId] = useState(() => {
    const toUrl = params.get('to')
    return toUrl && toUrl !== fromId && funds.some((f) => f.id === toUrl) ? toUrl : funds.find((f) => f.id !== fromId)!.id
  })
  // Mở từ thẻ đã xoá ở Tra cứu: điền sẵn số tiền / ngày / ghi chú (lưu sẽ tạo giao dịch MỚI)
  const [amount, setAmount] = useState(() => prefillAmount(params))
  const [dateText, setDateText] = useState(() => prefillDate(params))
  const [note, setNote] = useState(() => params.get('note') ?? '')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [saving, setSaving] = useState(false)
  // Có thông tin chưa lưu (đã nhập số tiền mà chưa bấm lưu): chấm đỏ trên nút lưu, rời màn hình thì hỏi lại (UnsavedGuard)
  const dirty = amount > 0
  useUnsavedChanges(dirty && !saving, () => submitForm(FORM_ID))

  const from = funds.find((f) => f.id === fromId) ?? funds[0]
  const to = funds.find((f) => f.id === toId) ?? funds.find((f) => f.id !== from.id)!

  // Chọn quỹ nguồn trùng quỹ đích thì đổi chỗ 2 quỹ cho nhau
  function changeFrom(id: string) {
    if (id === to.id) setToId(from.id)
    setFromId(id)
  }
  function changeTo(id: string) {
    if (id === from.id) setFromId(to.id)
    setToId(id)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')
    if (from.id === to.id) return setError('Vui lòng chọn 2 quỹ khác nhau.')
    if (amount <= 0) return setError('Vui lòng nhập số tiền.')
    if (!dateText) return setError('Vui lòng chọn ngày.')
    if (amount > from.balance) return setError(`Số dư quỹ không đủ. ${from.name} chỉ còn ${formatMoney(from.balance)}.`)

    setSaving(true)
    try {
      await transferFunds(from, to, amount, fromDateInputValue(dateText), note.trim(), actor)
      setSuccess(`Đã chuyển ${formatMoney(amount)} từ ${from.name} sang ${to.name}.`)
      setAmount(0)
      setNote('')
    } catch (err) {
      console.error(err)
      setError('Chuyển tiền thất bại. Vui lòng thử lại.')
    } finally {
      setSaving(false)
    }
  }

  const fundSelect = (id: string, label: string, value: Fund, onChange: (id: string) => void) => (
    <div className="space-y-1.5">
      <Select id={id} label={label} value={value.id} onChange={(e) => onChange(e.target.value)}>
        {funds.map((f) => (
          <option key={f.id} value={f.id}>
            {f.icon} {f.name}
          </option>
        ))}
      </Select>
      <p className={`${SIZE.label} truncate text-xs leading-5 text-white/60`}>
        Số dư hiện tại: <span className="font-semibold text-white">{showMoney(value.balance)}</span>
      </p>
    </div>
  )

  return (
    <PageShell>
      <AppHeader title="Chuyển quỹ" backTo="/fund" />
      <GlassPanel className={FIT_CLASS}>
        <form id={FORM_ID} onSubmit={handleSubmit} className={FORM_CLASS} noValidate>
          {fundSelect('from', 'Từ quỹ', from, changeFrom)}
          {fundSelect('to', 'Sang quỹ', to, changeTo)}

          <div className="space-y-2">
            <MoneyField id="amount" label="Số tiền" placeholder="0" value={amount} onChange={setAmount} />
            {settings.showQuickAmounts && (
              <Segmented
                options={QUICK_AMOUNTS}
                value={QUICK_AMOUNTS.some((q) => q.value === amount) ? amount : null}
                onChange={setAmount}
              />
            )}
          </div>

          {/* Ngày và ghi chú nằm cạnh nhau cho gọn */}
          <div className="grid grid-cols-2 gap-3">
            <TextField id="date" label="Ngày" type="date" value={dateText} onChange={(e) => setDateText(e.target.value)} />
            <TextField
              id="note"
              label="Ghi chú"
              placeholder="Không bắt buộc"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={100}
            />
          </div>

          {error && <Alert type="error">{error}</Alert>}
          {success && <Alert type="success">{success}</Alert>}
        </form>
      </GlassPanel>
      <FabGroup>
        <Fab type="submit" form={FORM_ID} icon="save" label="Chuyển tiền" loading={saving} dirty={dirty} />
      </FabGroup>
    </PageShell>
  )
}

export function TransferPageSkeleton() {
  const { showQuickAmounts } = getCachedSettings()
  const fundSelect = (
    <div className="space-y-1.5">
      <TextFieldSkeleton />
      <Skeleton className={`${SIZE.label} w-40 rounded-md`} />
    </div>
  )
  return (
    <PageShell>
      <AppHeaderSkeleton />
      <GlassPanel className={FIT_CLASS}>
        <div className={FORM_CLASS}>
          {fundSelect}
          {fundSelect}
          <div className="space-y-2">
            <MoneyFieldSkeleton />
            {showQuickAmounts && <SegmentedSkeleton count={QUICK_AMOUNTS.length} />}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <TextFieldSkeleton />
            <TextFieldSkeleton />
          </div>
        </div>
      </GlassPanel>
      <FabSkeleton />
    </PageShell>
  )
}
