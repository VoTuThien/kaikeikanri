import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { AppHeader, AppHeaderSkeleton } from '../../components/AppHeader'
import { PageShell, ScrollArea } from '../../components/PageShell'
import { GLASS_CLASS, GlassPanel } from '../../components/ui/GlassPanel'
import { Segmented, SegmentedSkeleton } from '../../components/ui/Segmented'
import { Select } from '../../components/ui/Select'
import { Icon3D } from '../../components/ui/Icon3D'
import { Skeleton } from '../../components/ui/Skeleton'
import { BLOCK_3D, GLOSS_3D } from '../../components/ui/style3d'
import { SIZE } from '../../components/ui/sizes'
import { Alert } from '../../components/ui/Alert'
import { LineIcon } from '../../components/ui/Fab'
import { SwipeActions } from '../../components/ui/SwipeActions'
import { formatDate, formatMoney, formatMoneyCompact, formatMonth, toDateInputValue } from '../../lib/format'
import { deleteTransaction, lockedBySummary } from './data/api'
import { useFund, useFundRuns } from './data/FundContext'
import { monthId } from './data/orders'
import type { FundTransaction, TxType } from './data/types'

// "Chuyển" gồm cả chuyển đi và nhận về giữa các quỹ
type TypeFilter = 'all' | 'deposit' | 'withdraw' | 'interest' | 'transfer'

const TYPE_OPTIONS: { value: TypeFilter; label: string }[] = [
  { value: 'all', label: 'Tất cả' },
  { value: 'deposit', label: 'Nạp' },
  { value: 'withdraw', label: 'Rút' },
  { value: 'transfer', label: 'Chuyển' },
  { value: 'interest', label: 'Lãi' },
]

const matchType = (filter: TypeFilter, type: TxType) =>
  filter === 'all' || filter === type || (filter === 'transfer' && (type === 'transfer_out' || type === 'transfer_in'))

const TYPE_STYLE: Record<TxType, { icon: string; badge: string; sign: string; amount: string }> = {
  deposit: { icon: '💵', badge: 'from-emerald-400/60 to-emerald-700/60', sign: '+', amount: 'text-emerald-200' },
  withdraw: { icon: '💸', badge: 'from-rose-400/60 to-rose-700/60', sign: '−', amount: 'text-rose-200' },
  interest: { icon: '📈', badge: 'from-amber-300/60 to-amber-600/60', sign: '+', amount: 'text-amber-200' },
  transfer_out: { icon: '📤', badge: 'from-sky-400/60 to-blue-700/60', sign: '−', amount: 'text-sky-200' },
  transfer_in: { icon: '📥', badge: 'from-sky-400/60 to-blue-700/60', sign: '+', amount: 'text-sky-200' },
}

const TYPE_LABEL: Record<TxType, string> = {
  deposit: 'Nạp tiền',
  withdraw: 'Rút tiền',
  interest: 'Tiền lãi',
  transfer_out: 'Chuyển đi',
  transfer_in: 'Nhận chuyển',
}

// Bộ lọc thu gọn (ẩn nhãn, padding nhỏ) để dành chỗ cho bảng
const FILTER_CLASS = 'space-y-2 !p-3'
// Bảng: chiếm hết phần còn lại của màn hình, chỉ bảng được cuộn
const TABLE_CLASS = `${GLASS_CLASS} !p-0`
// Số dòng skeleton: đủ lấp đầy bảng trên iPhone 11 / 12, phần thừa bị che bởi khung bảng
const SKELETON_ROWS = 8
// Dòng gợi ý thao tác kéo ở đầu bảng
const SWIPE_HINT = 'h-8 truncate border-b border-white/10 px-6 text-[11px] leading-8 text-white/50'

export function HistoryPage() {
  const { loading } = useFund()
  if (loading) return <HistoryPageSkeleton />
  return <History />
}

