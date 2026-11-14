import { useState, type FormEvent } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { AppHeader, AppHeaderSkeleton } from '../../components/AppHeader'
import { FIT_CLASS, PageShell } from '../../components/PageShell'
import { Alert } from '../../components/ui/Alert'
import { FabSkeleton, SaveDeleteFabs } from '../../components/ui/Fab'
import { GlassPanel } from '../../components/ui/GlassPanel'
import { MoneyField, MoneyFieldSkeleton } from '../../components/ui/MoneyField'
import { Segmented, SegmentedSkeleton } from '../../components/ui/Segmented'
import { Select } from '../../components/ui/Select'
import { TextField, TextFieldSkeleton } from '../../components/ui/TextField'
import { NumberField } from '../../components/ui/NumberField'
import { CheckBox } from '../../components/ui/CheckBox'
import { Skeleton } from '../../components/ui/Skeleton'
import { SIZE } from '../../components/ui/sizes'
import { EmptyState, ORDER_TYPES } from './components'
import { useFund } from './data/FundContext'
import { createOrder, deleteOrder, updateOrder } from './data/orders'
import type { FundOrder, OrderType } from './data/types'
import { submitForm, useChanged, useUnsavedChanges } from '../../components/UnsavedGuard'

// Tạo / sửa 1 lệnh chuyển. Loại lệnh quyết định có ô "Từ quỹ" (chuyển, rút) và ô "Sang quỹ" (chuyển, nạp).
// Ô quỹ luôn chiếm đủ 2 hàng (ô không dùng thì khoá lại) để chiều cao form không đổi khi đổi loại lệnh.

const FORM_ID = 'order-form'
const FORM_CLASS = 'space-y-3'
// Số thứ tự là ô hẹp, ô số tiền chiếm phần còn lại cho rộng
const POS_ROW = 'grid grid-cols-[5.5rem_1fr] gap-3'

const usesFrom = (t: OrderType) => t !== 'deposit'
const usesTo = (t: OrderType) => t !== 'withdraw'

export function OrderFormPage() {
  const { id } = useParams()
  const { loading, funds, orders } = useFund()
  const isNew = !id
  if (loading) return <OrderFormPageSkeleton />

  const order = orders.find((o) => o.id === id)
  if (!isNew && !order) return <Navigate to="/fund/orders" replace />
  if (funds.length === 0) {
    return (
      <PageShell>
        <AppHeader title="Tạo lệnh chuyển" backTo="/fund/orders" />
        <EmptyState icon="🗂️" text="Bạn cần tạo nhóm quỹ trước khi soạn lệnh chuyển." action={{ to: '/fund/groups/new', label: '+ Tạo nhóm quỹ' }} />
      </PageShell>
    )
  }
  return <OrderForm key={id ?? 'new'} order={order} />
}

