import { useState, type FormEvent, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { AppHeader, AppHeaderSkeleton } from '../../components/AppHeader'
import { Avatar } from '../../components/Avatar'
import { PageShell, ScrollArea } from '../../components/PageShell'
import { Alert } from '../../components/ui/Alert'
import { FAB_SPACE, Fab, FabGroup, FabSkeleton } from '../../components/ui/Fab'
import { GLASS_CLASS, GlassPanel } from '../../components/ui/GlassPanel'
import { Icon3D } from '../../components/ui/Icon3D'
import { MoneyField, MoneyFieldSkeleton } from '../../components/ui/MoneyField'
import { Segmented, SegmentedSkeleton } from '../../components/ui/Segmented'
import { Skeleton } from '../../components/ui/Skeleton'
import { SIZE } from '../../components/ui/sizes'
import { useFamily } from '../../contexts/FamilyContext'
import { formatMoney, formatMoneyCompact } from '../../lib/format'
import { useMembers } from '../family/data/useMembers'
import { OrderInfo, OrderRowSkeleton, orderValid } from './components'
import { useFund, useFundRun } from './data/FundContext'
import { executeOrders, monthId, monthLabel, setSummarized, shiftMonth } from './data/orders'
import { saveSalary, useSalaryInfos, type SalaryInfo } from './data/salary'
import type { FundOrder, FundRun, Salary } from './data/types'
import { submitForm, useUnsavedChanges } from '../../components/UnsavedGuard'

// Thực thi theo từng tháng, gồm 3 bước:
//   1. Lương: mỗi thành viên nhập lương thực lãnh của mình (cả gia đình xem được); lưu là tự nạp vào quỹ nhận lương
//      đã thiết đặt ở màn hình Lương. Cùng dữ liệu với ô nhập ở màn hình Lương / thông báo nhắc lương.
//   2. Tổng kết: 1 thành viên xác nhận đã tổng kết (quy trình tổng kết chi tiết sẽ bổ sung sau)
//   3. Chạy lệnh: chạy các lệnh ở màn hình Lệnh chuyển; mặc định chọn sẵn mọi lệnh chưa chạy, bỏ chọn để bỏ qua.
//      Mỗi lệnh chỉ chạy 1 lần mỗi tháng. Bước 3 chỉ mở sau khi đã tổng kết.
// Bố cục mọi bước giống nhau: thanh tháng + chọn bước, 1 panel cao cố định, danh sách chiếm phần còn lại.

type Step = 1 | 2 | 3

const TOP_CLASS = 'space-y-3 !p-3'
const MONTH_BAR = 'grid h-10 grid-cols-[2.5rem_1fr_2.5rem] items-center gap-3'
const MONTH_BUTTON = 'h-10 w-10 rounded-xl border border-white/25 bg-white/10 text-xl transition hover:bg-white/20 active:scale-95 disabled:opacity-30'
// Panel của từng bước: cao cố định để đổi bước không làm nhảy danh sách bên dưới
const STEP_PANEL = 'h-44 shrink-0 space-y-2 !p-4'
const HINT = 'h-5 truncate text-xs leading-5'
const LIST_CLASS = `${GLASS_CLASS} !p-0 ${FAB_SPACE}`
const FORM_ID = 'salary-form'
const SKELETON_ROWS = 5

export function ExecutePage() {
  const { loading } = useFund()
  // Mở từ thông báo nhắc lương thì có ?month=YYYY-MM: mở đúng tháng cần nhập lương thực lãnh
  const [params] = useSearchParams()
  const [month, setMonth] = useState(() => {
    const m = params.get('month')
    return m && /^\d{4}-\d{2}$/.test(m) && m <= monthId(new Date()) ? m : monthId(new Date())
  })
  const data = useFundRun(month)
  if (loading) return <ExecutePageSkeleton />
  return <Execute key={month} month={month} setMonth={setMonth} data={data} />
}

function Execute({ month, setMonth, data }: { month: string; setMonth: (m: string) => void; data: ReturnType<typeof useFundRun> }) {
  const { funds, orders } = useFund()
  const { current } = useFamily()
  const members = useMembers(current?.familyId)
  const infos = useSalaryInfos()
  const [chosen, setChosen] = useState<Step | null>(null)

  const ready = data && members && infos
  // Bước nào đã xong: 1 = mọi người CÓ LƯƠNG đã nhập lương, 2 = đã tổng kết, 3 = mọi lệnh hợp lệ đã chạy
  const people = ready ? peopleOf(members, data.salaries, infos) : []
  const done: Record<Step, boolean> = {
    1: people.length > 0 && people.every((p) => p.salary || !p.hasSalary),
    2: !!data?.run.summarizedByName,
    3: !!data && orders.length > 0 && orders.filter((o) => orderValid(o, funds)).every((o) => data.run.executed[o.id]),
  }
  // Mặc định mở bước đầu tiên chưa xong
  const step: Step = chosen ?? (!ready ? 1 : !done[1] && !done[2] ? 1 : !done[2] ? 2 : 3)
  const steps = ([1, 2, 3] as const).map((s) => ({ value: s, label: `${s}. ${STEP_NAMES[s]}${done[s] ? ' ✓' : ''}` }))
  const isCurrentMonth = month >= monthId(new Date())

  return (
    <PageShell>
      <AppHeader title="Thực thi" backTo="/fund" />
      <GlassPanel className={TOP_CLASS}>
        <div className={MONTH_BAR}>
          <button type="button" aria-label="Tháng trước" className={MONTH_BUTTON} onClick={() => setMonth(shiftMonth(month, -1))}>
            ‹
          </button>
          <button type="button" className="truncate text-center text-sm leading-5 font-semibold" onClick={() => setMonth(monthId(new Date()))}>
            {monthLabel(month)}
            {isCurrentMonth ? ' (tháng này)' : ''}
          </button>
          <button type="button" aria-label="Tháng sau" className={MONTH_BUTTON} disabled={isCurrentMonth} onClick={() => setMonth(shiftMonth(month, 1))}>
            ›
          </button>
        </div>
        <Segmented options={steps} value={step} onChange={setChosen} />
      </GlassPanel>

      {!ready ? (
        <StepSkeleton />
      ) : step === 1 ? (
        <SalaryStep month={month} run={data.run} people={people} infos={infos} />
      ) : step === 2 ? (
        <SummaryStep month={month} run={data.run} people={people} />
      ) : (
        <RunStep month={month} run={data.run} orders={orders} />
      )}
    </PageShell>
  )
}

const STEP_NAMES: Record<Step, string> = { 1: 'Lương', 2: 'Tổng kết', 3: 'Chạy lệnh' }

// Thành viên + lương đã nhập (gồm cả người đã rời gia đình nhưng đã nhập lương trong tháng).
// hasSalary: có đặt ngày nhận lương ở màn hình Lương (không đặt = không có lương, không cần nhập lương thực lãnh)
interface Person {
  uid: string
  name: string
  salary: Salary | null
  hasSalary: boolean
}
function peopleOf(members: { uid: string; name: string }[], salaries: Salary[], infos: SalaryInfo[]): Person[] {
  const paid = (uid: string) => !!infos.find((i) => i.uid === uid)?.payday
  const list: Person[] = members.map((m) => {
    const salary = salaries.find((s) => s.uid === m.uid) ?? null
    return { uid: m.uid, name: m.name, salary, hasSalary: paid(m.uid) || !!salary }
  })
  for (const s of salaries) if (!list.some((p) => p.uid === s.uid)) list.push({ uid: s.uid, name: s.name, salary: s, hasSalary: true })
  return list
}

// Danh sách lương từng người (bước 1 và 2)
function SalaryList({ people }: { people: Person[] }) {
  const { actor, showMoney } = useFund()
  return (
    <ScrollArea className={LIST_CLASS}>
      <div className="divide-y divide-white/10">
        {people.map((p) => (
          <div key={p.uid} className={`${SIZE.row} flex items-center gap-3 px-4`}>
            <Avatar uid={p.uid} name={p.name} me={p.uid === actor.uid} />
            <span className="min-w-0 flex-1 truncate text-sm leading-5 font-semibold">
              {p.name}
              {p.uid === actor.uid ? ' (bạn)' : ''}
            </span>
            <span className={`shrink-0 text-sm font-bold ${p.salary ? '' : 'font-normal text-white/50'}`}>
              {p.salary ? showMoney(p.salary.amount) : p.hasSalary ? 'Chưa nhập' : 'Không có lương'}
            </span>
          </div>
        ))}
      </div>
    </ScrollArea>
  )
}

// ---- Bước 1: nhập lương thực lãnh ----
function SalaryStep({ month, run, people, infos }: { month: string; run: FundRun; people: Person[]; infos: SalaryInfo[] }) {
  const { actor, funds } = useFund()
  const fundId = infos.find((i) => i.uid === actor.uid)?.fundId ?? null
  const fundName = funds.find((f) => f.id === fundId)?.name
  const me = people.find((p) => p.uid === actor.uid)
  const mine = me?.salary ?? null
  // Không có lương (chưa đặt ngày nhận lương ở màn hình Lương): không cần nhập
  const noSalary = !me?.hasSalary
  const [amount, setAmount] = useState(mine?.amount ?? 0)
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null)
  const [saving, setSaving] = useState(false)
  // Đã tổng kết thì không sửa lương đã nhập (vẫn nhập mới được, giống màn hình Lương)
  const locked = (!!run.summarizedByName && !!mine) || noSalary
  // Có thông tin chưa lưu: chấm đỏ trên nút lưu, rời màn hình thì hỏi lại (UnsavedGuard)
  const dirty = !locked && amount !== (mine?.amount ?? 0)
  useUnsavedChanges(dirty && !saving, () => submitForm(FORM_ID))

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setMessage(null)
    if (amount <= 0) return setMessage({ type: 'error', text: 'Vui lòng nhập lương thực lãnh.' })
    setSaving(true)
    try {
      await saveSalary(month, actor, amount, fundId)
      setMessage({
        type: 'success',
        text: `Đã lưu lương ${monthLabel(month).toLowerCase()}: ${formatMoney(amount)}${fundName ? ` và chuyển vào ${fundName}` : ''}.`,
      })
    } catch (err) {
      console.error(err)
      setMessage({ type: 'error', text: 'Lưu thất bại. Vui lòng thử lại.' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <GlassPanel className={STEP_PANEL}>
        <form id={FORM_ID} onSubmit={handleSubmit} noValidate className="space-y-2">
          <MoneyField id="salary" label="Lương thực lãnh của bạn" placeholder="0" value={amount} onChange={setAmount} disabled={locked} />
          <p className={`${HINT} ${locked && !noSalary ? 'text-amber-100' : 'text-white/60'}`}>
            {noSalary
              ? 'Bạn không có lương (chưa đặt ngày nhận lương) nên không cần nhập'
              : locked
                ? 'Đã tổng kết. Huỷ tổng kết ở bước 2 nếu cần sửa lương.'
                : mine
                  ? `Đã nhập ${formatMoney(mine.amount)}, sửa rồi bấm lưu để cập nhật`
                  : fundName
                    ? `Lưu xong sẽ tự chuyển vào ${fundName}`
                    : 'Chưa chọn quỹ nhận lương (thiết đặt ở màn hình Lương)'}
          </p>
        </form>
      </GlassPanel>
      {message && <Alert type={message.type}>{message.text}</Alert>}
      <SalaryList people={people} />
      {!locked && (
        <FabGroup>
          <Fab type="submit" form={FORM_ID} icon="save" label="Lưu lương" loading={saving} dirty={dirty} />
        </FabGroup>
      )}
    </>
  )
}

// ---- Bước 2: tổng kết (tạm thời chỉ xác nhận; quy trình chi tiết sẽ bổ sung sau) ----
function SummaryStep({ month, run, people }: { month: string; run: FundRun; people: Person[] }) {
  const { actor, showMoney } = useFund()
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const total = people.reduce((s, p) => s + (p.salary?.amount ?? 0), 0)
  // Chỉ tính người có lương (người không có lương không cần nhập)
  const salaried = people.filter((p) => p.hasSalary).length
  const entered = people.filter((p) => p.salary).length
  const anyExecuted = Object.keys(run.executed).length > 0

  async function save(by: typeof actor | null) {
    setError('')
    setSaving(true)
    try {
      await setSummarized(month, by)
    } catch (err) {
      console.error(err)
      setError('Lưu thất bại. Vui lòng thử lại.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <GlassPanel className={STEP_PANEL}>
        <div className="grid grid-cols-2 gap-3">
          <Stat label="Tổng lương" value={showMoney(total)} title={formatMoney(total)} />
          <Stat label="Đã nhập" value={`${entered}/${salaried} người`} />
        </div>
        <p className={`${HINT} ${run.summarizedByName ? 'text-emerald-200' : 'text-white/60'}`}>
          {run.summarizedByName
            ? `${run.summarizedByName} đã tổng kết${run.summarizedAt ? ` lúc ${run.summarizedAt.toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}` : ''}`
            : entered < salaried
              ? `Còn ${salaried - entered} người chưa nhập lương`
              : 'Kiểm tra lương rồi bấm nút check để xác nhận đã tổng kết'}
        </p>
        <p className={`${HINT} text-white/40`}>
          {run.summarizedByName && anyExecuted ? 'Đã chạy lệnh nên không huỷ tổng kết được' : run.summarizedByName ? 'Đã lưu số dư các quỹ, xem ở màn hình Thống kê' : 'Tổng kết sẽ lưu lại số dư các quỹ lúc này'}
        </p>
      </GlassPanel>
      {error && <Alert type="error">{error}</Alert>}
      <SalaryList people={people} />
      {!run.summarizedByName ? (
        <FabGroup>
          <Fab icon="save" label="Xác nhận đã tổng kết" loading={saving} onClick={() => save(actor)} />
        </FabGroup>
      ) : (
        !anyExecuted && (
          <FabGroup>
            <Fab icon="cancel" label="Huỷ tổng kết" variant="secondary" loading={saving} onClick={() => save(null)} />
          </FabGroup>
        )
      )}
    </>
  )
}

function Stat({ label, value, title }: { label: string; value: string; title?: string }) {
  return (
    <div className={`${SIZE.stat} flex flex-col justify-center rounded-2xl border border-white/20 bg-white/10 px-3`}>
      <span className="truncate text-xs leading-4 text-white/60">{label}</span>
      <span className="truncate text-base leading-6 font-bold" title={title}>
        {value}
      </span>
    </div>
  )
}

// ---- Bước 3: chạy các lệnh chuyển ----
function RunStep({ month, run, orders }: { month: string; run: FundRun; orders: FundOrder[] }) {
  const { actor, funds, showMoney } = useFund()
  // Lưu các lệnh người dùng BỎ chọn, nên lệnh mới / chưa chạy luôn được chọn sẵn
  const [skipped, setSkipped] = useState<Set<string>>(() => new Set())
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null)
  const [running, setRunning] = useState(false)

  const runnable = (o: FundOrder) => orderValid(o, funds) && !run.executed[o.id]
  const selected = orders.filter((o) => runnable(o) && !skipped.has(o.id))
  // Lệnh "toàn bộ số dư" chưa biết số tiền tới lúc chạy nên không cộng vào tổng (hiện thêm dấu "+")
  const total = selected.reduce((s, o) => s + (o.allBalance ? 0 : o.amount), 0)
  const hasAll = selected.some((o) => o.allBalance)
  const totalText = `${formatMoneyCompact(total)}${hasAll ? ' + toàn bộ' : ''}`

  function toggle(id: string) {
    setSkipped((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function execute() {
    setMessage(null)
    setRunning(true)
    try {
      await executeOrders(month, selected, funds, actor)
      setMessage({ type: 'success', text: `Đã chạy lần lượt ${selected.length} lệnh theo số thứ tự.` })
    } catch (err) {
      console.error(err)
      // Lỗi do kiểm tra (không đủ tiền, lệnh đã chạy...) có thông báo tiếng Việt; lỗi khác thì báo chung
      const text = err instanceof Error && !('code' in err) ? err.message : 'Chạy lệnh thất bại. Vui lòng thử lại.'
      setMessage({ type: 'error', text })
    } finally {
      setRunning(false)
    }
  }

  if (!run.summarizedByName) {
    return <Locked icon="🔒" text="Cần tổng kết ở bước 2 trước khi chạy lệnh chuyển." />
  }
  if (orders.length === 0) {
    return (
      <Locked icon="📝" text="Chưa có lệnh chuyển nào.">
        <Link to="/fund/orders/new" className="font-semibold text-fuchsia-200 underline">
          Tạo lệnh chuyển
        </Link>
      </Locked>
    )
  }

  const executedCount = orders.filter((o) => run.executed[o.id]).length
  return (
    <>
      <GlassPanel className={STEP_PANEL}>
        <div className="grid grid-cols-2 gap-3">
          <Stat label="Đã chọn" value={`${selected.length} lệnh`} />
          <Stat label="Tổng tiền" value={totalText} title={formatMoney(total)} />
        </div>
        <p className={`${HINT} text-white/60`}>Chạy lần lượt theo số thứ tự; chạm 1 lệnh để bỏ chọn / chọn lại</p>
        <p className={`${HINT} text-white/40`}>
          {executedCount > 0 ? `Đã chạy ${executedCount}/${orders.length} lệnh trong tháng này` : 'Mỗi lệnh chỉ chạy được 1 lần mỗi tháng'}
        </p>
      </GlassPanel>
      {message && <Alert type={message.type}>{message.text}</Alert>}
      <ScrollArea className={LIST_CLASS}>
        <div className="divide-y divide-white/10">
          {orders.map((o) => {
            const at = run.executed[o.id]
            const valid = orderValid(o, funds)
            const checked = !at && valid && !skipped.has(o.id)
            return (
              <button
                key={o.id}
                type="button"
                role="checkbox"
                aria-checked={checked}
                disabled={!!at || !valid}
                onClick={() => toggle(o.id)}
                className={`${SIZE.row} flex w-full items-center gap-3 px-4 text-left transition hover:bg-white/5 disabled:opacity-50`}
              >
                <CheckMark checked={checked || !!at} done={!!at} />
                <OrderInfo
                  order={o}
                  sub={
                    at ? (
                      <span className="text-emerald-200">
                        Đã chạy {at.toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}
                      </span>
                    ) : !valid ? (
                      <span className="text-rose-200">Quỹ đã bị xoá, hãy sửa lại lệnh</span>
                    ) : checked ? undefined : (
                      'Bỏ qua lần này'
                    )
                  }
                />
              </button>
            )
          })}
        </div>
      </ScrollArea>
      {selected.length > 0 && (
        <FabGroup>
          <Fab icon="save" label={`Chạy ${selected.length} lệnh (${hasAll ? 'có lệnh toàn bộ số dư' : showMoney(total)})`} loading={running} onClick={execute} />
        </FabGroup>
      )}
    </>
  )
}

// Ô check của lệnh (đã chạy thì màu xanh đậm, không bỏ chọn được)
function CheckMark({ checked, done }: { checked: boolean; done: boolean }) {
  return (
    <span
      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 transition ${
        checked ? (done ? 'border-emerald-200 bg-emerald-600' : 'border-emerald-300 bg-emerald-400') : 'border-white/50 bg-white/5'
      }`}
    >
      {checked && (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="#ffffff" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M5 12.5l4.5 4.5L19 7" />
        </svg>
      )}
    </span>
  )
}

// Bước chưa làm được: panel cao cố định + vùng trống thay cho danh sách
function Locked({ icon, text, children }: { icon: string; text: string; children?: ReactNode }) {
  return (
    <GlassPanel className={`${STEP_PANEL} flex flex-col items-center justify-center text-center`}>
      <Icon3D emoji={icon} className="h-10 w-10" />
      <p className="text-sm leading-5 text-white/80">{text}</p>
      {children && <p className="text-sm leading-5">{children}</p>}
    </GlassPanel>
  )
}

function StepSkeleton() {
  return (
    <>
      <GlassPanel className={STEP_PANEL}>
        <MoneyFieldSkeleton />
        <Skeleton className="h-4 w-56 rounded-md" />
      </GlassPanel>
      <ScrollArea className={`${LIST_CLASS} !overflow-hidden`}>
        <div className="divide-y divide-white/10">
          {Array.from({ length: SKELETON_ROWS }, (_, i) => (
            <OrderRowSkeleton key={i} />
          ))}
        </div>
      </ScrollArea>
    </>
  )
}

export function ExecutePageSkeleton() {
  return (
    <PageShell>
      <AppHeaderSkeleton />
      <GlassPanel className={TOP_CLASS}>
        <div className={MONTH_BAR}>
          <Skeleton className="h-10 w-10 rounded-xl" />
          <Skeleton className="mx-auto h-4 w-36 rounded-md" />
          <Skeleton className="h-10 w-10 rounded-xl" />
        </div>
        <SegmentedSkeleton count={3} />
      </GlassPanel>
      <StepSkeleton />
      <FabSkeleton />
    </PageShell>
  )
}