function History() {
  const { actor, funds, transactions } = useFund()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  // Chỉ 1 thẻ được mở (hiện thùng rác) cùng lúc
  const [openId, setOpenId] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null)
  const [fundFilter, setFundFilter] = useState(params.get('fund') ?? 'all')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')

  // Giao dịch đã bị tổng kết (tháng đó đã tổng kết, giao dịch ghi trước lúc tổng kết) thì không xoá được.
  // Chưa tải xong các đợt tổng kết thì tạm khoá (hàm xoá cũng kiểm tra lại trên server)
  const runs = useFundRuns()
  const locked = (t: FundTransaction) => !runs || lockedBySummary(t, runs.get(monthId(t.date))?.summarizedAt ?? null)

  const fundById = new Map(funds.map((f) => [f.id, f]))
  const byFund = transactions.filter((t) => fundFilter === 'all' || t.fundId === fundFilter)
  const shown = byFund.filter((t) => matchType(typeFilter, t.type))

  // Tổng theo quỹ đang chọn (không phụ thuộc bộ lọc loại); giao dịch đã xoá không tính
  const total = (type: TxType) => byFund.filter((t) => t.type === type && !t.deleted).reduce((s, t) => s + t.amount, 0)
  const nameOf = (id: string) => fundById.get(id)?.name ?? 'Quỹ đã xoá'

  async function remove(t: FundTransaction) {
    setMessage(null)
    try {
      await deleteTransaction(t, actor, nameOf)
      setOpenId(null)
      setMessage({ type: 'success', text: 'Đã xoá giao dịch và hoàn lại số dư. Trượt thẻ xám sang trái để nhập lại.' })
    } catch (err) {
      console.error(err)
      setMessage({ type: 'error', text: err instanceof Error && !('code' in err) ? err.message : 'Xoá thất bại. Vui lòng thử lại.' })
    }
  }

  // Thẻ đã xoá trượt sang trái: mở màn hình nạp / rút / chuyển với giá trị điền sẵn (lưu sẽ tạo giao dịch MỚI)
  function reopen(t: FundTransaction) {
    const q = new URLSearchParams({ amount: String(t.amount), note: cleanNote(t.note), date: toDateInputValue(t.date) })
    if (t.type === 'deposit' || t.type === 'withdraw') {
      q.set('fund', t.fundId)
      navigate(`/fund/${t.type}?${q}`)
    } else if (t.type === 'transfer_out' || t.type === 'transfer_in') {
      q.set('fund', t.type === 'transfer_out' ? t.fundId : (t.peerFundId ?? ''))
      q.set('to', t.type === 'transfer_out' ? (t.peerFundId ?? '') : t.fundId)
      navigate(`/fund/transfer?${q}`)
    }
  }

  // Gom nhóm theo tháng, danh sách đã được sắp xếp mới nhất trước
  const groups: { month: string; items: FundTransaction[] }[] = []
  for (const t of shown) {
    const month = formatMonth(t.date)
    const last = groups[groups.length - 1]
    if (last?.month === month) last.items.push(t)
    else groups.push({ month, items: [t] })
  }

  return (
    <PageShell>
      <AppHeader title="Tra cứu" backTo="/fund" />

      <GlassPanel className={FILTER_CLASS}>
        <Select id="fund" label="Nhóm quỹ" hideLabel value={fundFilter} onChange={(e) => setFundFilter(e.target.value)}>
          <option value="all">Tất cả nhóm quỹ</option>
          {funds.map((f) => (
            <option key={f.id} value={f.id}>
              {f.icon} {f.name}
            </option>
          ))}
        </Select>
        <Segmented options={TYPE_OPTIONS} value={typeFilter} onChange={setTypeFilter} />
      </GlassPanel>

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Tổng nạp" value={total('deposit')} className="text-emerald-200" />
        <Stat label="Tổng rút" value={total('withdraw')} className="text-rose-200" />
        <Stat label="Tiền lãi" value={total('interest')} className="text-amber-200" />
      </div>

      {message && <Alert type={message.type}>{message.text}</Alert>}

      <ScrollArea className={TABLE_CLASS}>
        {groups.length > 0 && <p className={SWIPE_HINT}>Trượt trái: xoá giao dịch nhập sai (chưa tổng kết) · thẻ xám: nhập lại</p>}
        {groups.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
            <Icon3D emoji="🔍" className="h-12 w-12" />
            <span className="text-sm leading-5 text-white/70">Chưa có giao dịch nào phù hợp.</span>
          </div>
        ) : (
          groups.map((g) => (
            <section key={g.month}>
              {/* Tiêu đề tháng dính trên đầu bảng khi cuộn */}
              <h2
                className={`${SIZE.stickyHeader} sticky top-0 z-10 border-b border-white/10 bg-indigo-950/70 px-6 text-xs leading-8 font-semibold text-white/70 backdrop-blur-xl`}
              >
                {g.month}
              </h2>
              {/* Kéo ngang trong bảng là thao tác của từng thẻ, không phải vuốt sang màn hình bên cạnh */}
              <div className="divide-y divide-white/10" data-no-swipe>
                {g.items.map((t) => (
                  <SwipeRow
                    key={t.id}
                    tx={t}
                    locked={!t.deleted && locked(t)}
                    fundName={nameOf(t.fundId)}
                    open={openId === t.id}
                    onOpen={() => setOpenId(t.id)}
                    onClose={() => setOpenId((id) => (id === t.id ? null : id))}
                    onDelete={() => remove(t)}
                    onReopen={() => reopen(t)}
                  />
                ))}
              </div>
            </section>
          ))
        )}
      </ScrollArea>
    </PageShell>
  )
}

