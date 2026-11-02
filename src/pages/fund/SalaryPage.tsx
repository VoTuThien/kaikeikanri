import { useState } from 'react'
import { AppHeader, AppHeaderSkeleton } from '../../components/AppHeader'
import { Avatar } from '../../components/Avatar'
import { PageShell } from '../../components/PageShell'
import { Alert } from '../../components/ui/Alert'
import { GlassPanel } from '../../components/ui/GlassPanel'
import { Select } from '../../components/ui/Select'
import { Skeleton } from '../../components/ui/Skeleton'
import { FIELD_CLASS, FieldLabel, TextFieldSkeleton } from '../../components/ui/TextField'
import { useFamily } from '../../contexts/FamilyContext'
import { formatDate } from '../../lib/format'
import { useMembers } from '../family/data/useMembers'
import { useFund } from './data/FundContext'
import { monthId, shiftMonth } from './data/orders'
import { paydayOf, saveSalaryInfo, useSalaryInfos, type SalaryInfo } from './data/salary'

// Màn hình Lương: mỗi thành viên 1 thẻ, chỉ gồm [ngày nhận lương] và [chuyển vào quỹ].
// - Thẻ của mình: chỉnh trực tiếp trên thẻ, đổi là lưu ngay. Ngày nhận lương để trống = không có lương
//   (vd thất nghiệp): không nhắc, không cần nhập lương thực lãnh.
// - Thẻ của người khác: chỉ xem (cả gia đình xem được).
// Lương thực lãnh nhập ở bước 1 của màn hình Thực thi; tới ngày nhận lương thì chuông nhắc và mở màn hình đó.

const LIST_CLASS = 'min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain scroll-thin -mx-1 px-1 py-1'
const CARD = 'space-y-3 !p-4'
const CARD_HEAD = 'flex h-10 items-center gap-3'
const FIELDS = 'grid grid-cols-2 gap-3'
const HINT = 'h-5 truncate text-xs leading-5 text-white/60'
const DAYS = Array.from({ length: 31 }, (_, i) => i + 1)
const NO_SALARY = 'Không có lương'

export function SalaryPage() {
  const { loading } = useFund()
  const { current } = useFamily()
  const members = useMembers(current?.familyId)
  const infos = useSalaryInfos()
  if (loading || !members || !infos) return <SalaryPageSkeleton others={1} />
  return <Salary members={members} infos={infos} />
}

function Salary({ members, infos }: { members: { uid: string; name: string }[]; infos: SalaryInfo[] }) {
  const { actor, funds } = useFund()
  const [error, setError] = useState('')
  const mine = infos.find((i) => i.uid === actor.uid) ?? null
  const others = members.filter((m) => m.uid !== actor.uid)
  const fundName = (id: string | null) => (id ? (funds.find((f) => f.id === id)?.name ?? 'Quỹ đã xoá') : 'Không chuyển')

  async function change(data: Partial<Pick<SalaryInfo, 'payday' | 'fundId'>>) {
    setError('')
    try {
      await saveSalaryInfo(actor, data, !mine)
    } catch (err) {
      console.error(err)
      setError('Lưu thông tin lương thất bại. Vui lòng thử lại.')
    }
  }

  // Ngày nhận lương tới (tháng này nếu chưa qua, không thì tháng sau)
  const now = new Date()
  const thisMonth = monthId(now)
  const next = mine?.payday ? [thisMonth, shiftMonth(thisMonth, 1)].map((m) => paydayOf(m, mine.payday!)).find((d) => d >= startOfToday(now)) : null

  return (
    <PageShell>
      <AppHeader title="Lương" backTo="/fund" />
      {error && <Alert type="error">{error}</Alert>}
      <div className={LIST_CLASS}>
        {/* Thẻ của mình: chỉnh trực tiếp */}
        <GlassPanel className={CARD}>
          <div className={CARD_HEAD}>
            <Avatar uid={actor.uid} name={actor.name} me />
            <span className="min-w-0 flex-1 truncate text-base leading-6 font-semibold">{actor.name} (bạn)</span>
          </div>
          <div className={FIELDS}>
            <Select
              id="payday"
              label="Ngày nhận lương"
              value={mine?.payday ?? ''}
              onChange={(e) => change({ payday: e.target.value ? Number(e.target.value) : null })}
            >
              {/* Để trống = không có lương (vd thất nghiệp) */}
              <option value="">{NO_SALARY}</option>
              {DAYS.map((d) => (
                <option key={d} value={d}>
                  Ngày {d}
                </option>
              ))}
            </Select>
            <Select id="fund" label="Chuyển vào quỹ" value={mine?.fundId ?? ''} onChange={(e) => change({ fundId: e.target.value || null })}>
              <option value="">Không chuyển</option>
              {mine?.fundId && !funds.some((f) => f.id === mine.fundId) && <option value={mine.fundId}>Quỹ đã xoá</option>}
              {funds.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.icon} {f.name}
                </option>
              ))}
            </Select>
          </div>
          <p className={HINT}>
            {next ? `Ngày nhận lương tới: ${formatDate(next)}` : 'Không có lương thì không cần nhập lương thực lãnh'}
          </p>
        </GlassPanel>

        {/* Thẻ của các thành viên khác: chỉ xem, cùng bố cục với thẻ của mình */}
        {others.map((m) => {
          const info = infos.find((i) => i.uid === m.uid)
          return (
            <GlassPanel key={m.uid} className={CARD}>
              <div className={CARD_HEAD}>
                <Avatar uid={m.uid} name={m.name} />
                <span className="min-w-0 flex-1 truncate text-base leading-6 font-semibold">{m.name}</span>
              </div>
              <div className={FIELDS}>
                <ReadOnlyField label="Ngày nhận lương" value={info?.payday ? `Ngày ${info.payday}` : NO_SALARY} />
                <ReadOnlyField label="Chuyển vào quỹ" value={fundName(info?.fundId ?? null)} />
              </div>
            </GlassPanel>
          )
        })}
      </div>
    </PageShell>
  )
}

const startOfToday = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())

// Ô chỉ xem: cùng kích thước với ô chọn để thẻ của mọi người thẳng hàng
function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1.5">
      <FieldLabel>{label}</FieldLabel>
      <div className={`${FIELD_CLASS} flex items-center truncate opacity-80`}>{value}</div>
    </div>
  )
}

export function SalaryPageSkeleton({ others = 1 }: { others?: number }) {
  const card = (key: number, hint: boolean) => (
    <GlassPanel key={key} className={CARD}>
      <div className={CARD_HEAD}>
        <Skeleton className="h-9 w-9 rounded-full" />
        <Skeleton className="h-5 w-32 rounded-md" />
      </div>
      <div className={FIELDS}>
        <TextFieldSkeleton />
        <TextFieldSkeleton />
      </div>
      {hint && <Skeleton className="h-5 w-48 rounded-md" />}
    </GlassPanel>
  )
  return (
    <PageShell>
      <AppHeaderSkeleton />
      <div className={`${LIST_CLASS} !overflow-hidden`}>
        {card(0, true)}
        {Array.from({ length: others }, (_, i) => card(i + 1, false))}
      </div>
    </PageShell>
  )
}
