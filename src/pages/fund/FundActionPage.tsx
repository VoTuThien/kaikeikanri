import { useState, type FormEvent } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { AppHeader, AppHeaderSkeleton } from '../../components/AppHeader'
import { FIT_CLASS, PageShell } from '../../components/PageShell'
import { Alert } from '../../components/ui/Alert'
import { Fab, FabGroup, FabSkeleton } from '../../components/ui/Fab'
import { GlassPanel } from '../../components/ui/GlassPanel'
import { MoneyField, MoneyFieldSkeleton } from '../../components/ui/MoneyField'
import { Segmented, SegmentedSkeleton } from '../../components/ui/Segmented'
import { Select } from '../../components/ui/Select'
import { Skeleton } from '../../components/ui/Skeleton'
import { TextField, TextFieldSkeleton } from '../../components/ui/TextField'
import { SIZE } from '../../components/ui/sizes'
import { formatMoney, fromDateInputValue, toDateInputValue } from '../../lib/format'
import { addTransaction, transferFunds } from './data/api'
import { getCachedSettings, useFund } from './data/FundContext'
import type { Fund } from './data/types'

// Nạp / Rút / Chuyển của 1 nhóm quỹ (mở khi chạm thẻ quỹ ở màn hình Nhóm quỹ), giống form Tạo lệnh chuyển:
// chọn loại, quỹ đang mở được điền sẵn (nạp: "Sang quỹ"; rút / chuyển: "Từ quỹ"), số tiền, ngày, ghi chú, FAB check để lưu.
// Ô quỹ luôn đủ 2 hàng (ô không dùng thì khoá lại) để chiều cao form không đổi khi đổi loại.

type Kind = 'deposit' | 'withdraw' | 'transfer'
const KINDS: { value: Kind; label: string }[] = [
  { value: 'deposit', label: 'Nạp' },
  { value: 'withdraw', label: 'Rút' },
  { value: 'transfer', label: 'Chuyển' },
]
const usesFrom = (k: Kind) => k !== 'deposit'
const usesTo = (k: Kind) => k !== 'withdraw'

const FORM_ID = 'fund-action-form'
const FORM_CLASS = 'space-y-3'
const ROW_2 = 'grid grid-cols-2 gap-3'
const QUICK_AMOUNTS = [
  { value: 100_000, label: '100K' },
  { value: 500_000, label: '500K' },
  { value: 1_000_000, label: '1 Tr' },
  { value: 5_000_000, label: '5 Tr' },
]

export function FundActionPage() {
  const { id } = useParams()
  const { loading, funds } = useFund()
  if (loading) return <FundActionPageSkeleton />
  const fund = funds.find((f) => f.id === id)
  if (!fund) return <Navigate to="/fund/groups" replace />
  return <FundAction key={fund.id} fund={fund} />
}