function Stat({ label, value, className }: { label: string; value: number; className: string }) {
  return (
    <div
      className={`${SIZE.stat} flex flex-col justify-center rounded-2xl border border-white/20 bg-white/10 px-3 shadow-lg shadow-black/20 backdrop-blur-xl`}
    >
      <span className="truncate text-xs leading-4 text-white/60">{label}</span>
      <span className={`truncate text-base leading-6 font-bold ${className}`} title={formatMoney(value)}>
        {formatMoneyCompact(value)}
      </span>
    </div>
  )
}

// Ghi chú gốc người dùng đã nhập (bỏ phần app tự thêm: "· sang X", "Chuyển sang X", "Lệnh chuyển tháng …")
function cleanNote(note: string) {
  return note
    .replace(/ · (sang|từ) .*$/, '')
    .replace(/^(Chuyển sang|Nhận từ) .*$/, '')
    .replace(/(^| · )Lệnh chuyển tháng .*$/, '')
    .trim()
}

// Thẻ giao dịch trượt được sang TRÁI (lãi tự động thì không trượt được), nút hiện ra ở bên phải với icon nét trắng (LineIcon):
// - Giao dịch bình thường: trượt ra hiện nút thùng rác; chạm 1 lần đổi thành "Xoá?", chạm lần nữa mới xoá
// - Giao dịch đã xoá (nền xám): trượt quá bề rộng nút rồi thả thì mở màn hình nạp / rút / chuyển với giá trị điền sẵn
// - Giao dịch đã bị tổng kết (locked): không trượt / xoá được, dòng phụ ghi "Đã tổng kết"
const REVEAL = 76 // px, bề rộng nút thùng rác
const ROW_BG = 'bg-[#2a2766]' // nền đặc để che lớp nút phía sau
function SwipeRow({
  tx,
  locked,
  fundName,
  open,
  onOpen,
  onClose,
  onDelete,
  onReopen,
}: {
  tx: FundTransaction
  locked: boolean
  fundName: string
  open: boolean
  onOpen: () => void
  onClose: () => void
  onDelete: () => Promise<void>
  onReopen: () => void
}) {
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)

  async function tapTrash() {
    if (!confirm) return setConfirm(true)
    setBusy(true)
    await onDelete()
    setBusy(false)
    setConfirm(false)
  }

  return (
    <SwipeActions
      width={REVEAL}
      maxPull={tx.deleted ? REVEAL * 1.8 : REVEAL * 1.3}
      open={open}
      onOpen={onOpen}
      onClose={() => {
        setConfirm(false)
        onClose()
      }}
      onPullBeyond={tx.deleted ? onReopen : undefined}
      disabled={tx.type === 'interest' || locked}
      className={tx.deleted ? 'bg-slate-700' : ROW_BG}
      actions={(pull) =>
        tx.deleted ? (
          // Đã xoá: "Nhập lại" (trượt quá bề rộng nút rồi thả)
          <div className="flex h-full w-full items-center justify-end gap-2 bg-indigo-500/80 pr-4 text-xs font-semibold">
            {pull > REVEAL ? 'Thả để nhập lại' : 'Nhập lại'}
            <LineIcon icon="edit" className="h-6 w-6" />
          </div>
        ) : (
          <button
            type="button"
            aria-label={confirm ? 'Bấm lần nữa để xoá giao dịch' : 'Xoá giao dịch'}
            disabled={busy}
            onClick={tapTrash}
            className={`flex h-full w-full flex-col items-center justify-center gap-0.5 text-[11px] font-semibold transition ${
              confirm ? 'bg-rose-600 ring-4 ring-rose-300/60 ring-inset' : 'bg-rose-500/90'
            }`}
          >
            {busy ? (
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
            ) : (
              <LineIcon icon="delete" className="h-6 w-6" />
            )}
            {confirm ? 'Xoá?' : 'Xoá'}
          </button>
        )
      }
    >
      <TxRow tx={tx} fundName={fundName} locked={locked} />
    </SwipeActions>
  )
}

