import { useState, type FormEvent } from 'react'
import { AppHeader, AppHeaderSkeleton } from '../../components/AppHeader'
import { PageShell } from '../../components/PageShell'
import { Alert } from '../../components/ui/Alert'
import { Fab, FabGroup, FabSkeleton } from '../../components/ui/Fab'
import { GlassPanel } from '../../components/ui/GlassPanel'
import { Skeleton } from '../../components/ui/Skeleton'
import { TextField, TextFieldSkeleton } from '../../components/ui/TextField'
import { ToggleRow, ToggleRowSkeleton } from '../../components/ui/Toggle'
import { SIZE } from '../../components/ui/sizes'
import { saveSettings } from './data/api'
import { useFund } from './data/FundContext'

const PANEL_CLASS = '!p-5'
const FORM_ID = 'fund-settings-form'
// Chiều cao đoạn giải thích (5 dòng × 24px) để skeleton khớp
const INFO_HEIGHT = 'h-30'

export function FundSettingsPage() {
  const { loading } = useFund()
  if (loading) return <FundSettingsPageSkeleton />
  return <Settings />
}

function Settings() {
  const { actor, settings } = useFund()
  const uid = actor.uid
  const [rateText, setRateText] = useState(String(settings.defaultInterestRate))
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null)
  const [saving, setSaving] = useState(false)

  function toggle(key: 'hideBalance' | 'showQuickAmounts', value: boolean) {
    saveSettings(uid, { [key]: value }).catch((e) => console.error(e))
  }

  async function handleSaveRate(e: FormEvent) {
    e.preventDefault()
    const rate = Number(rateText.replace(',', '.'))
    if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
      return setMessage({ type: 'error', text: 'Lãi suất phải từ 0 đến 100 %/năm.' })
    }
    setSaving(true)
    try {
      await saveSettings(uid, { defaultInterestRate: rate })
      setMessage({ type: 'success', text: 'Đã lưu lãi suất mặc định.' })
    } catch (err) {
      console.error(err)
      setMessage({ type: 'error', text: 'Lưu thất bại. Vui lòng thử lại.' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <PageShell>
      <AppHeader title="Cài đặt" backTo="/fund" />

      <GlassPanel className="divide-y divide-white/10 !p-0">
        <ToggleRow
          label="Ẩn số dư"
          description="Che số tiền khi mở app ở nơi đông người"
          checked={settings.hideBalance}
          onChange={(v) => toggle('hideBalance', v)}
        />
        <ToggleRow
          label="Nút chọn nhanh số tiền"
          description="Hiện nút 100K, 500K, 1 Tr, 5 Tr khi nạp / rút"
          checked={settings.showQuickAmounts}
          onChange={(v) => toggle('showQuickAmounts', v)}
        />
      </GlassPanel>

      <GlassPanel className={PANEL_CLASS}>
        <form id={FORM_ID} onSubmit={handleSaveRate} className="space-y-3" noValidate>
          <TextField
            id="default-rate"
            label="Lãi suất mặc định khi tạo quỹ mới"
            suffix="%/năm"
            inputMode="decimal"
            value={rateText}
            onChange={(e) => setRateText(e.target.value.replace(/[^\d.,]/g, ''))}
          />
          {message && <Alert type={message.type}>{message.text}</Alert>}
        </form>
      </GlassPanel>

      <GlassPanel className={`${PANEL_CLASS} space-y-1 text-sm leading-6 text-white/70`}>
        <h2 className={`${SIZE.sectionTitle} text-base leading-6 font-semibold text-white`}>Cách tính lãi</h2>
        <p className={INFO_HEIGHT}>
          Mỗi tháng, đúng ngày tạo quỹ (hoặc ngày bật lãi), quỹ được cộng thêm: số dư × lãi suất năm ÷ 12. Tiền lãi cộng dồn vào
          số dư nên tháng sau tính lãi trên cả tiền lãi (lãi kép). Lâu không mở app thì sẽ được cộng bù đủ các tháng.
        </p>
      </GlassPanel>

      {/* Công tắc tự lưu ngay khi bấm; nút lưu chỉ dùng cho lãi suất mặc định */}
      <FabGroup>
        <Fab type="submit" form={FORM_ID} icon="save" label="Lưu lãi suất mặc định" loading={saving} />
      </FabGroup>
    </PageShell>
  )
}

export function FundSettingsPageSkeleton() {
  return (
    <PageShell>
      <AppHeaderSkeleton />
      <GlassPanel className="divide-y divide-white/10 !p-0">
        <ToggleRowSkeleton />
        <ToggleRowSkeleton />
      </GlassPanel>
      <GlassPanel className={PANEL_CLASS}>
        <TextFieldSkeleton />
      </GlassPanel>
      <GlassPanel className={`${PANEL_CLASS} space-y-1`}>
        <Skeleton className={`${SIZE.sectionTitle} w-32 rounded-md`} />
        <Skeleton className={`${INFO_HEIGHT} w-full`} />
      </GlassPanel>
      <FabSkeleton />
    </PageShell>
  )
}
