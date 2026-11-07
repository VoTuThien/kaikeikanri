import { useEffect, useRef, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { AppHeader, AppHeaderSkeleton } from '../../components/AppHeader'
import { FIT_CLASS, PageShell } from '../../components/PageShell'
import { Alert } from '../../components/ui/Alert'
import { Fab, FabGroup, FabSkeleton } from '../../components/ui/Fab'
import { GlassPanel } from '../../components/ui/GlassPanel'
import { Icon3D } from '../../components/ui/Icon3D'
import { MoneyField, MoneyFieldSkeleton } from '../../components/ui/MoneyField'
import { Segmented } from '../../components/ui/Segmented'
import { Select } from '../../components/ui/Select'
import { Skeleton } from '../../components/ui/Skeleton'
import { TextField, TextFieldSkeleton } from '../../components/ui/TextField'
import { SIZE } from '../../components/ui/sizes'
import { formatMoney, formatMoneyCompact, fromDateInputValue, toDateInputValue } from '../../lib/format'
import { EmptyState } from './components'
import { addTransaction } from './data/api'
import { useFund } from './data/FundContext'
import { readReceiptText, stopOcr, type OcrProgress } from './data/receipt'
import { parseReceipt } from './data/receiptParse'

// Đọc hoá đơn (/fund/receipt): chụp / chọn ảnh hoá đơn -> đọc chữ NGAY TRÊN MÁY (Tesseract.js, miễn phí, ảnh không gửi đi đâu)
// -> tự điền số tiền (ưu tiên dòng "Tổng cộng / Thanh toán..."), ngày, ghi chú "Hoá đơn <tên cửa hàng>" vào form RÚT QUỸ.
// Đọc sai thì chạm chọn số khác trong "Số tiền tìm thấy" hoặc sửa tay; bấm FAB check để rút (giống màn hình Rút quỹ).

const FORM_ID = 'receipt-form'
const PHOTO = 'h-24' // hàng ảnh hoá đơn (thật + skeleton)

export function ReceiptPage() {
  const { loading, funds } = useFund()
  // Rời màn hình: tắt bộ đọc chữ để giải phóng bộ nhớ
  useEffect(() => () => void stopOcr(), [])
  if (loading) return <ReceiptPageSkeleton />
  if (funds.length === 0) {
    return (
      <PageShell>
        <AppHeader title="Đọc hoá đơn" backTo="/fund" />
        <EmptyState icon="🗂️" text="Bạn cần tạo nhóm quỹ trước khi rút tiền." action={{ to: '/fund/groups/new', label: '+ Tạo nhóm quỹ' }} />
      </PageShell>
    )
  }
  return <ReceiptForm />
}

function ReceiptForm() {
  const { actor, funds, showMoney } = useFund()
  const fileRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [reading, setReading] = useState<OcrProgress | null>(null)
  const [text, setText] = useState('')
  const [showText, setShowText] = useState(false)
  const [amounts, setAmounts] = useState<number[]>([])
  const [fundId, setFundId] = useState(funds[0].id)
  const [amount, setAmount] = useState(0)
  const [dateText, setDateText] = useState(() => toDateInputValue(new Date()))
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [saving, setSaving] = useState(false)
  const fund = funds.find((f) => f.id === fundId) ?? funds[0]

  async function onFile(file: File | undefined) {
    if (!file) return
    setError('')
    setSuccess('')
    setText('')
    setAmounts([])
    setReading({ status: 'Đang xử lý ảnh', progress: 0 })
    try {
      const result = await readReceiptText(file, setReading)
      setPreview(result.preview)
      setText(result.text)
      const r = parseReceipt(result.text)
      setAmounts(r.amounts)
      setAmount(r.amounts[0] ?? 0)
      if (r.date) setDateText(toDateInputValue(r.date))
      setNote((r.store ? `Hoá đơn ${r.store}` : 'Hoá đơn').slice(0, 100))
      if (r.amounts.length === 0) setError('Không tìm thấy số tiền trên ảnh. Hãy chụp rõ, thẳng hoá đơn hoặc nhập tay.')
    } catch (err) {
      console.error(err)
      setError('Không đọc được ảnh. Kiểm tra mạng (lần đầu cần tải bộ đọc chữ) rồi thử lại.')
    } finally {
      setReading(null)
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')
    if (amount <= 0) return setError('Vui lòng nhập số tiền.')
    if (!dateText) return setError('Vui lòng chọn ngày.')
    if (amount > fund.balance) return setError(`Số dư quỹ không đủ. Quỹ chỉ còn ${formatMoney(fund.balance)}.`)
    setSaving(true)
    try {
      await addTransaction(fund.id, 'withdraw', amount, fromDateInputValue(dateText), note.trim(), actor)
      setSuccess(`Đã rút ${formatMoney(amount)} từ ${fund.name}.`)
      // Xong 1 hoá đơn: dọn form để đọc hoá đơn tiếp theo
      setPreview(null)
      setText('')
      setAmounts([])
      setAmount(0)
      setNote('')
    } catch (err) {
      console.error(err)
      setError('Lưu thất bại. Vui lòng thử lại.')
    } finally {
      setSaving(false)
    }
  }

  const options = amounts.map((v) => ({ value: v, label: formatMoneyCompact(v) }))

  return (
    <PageShell>
      <AppHeader title="Đọc hoá đơn" backTo="/fund" />
      <GlassPanel className={FIT_CLASS}>
        <form id={FORM_ID} onSubmit={handleSubmit} className="space-y-3" noValidate>
          {/* Ảnh hoá đơn: chạm để chụp / chọn ảnh (thư viện hoặc máy ảnh) */}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              void onFile(e.target.files?.[0])
              e.target.value = '' // chọn lại cùng 1 ảnh vẫn đọc lại
            }}
          />
          <div className={`${PHOTO} flex items-center gap-3`}>
            <button
              type="button"
              disabled={!!reading}
              onClick={() => fileRef.current?.click()}
              aria-label={preview ? 'Chụp / chọn hoá đơn khác' : 'Chụp / chọn ảnh hoá đơn'}
              className={`flex h-24 w-[4.5rem] shrink-0 items-center justify-center overflow-hidden rounded-xl transition active:scale-95 ${
                preview ? 'border border-white/30' : 'border-2 border-dashed border-white/40 bg-white/5'
              }`}
            >
              {preview ? <img src={preview} alt="Ảnh hoá đơn" className="block h-full w-full object-cover" /> : <Icon3D emoji="📷" className="h-9 w-9" />}
            </button>
            <div className="min-w-0 flex-1 space-y-1.5">
              {reading ? (
                <>
                  <p className="truncate text-sm leading-5 font-semibold">{reading.status}…</p>
                  <div className="h-2 overflow-hidden rounded-full bg-white/15">
                    <div className="h-full rounded-full bg-fuchsia-400 transition-[width]" style={{ width: `${Math.round(reading.progress * 100)}%` }} />
                  </div>
                  <p className="truncate text-xs leading-4 text-white/60">Đọc ngay trên máy, ảnh không gửi đi đâu</p>
                </>
              ) : (
                <>
                  <p className="truncate text-sm leading-5 font-semibold">{preview ? 'Đã đọc hoá đơn' : 'Chụp / chọn ảnh hoá đơn'}</p>
                  <p className="line-clamp-2 text-xs leading-4 text-white/60">
                    {preview ? 'Kiểm tra lại số tiền, ngày rồi bấm lưu. Chạm ảnh để đọc hoá đơn khác.' : 'Chụp thẳng, đủ sáng, rõ dòng tổng tiền. Lần đầu cần mạng để tải bộ đọc chữ (~5MB).'}
                  </p>
                  {text && (
                    <button type="button" onClick={() => setShowText(true)} className="text-xs leading-4 font-semibold text-fuchsia-200 underline">
                      Xem chữ đọc được
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Các số tiền tìm thấy: số đầu là tổng tiền (đã điền sẵn), đọc sai thì chạm số khác */}
          {options.length > 1 && (
            <div className="space-y-1.5">
              <p className={`${SIZE.label} text-sm leading-5 font-medium text-white/80`}>Số tiền tìm thấy</p>
              <Segmented options={options} value={options.some((o) => o.value === amount) ? amount : null} onChange={setAmount} />
            </div>
          )}

          <div className="space-y-1.5">
            <Select id="fund" label="Rút từ quỹ" value={fund.id} onChange={(e) => setFundId(e.target.value)}>
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

          <MoneyField id="amount" label="Số tiền" placeholder="0" value={amount} onChange={setAmount} />

          <div className="grid grid-cols-2 gap-3">
            <TextField id="date" label="Ngày" type="date" value={dateText} onChange={(e) => setDateText(e.target.value)} />
            <TextField id="note" label="Ghi chú" placeholder="Hoá đơn…" value={note} maxLength={100} onChange={(e) => setNote(e.target.value)} />
          </div>

          {error && <Alert type="error">{error}</Alert>}
          {success && <Alert type="success">{success}</Alert>}
        </form>
      </GlassPanel>
      <FabGroup>
        <Fab type="submit" form={FORM_ID} icon="save" label="Rút tiền theo hoá đơn" loading={saving} disabled={!!reading} />
      </FabGroup>

      {/* Chữ thô Tesseract đọc được (để tự kiểm tra / chép số khi tự tách sai) */}
      {showText &&
        createPortal(
          <div data-no-swipe className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowText(false)}>
            <div
              className="flex max-h-[80vh] w-full max-w-md flex-col gap-3 rounded-2xl border border-white/20 bg-indigo-950/90 p-4 shadow-2xl backdrop-blur-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex h-8 items-center gap-2">
                <Icon3D emoji="🧾" className="h-6 w-6" />
                <span className="flex-1 text-sm font-semibold">Chữ đọc được</span>
                <button type="button" onClick={() => setShowText(false)} className="h-8 rounded-lg bg-white/15 px-3 text-sm font-semibold">
                  Đóng
                </button>
              </div>
              <pre className="min-h-0 flex-1 overflow-auto rounded-xl bg-black/30 p-3 text-xs leading-5 whitespace-pre-wrap text-white/85 select-text">{text}</pre>
            </div>
          </div>,
          document.body,
        )}
    </PageShell>
  )
}

export function ReceiptPageSkeleton() {
  return (
    <PageShell>
      <AppHeaderSkeleton />
      <GlassPanel className={FIT_CLASS}>
        <div className="space-y-3">
          <div className={`${PHOTO} flex items-center gap-3`}>
            <Skeleton className="h-24 w-[4.5rem] shrink-0 rounded-xl" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-5 w-40 rounded-md" />
              <Skeleton className="h-8 w-full rounded-md" />
            </div>
          </div>
          <div className="space-y-1.5">
            <TextFieldSkeleton />
            <Skeleton className={`${SIZE.label} w-40 rounded-md`} />
          </div>
          <MoneyFieldSkeleton />
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