function TxRow({ tx, fundName, locked }: { tx: FundTransaction; fundName: string; locked?: boolean }) {
  const style = TYPE_STYLE[tx.type]
  return (
    <div className={`${SIZE.row} flex items-center gap-3 px-6 ${tx.deleted ? 'opacity-60 grayscale' : ''}`}>
      <span className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${BLOCK_3D} ${style.badge}`}>
        <span className={GLOSS_3D} />
        <Icon3D emoji={style.icon} className="h-7 w-7" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm leading-5 font-semibold">{fundName}</span>
        <span className="block truncate text-xs leading-5 text-white/60">
          {tx.deleted
            ? `Đã xoá${tx.deletedByName ? ` bởi ${tx.deletedByName}` : ''} · ${formatDate(tx.date)} · ${tx.note || TYPE_LABEL[tx.type]}`
            : [locked && tx.type !== 'interest' ? 'Đã tổng kết' : '', formatDate(tx.date), tx.createdByName, tx.note || TYPE_LABEL[tx.type]]
                .filter(Boolean)
                .join(' · ')}
        </span>
      </span>
      <span className={`shrink-0 text-sm font-bold ${tx.deleted ? 'text-white/70 line-through' : style.amount}`}>
        {style.sign}
        {formatMoney(tx.amount)}
      </span>
    </div>
  )
}

export function HistoryPageSkeleton() {
  return (
    <PageShell>
      <AppHeaderSkeleton />
      <GlassPanel className={FILTER_CLASS}>
        <Skeleton className={`${SIZE.control} w-full`} />
        <SegmentedSkeleton count={TYPE_OPTIONS.length} />
      </GlassPanel>
      <div className="grid grid-cols-3 gap-3">
        <Skeleton className={`${SIZE.stat} rounded-2xl`} />
        <Skeleton className={`${SIZE.stat} rounded-2xl`} />
        <Skeleton className={`${SIZE.stat} rounded-2xl`} />
      </div>
      <ScrollArea className={`${TABLE_CLASS} !overflow-hidden`}>
        <div className={`${SIZE.stickyHeader} flex items-center border-b border-white/10 px-6`}>
          <Skeleton className="h-3 w-24 rounded-md" />
        </div>
        <div className="divide-y divide-white/10">
          {Array.from({ length: SKELETON_ROWS }, (_, i) => (
            <div key={i} className={`${SIZE.row} flex items-center gap-3 px-6`}>
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="flex-1 space-y-1">
                <Skeleton className="h-4 w-28 rounded-md" />
                <Skeleton className="h-3 w-40 rounded-md" />
              </div>
              <Skeleton className="h-4 w-20 rounded-md" />
            </div>
          ))}
        </div>
      </ScrollArea>
    </PageShell>
  )
}
