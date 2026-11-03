import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AppHeader, AppHeaderSkeleton } from '../../components/AppHeader'
import { PageShell } from '../../components/PageShell'
import { Alert } from '../../components/ui/Alert'
import { GlassPanel } from '../../components/ui/GlassPanel'
import { Select } from '../../components/ui/Select'
import { Skeleton } from '../../components/ui/Skeleton'
import { TextFieldSkeleton } from '../../components/ui/TextField'
import { SIZE } from '../../components/ui/sizes'
import { saveNoteSettings } from './data/api'
import { useNote } from './data/NoteContext'

// Cài đặt của app Ghi chú (riêng từng tài khoản): quỹ chọn sẵn khi nạp / rút ở màn hình Xem ghi chú.
// Chọn là lưu ngay (không có nút lưu).

const PANEL_CLASS = '!p-5'
// Chiều cao đoạn giải thích (3 dòng × 24px) để skeleton khớp
const INFO_HEIGHT = 'h-18'

export function NoteSettingsPage() {
  const { loading } = useNote()
  if (loading) return <NoteSettingsPageSkeleton />
  return <Settings />
}

function Settings() {
  const { actor, funds, settings } = useNote()
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null)
  // Quỹ đã chọn bị xoá thì coi như chưa chọn
  const value = funds.some((f) => f.id === settings.defaultFundId) ? settings.defaultFundId! : ''

  function change(id: string) {
    setMessage(null)
    saveNoteSettings(actor.uid, { defaultFundId: id || null })
      .then(() => {
        const fund = funds.find((f) => f.id === id)
        setMessage({ type: 'success', text: fund ? `Đã chọn ${fund.name} làm quỹ mặc định.` : 'Đã bỏ quỹ mặc định.' })
      })
      .catch((err) => {
        console.error(err)
        setMessage({ type: 'error', text: 'Lưu thất bại. Vui lòng thử lại.' })
      })
  }

  return (
    <PageShell>
      <AppHeader title="Cài đặt" backTo="/note" />
      <GlassPanel className={`${PANEL_CLASS} space-y-3`}>
        {funds.length === 0 ? (
          <p className="text-sm leading-5 text-white/70">
            Chưa có nhóm quỹ nào.{' '}
            <Link to="/fund/groups/new" className="font-semibold text-fuchsia-200 underline">
              Tạo nhóm quỹ
            </Link>{' '}
            để nạp / rút tiền khi xem ghi chú.
          </p>
        ) : (
          <Select id="note-default-fund" label="Quỹ mặc định khi nạp / rút" value={value} onChange={(e) => change(e.target.value)}>
            <option value="">Không chọn (dùng quỹ đầu tiên)</option>
            {funds.map((f) => (
              <option key={f.id} value={f.id}>
                {f.icon} {f.name}
              </option>
            ))}
          </Select>
        )}
        {message && <Alert type={message.type}>{message.text}</Alert>}
      </GlassPanel>

      <GlassPanel className={`${PANEL_CLASS} space-y-1 text-sm leading-6 text-white/70`}>
        <h2 className={`${SIZE.sectionTitle} text-base leading-6 font-semibold text-white`}>Nạp / rút khi xem ghi chú</h2>
        <p className={INFO_HEIGHT}>
          Ở màn hình Xem ghi chú, ô chọn quỹ được chọn sẵn quỹ này. Nội dung ghi chú được dùng làm ghi chú của giao dịch, xem lại ở Tra cứu
          của app Quỹ.
        </p>
      </GlassPanel>
    </PageShell>
  )
}

export function NoteSettingsPageSkeleton() {
  return (
    <PageShell>
      <AppHeaderSkeleton />
      <GlassPanel className={`${PANEL_CLASS} space-y-3`}>
        <TextFieldSkeleton />
      </GlassPanel>
      <GlassPanel className={`${PANEL_CLASS} space-y-1`}>
        <Skeleton className={`${SIZE.sectionTitle} w-48 rounded-md`} />
        <Skeleton className={`${INFO_HEIGHT} w-full`} />
      </GlassPanel>
    </PageShell>
  )
}