function FundAction({ fund }: { fund: Fund }) {
  const { actor, funds, settings, showMoney } = useFund()
  const other = funds.find((f) => f.id !== fund.id) ?? null

  const [kind, setKind] = useState<Kind>('deposit')
  const [fromId, setFromId] = useState(fund.id)
  const [toId, setToId] = useState(fund.id)
  const [amount, setAmount] = useState(0)
  const [dateText, setDateText] = useState(() => toDateInputValue(new Date()))
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [saving, setSaving] = useState(false)

  const byId = (id: string) => funds.find((f) => f.id === id) ?? fund
  const from = byId(fromId)
  const to = byId(toId)

  // Đổi loại: quỹ đang mở về đúng ô của loại đó (chuyển thì "Sang quỹ" là 1 quỹ khác)
  function changeKind(k: Kind) {
    setKind(k)
    setError('')
    setSuccess('')
    if (k === 'deposit') setToId(fund.id)
    if (k === 'withdraw') setFromId(fund.id)
    if (k === 'transfer') {
      setFromId(fund.id)
      setToId(other?.id ?? fund.id)
    }
  }
  // Chuyển: chọn trùng quỹ ở ô kia thì đổi chỗ 2 quỹ cho nhau
  function changeFrom(id: string) {
    if (kind === 'transfer' && id === toId) setToId(fromId)
    setFromId(id)
  }
  function changeTo(id: string) {
    if (kind === 'transfer' && id === fromId) setFromId(toId)
    setToId(id)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')
    if (amount <= 0) return setError('Vui lòng nhập số tiền.')
    if (!dateText) return setError('Vui lòng chọn ngày.')
    if (kind === 'transfer' && from.id === to.id) return setError('Cần có ít nhất 2 nhóm quỹ khác nhau để chuyển.')
    if (usesFrom(kind) && amount > from.balance) return setError(`Số dư quỹ không đủ. ${from.name} chỉ còn ${formatMoney(from.balance)}.`)

    setSaving(true)
    try {
      const date = fromDateInputValue(dateText)
      if (kind === 'deposit') await addTransaction(to.id, 'deposit', amount, date, note.trim(), actor)
      else if (kind === 'withdraw') await addTransaction(from.id, 'withdraw', amount, date, note.trim(), actor)
      else await transferFunds(from, to, amount, date, note.trim(), actor)
      setSuccess(
        kind === 'deposit'
          ? `Đã nạp ${formatMoney(amount)} vào ${to.name}.`
          : kind === 'withdraw'
            ? `Đã rút ${formatMoney(amount)} từ ${from.name}.`
            : `Đã chuyển ${formatMoney(amount)} từ ${from.name} sang ${to.name}.`,
      )
      setAmount(0)
      setNote('')
    } catch (err) {
      console.error(err)
      setError('Lưu thất bại. Vui lòng thử lại.')
    } finally {
      setSaving(false)
    }
  }

  const fundSelect = (id: string, label: string, value: Fund, onChange: (id: string) => void, enabled: boolean) => (
    // Ô không dùng với loại này: mờ đi và khoá lại
    <div className={`space-y-1.5 ${enabled ? '' : 'opacity-40'}`}>
      <Select id={id} label={label} value={enabled ? value.id : ''} disabled={!enabled} onChange={(e) => onChange(e.target.value)}>
        {!enabled && <option value="">Không dùng</option>}
        {funds.map((f) => (
          <option key={f.id} value={f.id}>
            {f.icon} {f.name}
          </option>
        ))}
      </Select>
      <p className={`${SIZE.label} truncate text-xs leading-5 text-white/60`}>
        {enabled && (
          <>
            Số dư hiện tại: <span className="font-semibold text-white">{showMoney(value.balance)}</span>
          </>
        )}
      </p>
    </div>
  )

  return (
    <PageShell>
      <AppHeader title={fund.name} backTo="/fund/groups" />
      <GlassPanel className={FIT_CLASS}>
        <form id={FORM_ID} onSubmit={handleSubmit} className={FORM_CLASS} noValidate>
          <Segmented options={KINDS} value={kind} onChange={changeKind} />
          {fundSelect('from', 'Từ quỹ', from, changeFrom, usesFrom(kind))}
          {fundSelect('to', 'Sang quỹ', to, changeTo, usesTo(kind))}

          <div className="space-y-2">
            <MoneyField id="amount" label="Số tiền" placeholder="0" value={amount} onChange={setAmount} />
            {settings.showQuickAmounts && (
              <Segmented options={QUICK_AMOUNTS} value={QUICK_AMOUNTS.some((q) => q.value === amount) ? amount : null} onChange={setAmount} />
            )}
          </div>

          {/* Ngày và ghi chú nằm cạnh nhau cho gọn */}
          <div className={ROW_2}>
            <TextField id="date" label="Ngày" type="date" value={dateText} onChange={(e) => setDateText(e.target.value)} />
            <TextField id="note" label="Ghi chú" placeholder="Không bắt buộc" value={note} onChange={(e) => setNote(e.target.value)} maxLength={100} />
          </div>

          {error && <Alert type="error">{error}</Alert>}
          {success && <Alert type="success">{success}</Alert>}
        </form>
      </GlassPanel>
      <FabGroup>
        <Fab type="submit" form={FORM_ID} icon="save" label={KINDS.find((k) => k.value === kind)!.label + ' tiền'} loading={saving} />
      </FabGroup>
    </PageShell>
  )
}

export function FundActionPageSkeleton() {
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
          <SegmentedSkeleton count={KINDS.length} />
          {fundSelect}
          {fundSelect}
          <div className="space-y-2">
            <MoneyFieldSkeleton />
            {showQuickAmounts && <SegmentedSkeleton count={QUICK_AMOUNTS.length} />}
          </div>
          <div className={ROW_2}>
            <TextFieldSkeleton />
            <TextFieldSkeleton />
          </div>
        </div>
      </GlassPanel>
      <FabSkeleton />
    </PageShell>
  )
}
