import { useEffect, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { AppHeader, AppHeaderSkeleton } from '../../components/AppHeader'
import { FIT_CLASS, PageShell } from '../../components/PageShell'
import { Alert } from '../../components/ui/Alert'
import { ImagePicker } from '../../components/ui/ImagePicker'
import { FAB_SPACE, Fab, FabGroup, FabSkeleton } from '../../components/ui/Fab'
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
import { ReceiptItemsPopup } from './ReceiptItems'
import { itemsTotal, parseReceipt, RECEIPT_KINDS, type ReceiptItem, type ReceiptKind } from './data/receiptParse'

// Đọc hoá đơn (/fund/receipt): chụp / chọn ảnh hoá đơn -> đọc chữ NGAY TRÊN MÁY (Tesseract.js, miễn phí, ảnh không gửi đi đâu)
// -> tự điền số tiền (ưu tiên dòng "Tổng cộng / Thanh toán..."), ngày, ghi chú "Hoá đơn <tên cửa hàng>" vào form RÚT QUỸ.
// Đọc sai thì chạm chọn số khác trong "Số tiền tìm thấy" hoặc sửa tay; bấm FAB check để rút (giống màn hình Rút quỹ).

const FORM_ID = 'receipt-form'
const PHOTO = 'h-24' // hàng ảnh hoá đơn (thật + skeleton)

// Loại hoá đơn chọn lần trước (mặc định BHX), nhớ trên máy
const KIND_KEY = 'receipt-kind'
function loadKind(): ReceiptKind {
  try {
    const v = localStorage.getItem(KIND_KEY)
    return RECEIPT_KINDS.some((k) => k.value === v) ? (v as ReceiptKind) : 'bhx'
  } catch {
    return 'bhx'
  }
}
function saveKind(k: ReceiptKind) {
  try {
    localStorage.setItem(KIND_KEY, k)
  } catch {
    /* trình duyệt chặn bộ nhớ: bỏ qua */
  }
}

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
  const [preview, setPreview] = useState<string | null>(null)
  const [reading, setReading] = useState<OcrProgress | null>(null)
  const [text, setText] = useState('')
  // Khung đang mở: chữ thô đọc được / danh sách sản phẩm
  const [popup, setPopup] = useState<'text' | 'items' | null>(null)
  const [kind, setKind] = useState<ReceiptKind>(loadKind)
  const [items, setItems] = useState<ReceiptItem[]>([])
  const [amounts, setAmounts] = useState<number[]>([])
  const [fundId, setFundId] = useState(funds[0].id)
  const [amount, setAmount] = useState(0)
  const [dateText, setDateText] = useState(() => toDateInputValue(new Date()))
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [saving, setSaving] = useState(false)
  const fund = funds.find((f) => f.id === fundId) ?? funds[0]

  // Tách dữ liệu từ chữ đã đọc theo loại hoá đơn rồi điền vào form (đổi loại hoá đơn thì tách lại, không cần đọc ảnh lại)
  function apply(raw: string, k: ReceiptKind) {
    const r = parseReceipt(raw, new Date(), k)
    setItems(r.items)
    setAmounts(r.amounts)
    setAmount(r.amounts[0] ?? 0)
    if (r.date) setDateText(toDateInputValue(r.date))
    setNote((r.store ? `Hoá đơn ${r.store}` : 'Hoá đơn').slice(0, 100))
    setError(r.amounts.length === 0 ? 'Không tìm thấy số tiền trên ảnh. Hãy chụp rõ, thẳng hoá đơn hoặc nhập tay.' : '')
  }

  function changeKind(k: ReceiptKind) {
    setKind(k)
    saveKind(k)
    if (text) apply(text, k)
  }

  async function onFile(file: File | undefined) {
    if (!file) return
    setError('')
    setSuccess('')
    setText('')
    setItems([])
    setAmounts([])
    setReading({ status: 'Đang xử lý ảnh', progress: 0 })
    try {
      const result = await readReceiptText(file, setReading)
      setPreview(result.preview)
      setText(result.text)
      apply(result.text, kind)
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
      // Có danh sách sản phẩm (vd hoá đơn BHX) thì lưu kèm vào giao dịch rút: { name, qty, amount }
      const receipt = items.length > 0 ? { kind, items } : undefined
      await addTransaction(fund.id, 'withdraw', amount, fromDateInputValue(dateText), note.trim(), actor, receipt)
      setSuccess(`Đã rút ${formatMoney(amount)} từ ${fund.name}${receipt ? ` (lưu ${items.length} sản phẩm)` : ''}.`)
      // Xong 1 hoá đơn: dọn form để đọc hoá đơn tiếp theo
      setPreview(null)
      setText('')
      setItems([])
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
  const sum = itemsTotal(items)

  return (
    <PageShell>
      <AppHeader title="Đọc hoá đơn" backTo="/fund" />
      <GlassPanel className={FIT_CLASS}>
        {/* Mỗi ô 1 dòng nên form dài: cuộn trong khung, chừa chỗ cuối cho nút nổi để ô Ghi chú không bị che */}
        <form id={FORM_ID} onSubmit={handleSubmit} className={`space-y-3 ${FAB_SPACE}`} noValidate>
          {/* Ảnh hoá đơn: chạm để chụp / chọn ảnh (thư viện hoặc máy ảnh) */}
          <div className={`${PHOTO} flex items-center gap-3`}>
            <ImagePicker
              label={preview ? 'Chụp / chọn hoá đơn khác' : 'Chụp / chọn ảnh hoá đơn'}
              disabled={!!reading}
              onChange={(e) => {
                void onFile(e.target.files?.[0])
                e.target.value = '' // chọn lại cùng 1 ảnh vẫn đọc lại
              }}
              className={`flex h-24 w-[4.5rem] shrink-0 items-center justify-center overflow-hidden rounded-xl transition active:scale-95 ${
                preview ? 'border border-white/30' : 'border-2 border-dashed border-white/40 bg-white/5'
              }`}
            >
              {preview ? <img src={preview} alt="Ảnh hoá đơn" className="block h-full w-full object-cover" /> : <Icon3D emoji="📷" className="h-9 w-9" />}
            </ImagePicker>
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
                    {!preview ? (
                      'Chụp thẳng, đủ sáng, rõ dòng tổng tiền. Lần đầu cần mạng để tải bộ đọc chữ (~5MB).'
                    ) : items.length > 0 ? (
                      <>
                        {items.length} sản phẩm · {formatMoney(sum)}
                        {sum === amount ? (
                          <span className="font-semibold text-emerald-300"> · khớp số tiền</span>
                        ) : (
                          <span className="font-semibold text-amber-200"> · lệch {formatMoney(Math.abs(sum - amount))}</span>
                        )}
                      </>
                    ) : (
                      'Kiểm tra lại số tiền, ngày rồi bấm lưu. Chạm ảnh để đọc hoá đơn khác.'
                    )}
                  </p>
                  {text && (
                    <div className="flex gap-4">
                      {items.length > 0 && (
                        <button type="button" onClick={() => setPopup('items')} className="text-xs leading-4 font-semibold text-fuchsia-200 underline">
                          Xem sản phẩm
                        </button>
                      )}
                      <button type="button" onClick={() => setPopup('text')} className="text-xs leading-4 font-semibold text-fuchsia-200 underline">
                        Xem chữ đọc được
                      </button>
                    </div>
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

          {/* Loại hoá đơn (mỗi loại tách dữ liệu theo cách riêng; nhớ lựa chọn lần trước) + quỹ rút */}
          <Select id="kind" label="Loại hoá đơn" value={kind} onChange={(e) => changeKind(e.target.value as ReceiptKind)}>
            {RECEIPT_KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </Select>

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

          <TextField id="date" label="Ngày" type="date" value={dateText} onChange={(e) => setDateText(e.target.value)} />
          <TextField id="note" label="Ghi chú" placeholder="Hoá đơn…" value={note} maxLength={100} onChange={(e) => setNote(e.target.value)} />

          {error && <Alert type="error">{error}</Alert>}
          {success && <Alert type="success">{success}</Alert>}
        </form>
      </GlassPanel>
      <FabGroup>
        <Fab type="submit" form={FORM_ID} icon="save" label="Rút tiền theo hoá đơn" loading={saving} disabled={!!reading} />
      </FabGroup>

      {/* Khung xem: danh sách sản phẩm sẽ lưu (tên, SL, thành tiền) / chữ thô Tesseract đọc được (để tự kiểm tra khi tách sai) */}
      {popup === 'items' && (
        <ReceiptItemsPopup title={note || 'Hoá đơn'} subtitle="Các sản phẩm sẽ lưu kèm giao dịch rút" items={items} paid={amount} onClose={() => setPopup(null)} />
      )}
      {popup === 'text' &&
        createPortal(
          <div data-no-swipe className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setPopup(null)}>
            <div
              className="flex max-h-[80vh] w-full max-w-md flex-col gap-3 rounded-2xl border border-white/20 bg-indigo-950/90 p-4 shadow-2xl backdrop-blur-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex h-8 items-center gap-2">
                <Icon3D emoji="🧾" className="h-6 w-6" />
                <span className="flex-1 truncate text-sm font-semibold">Chữ đọc được</span>
                <button type="button" onClick={() => setPopup(null)} className="h-8 rounded-lg bg-white/15 px-3 text-sm font-semibold">
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
        <div className={`space-y-3 ${FAB_SPACE}`}>
          <div className={`${PHOTO} flex items-center gap-3`}>
            <Skeleton className="h-24 w-[4.5rem] shrink-0 rounded-xl" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-5 w-40 rounded-md" />
              <Skeleton className="h-8 w-full rounded-md" />
            </div>
          </div>
          <TextFieldSkeleton />
          <div className="space-y-1.5">
            <TextFieldSkeleton />
            <Skeleton className={`${SIZE.label} w-40 rounded-md`} />
          </div>
          <MoneyFieldSkeleton />
          <TextFieldSkeleton />
          <TextFieldSkeleton />
        </div>
      </GlassPanel>
      <FabSkeleton />
    </PageShell>
  )
}