function OrderForm({ order }: { order?: FundOrder }) {
  const { actor, funds, orders } = useFund()
  const isNew = !order
  const ids = orders.map((o) => o.id)
  // Số thứ tự: tạo mới mặc định = tổng số lệnh tính cả lệnh đang thêm (đứng cuối); gõ lớn hơn thì tự đưa về số đó.
  // Đổi số thì các lệnh khác tự dời để số luôn liên tục, không trùng
  const count = isNew ? orders.length + 1 : orders.length

  const [type, setType] = useState<OrderType>(order?.type ?? 'transfer')
  const [fromId, setFromId] = useState(order?.fromFundId ?? funds[0].id)
  const [toId, setToId] = useState(order?.toFundId ?? (funds[1] ?? funds[0]).id)
  const [amount, setAmount] = useState(order?.amount ?? 0)
  const [position, setPosition] = useState(order?.position ?? count)
  // Chuyển / rút toàn bộ số dư của quỹ nguồn (lệnh nạp không dùng được)
  const [allBalance, setAllBalance] = useState(order?.allBalance ?? false)
  const useAll = allBalance && usesFrom(type)
  const [note, setNote] = useState(order?.note ?? '')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  // Có thay đổi chưa lưu: chấm đỏ trên nút lưu, rời màn hình thì hỏi lại (UnsavedGuard)
  const dirty = useChanged({ type, fromId, toId, amount, position, allBalance, note })
  const leave = useUnsavedChanges(dirty && !(saving || deleting), () => submitForm(FORM_ID))

  // Lệnh chuyển: chọn trùng quỹ ở ô kia thì đổi chỗ 2 quỹ cho nhau
  function changeFrom(id: string) {
    if (type === 'transfer' && id === toId) setToId(fromId)
    setFromId(id)
  }
  function changeTo(id: string) {
    if (type === 'transfer' && id === fromId) setFromId(toId)
    setToId(id)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (!useAll && amount <= 0) return setError('Vui lòng nhập số tiền.')
    if (type === 'transfer' && fromId === toId) return setError('Vui lòng chọn 2 quỹ khác nhau.')
    const known = (id: string) => funds.some((f) => f.id === id)
    if ((usesFrom(type) && !known(fromId)) || (usesTo(type) && !known(toId))) return setError('Vui lòng chọn lại quỹ.')

    setSaving(true)
    try {
      const input = {
        type,
        fromFundId: usesFrom(type) ? fromId : null,
        toFundId: usesTo(type) ? toId : null,
        amount: useAll ? 0 : amount,
        allBalance: useAll,
        note: note.trim(),
      }
      if (isNew) await createOrder(input, actor, ids, position)
      else await updateOrder(order.id, input, ids, position)
      leave('/fund/orders')
    } catch (err) {
      console.error(err)
      setError('Lưu thất bại. Vui lòng thử lại.')
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!order) return
    setDeleting(true)
    try {
      await deleteOrder(order.id, ids)
      leave('/fund/orders')
    } catch (err) {
      console.error(err)
      setError('Xoá thất bại. Vui lòng thử lại.')
      setDeleting(false)
    }
  }

  const fundSelect = (id: string, label: string, value: string, onChange: (id: string) => void, enabled: boolean) => (
    // Ô không dùng với loại lệnh này: mờ đi và khoá lại
    <div className={enabled ? '' : 'opacity-40'}>
      <Select id={id} label={label} value={enabled ? value : ''} disabled={!enabled} onChange={(e) => onChange(e.target.value)}>
        {!enabled && <option value="">Không dùng</option>}
        {/* Quỹ trong lệnh đã bị xoá: giữ 1 lựa chọn "Quỹ đã xoá" để người dùng chọn lại */}
        {enabled && !funds.some((f) => f.id === value) && <option value={value}>Quỹ đã xoá</option>}
        {funds.map((f) => (
          <option key={f.id} value={f.id}>
            {f.icon} {f.name}
          </option>
        ))}
      </Select>
    </div>
  )

  return (
    <PageShell>
      <AppHeader title={isNew ? 'Tạo lệnh chuyển' : 'Sửa lệnh chuyển'} backTo="/fund/orders" />
      <GlassPanel className={FIT_CLASS}>
        <form id={FORM_ID} onSubmit={handleSubmit} className={FORM_CLASS} noValidate>
          <Segmented options={ORDER_TYPES} value={type} onChange={setType} />
          {fundSelect('from', 'Từ quỹ', fromId, changeFrom, usesFrom(type))}
          {fundSelect('to', 'Sang quỹ', toId, changeTo, usesTo(type))}
          {/* Số thứ tự (ô hẹp) + số tiền (ô rộng); chọn "toàn bộ số dư" thì không cần nhập số tiền */}
          <div className={POS_ROW}>
            <NumberField id="position" label="Số thứ tự" value={position} onChange={setPosition} max={count} />
            <div className={useAll ? 'opacity-40' : ''}>
              <MoneyField
                id="amount"
                label="Số tiền"
                placeholder={useAll ? 'Toàn bộ' : '0'}
                value={useAll ? 0 : amount}
                onChange={setAmount}
                disabled={useAll}
              />
            </div>
          </div>
          <CheckBox
            checked={useAll}
            onChange={setAllBalance}
            disabled={!usesFrom(type)}
            label={type === 'withdraw' ? 'Rút toàn bộ số dư' : 'Chuyển toàn bộ số dư'}
            hint={usesFrom(type) ? 'Lấy hết số dư của quỹ nguồn lúc chạy lệnh' : 'Lệnh nạp không dùng được'}
          />
          <TextField
            id="note"
            label="Ghi chú (không bắt buộc)"
            placeholder="Ví dụ: Tiền học của con"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={100}
          />
          {error && <Alert type="error">{error}</Alert>}
          {confirmDelete && <Alert type="error">Bấm thùng rác lần nữa để xoá lệnh này.</Alert>}
        </form>
      </GlassPanel>
      <SaveDeleteFabs
        dirty={dirty}
        formId={FORM_ID}
        canDelete={!isNew}
        confirming={confirmDelete}
        saving={saving}
        deleting={deleting}
        saveLabel={isNew ? 'Tạo lệnh chuyển' : 'Lưu thay đổi'}
        deleteLabel="Xoá lệnh chuyển"
        onAskDelete={() => setConfirmDelete(true)}
        onCancelDelete={() => setConfirmDelete(false)}
        onDelete={handleDelete}
      />
    </PageShell>
  )
}

export function OrderFormPageSkeleton() {
  const isNew = !useParams().id
  return (
    <PageShell>
      <AppHeaderSkeleton />
      <GlassPanel className={FIT_CLASS}>
        <div className={FORM_CLASS}>
          <SegmentedSkeleton count={ORDER_TYPES.length} />
          <TextFieldSkeleton />
          <TextFieldSkeleton />
          <div className={POS_ROW}>
            <TextFieldSkeleton />
            <MoneyFieldSkeleton />
          </div>
          <div className={`${SIZE.control} flex items-center gap-2.5`}>
            <Skeleton className="h-6 w-6 rounded-md" />
            <Skeleton className="h-9 w-44 rounded-md" />
          </div>
          <TextFieldSkeleton />
        </div>
      </GlassPanel>
      <FabSkeleton count={isNew ? 1 : 2} />
    </PageShell>
  )
}
