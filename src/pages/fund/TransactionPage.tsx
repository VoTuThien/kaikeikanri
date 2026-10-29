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
import { MoneyField } from '../../components/ui/MoneyField'
import { formatMoney, fromDateInputValue, toDateInputValue } from '../../lib/format'
import { EmptyState } from './components'
import { addTransaction } from './data/api'
import { getCachedSettings, useFund } from './data/FundContext'

type Kind = 'deposit' | 'withdraw'

const TEXT: Record<Kind, { title: string; button: string; done: string; preposition: string }> = {
  deposit: { title: 'Nạp vào quỹ', button: 'Nạp tiền', done: 'Đã nạp', preposition: 'vào' },
  withdraw: { title: 'Rút từ quỹ', button: 'Rút tiền', done: 'Đã rút', preposition: 'từ' },
}

const FORM_ID = 'transaction-form'

const QUICK_AMOUNTS = [
  { value: 100_000, label: '100K' },
  { value: 500_000, label: '500K' },
  { value: 1_000_000, label: '1 Tr' },
  { value: 5_000_000, label: '5 Tr' },
]

export function TransactionPage({ kind }: { kind: Kind }) {
  const { loading, funds } = useFund()
  if (loading) return <TransactionPageSkeleton kind={kind} />

  if (funds.length === 0) {
    return (
      <PageShell>
        <AppHeader title={TEXT[kind].title} backTo="/fund" />
        <EmptyState
          icon="🗂️"
          text="Bạn cần tạo nhóm quỹ trước khi nạp hoặc rút tiền."
          action={{ to: '/fund/groups/new', label: '+ Tạo nhóm quỹ' }}
        />
      </PageShell>
    )
  }
  return <TransactionForm key={kind} kind={kind} />
}

function TransactionForm({ kind }: { kind: Kind }) {
  const { actor, funds, settings, showMoney } = useFund()
  const [params] = useSearchParams()
  const text = TEXT[kind]

  const [fundId, setFundId] = useState(() => {
    const fromUrl = params.get('fund')
    return funds.some((f) => f.id === fromUrl) ? fromUrl! : funds[0].id
  })
  const [amount, setAmount] = useState(0)
  const [dateText, setDateText] = useState(() => toDateInputValue(new Date()))
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [saving, setSaving] = useState(false)

  const fund = funds.find((f) => f.id === fundId) ?? funds[0]

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')
    if (amount <= 0) return setError('Vui lòng nhập số tiền.')
    if (!dateText) return setError('Vui lòng chọn ngày.')
    if (kind === 'withdraw' && amount > fund.balance) {
      return setError(`Số dư quỹ không đủ. Quỹ chỉ còn ${formatMoney(fund.balance)}.`)
    }

    setSaving(true)
    try {
      await addTransaction(fund.id, kind, amount, fromDateInputValue(dateText), note.trim(), actor)
      setSuccess(`${text.done} ${formatMoney(amount)} ${text.preposition} ${fund.name}.`)
      setAmount(0)
      setNote('')
    } catch (err) {
      console.error(err)
      setError('Lưu thất bại. Vui lòng thử lại.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <PageShell>
      <AppHeader title={text.title} backTo="/fund" />
      <GlassPanel className={FIT_CLASS}>
        <form id={FORM_ID} onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Select id="fund" label="Nhóm quỹ" value={fund.id} onChange={(e) => setFundId(e.target.value)}>
              {funds.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.icon} {f.name}
                </option>
              ))}
            </Select>
            <p className={`${SIZE.label} truncate text-xs leading-5 text-white/60`}>
              Số dư hiện tại: <span className="font-semibold text-white">{showMoney(fund.balance)}</span>
            </p>
          </div>

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

          <TextField
            id="date"
            label="Ngày"
            type="date"
            value={dateText}
            onChange={(e) => setDateText(e.target.value)}
          />

          <TextField
            id="note"
            label="Ghi chú (không bắt buộc)"
            placeholder={kind === 'deposit' ? 'Ví dụ: Lương tháng 10' : 'Ví dụ: Đóng học phí'}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={100}
          />

          {error && <Alert type="error">{error}</Alert>}
          {success && <Alert type="success">{success}</Alert>}
        </form>
      </GlassPanel>
      <FabGroup>
        <Fab type="submit" form={FORM_ID} icon="save" label={text.button} loading={saving} />
      </FabGroup>
    </PageShell>
  )
}

export function TransactionPageSkeleton({ kind }: { kind: Kind }) {
  const { showQuickAmounts } = getCachedSettings()
  return (
    <PageShell>
      <AppHeaderSkeleton key={kind} />
      <GlassPanel className={FIT_CLASS}>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <TextFieldSkeleton />
            <Skeleton className={`${SIZE.label} w-40 rounded-md`} />
          </div>
          <div className="space-y-2">
            <TextFieldSkeleton />
            {showQuickAmounts && <SegmentedSkeleton count={QUICK_AMOUNTS.length} />}
          </div>
          <TextFieldSkeleton />
          <TextFieldSkeleton />
        </div>
      </GlassPanel>
      <FabSkeleton />
    </PageShell>
  )
}
