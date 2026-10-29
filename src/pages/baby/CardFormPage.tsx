import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { AppHeader, AppHeaderSkeleton } from '../../components/AppHeader'
import { FIT_CLASS, PageShell } from '../../components/PageShell'
import { Alert } from '../../components/ui/Alert'
import { FabSkeleton, SaveDeleteFabs } from '../../components/ui/Fab'
import { GlassPanel } from '../../components/ui/GlassPanel'
import { Icon3D } from '../../components/ui/Icon3D'
import { MinutesField } from '../../components/ui/MinutesField'
import { Segmented, SegmentedSkeleton } from '../../components/ui/Segmented'
import { Skeleton } from '../../components/ui/Skeleton'
import { FieldLabel, TextField, TextFieldSkeleton } from '../../components/ui/TextField'
import { SIZE } from '../../components/ui/sizes'
import { BLOCK_3D, GLOSS_3D, TILE_3D, TILE_3D_SELECTED } from '../../components/ui/style3d'
import { CardIcon } from './components'
import { createCard, deleteCard, updateCard } from './data/api'
import { useBaby } from './data/BabyContext'
import { CARD_COLORS, CARD_ICONS, formatDuration, MAX_MINUTES, type BabyCard } from './data/types'

// Lưới 6 cột cho chọn icon và màu: mọi ô cùng kích thước, thẳng cột với nhau
const PICKER_GRID = 'grid grid-cols-6 gap-2'
// Thu gọn khoảng cách để form vừa 1 màn hình iPhone
const PANEL_CLASS = '!p-5'
const FORM_CLASS = 'space-y-3'
const FORM_ID = 'baby-card-form'
const PREVIEW = 'h-16'

// Chọn nhanh thời gian mặc định (đơn vị phút, giống ô nhập)
const QUICK_MINUTES = [15, 30, 45, 60, 90, 120].map((m) => ({ value: m, label: String(m) }))

export function CardFormPage() {
  const { id } = useParams()
  const { loading, cards } = useBaby()
  const isNew = !id
  if (loading) return <CardFormPageSkeleton isNew={isNew} />

  const card = cards.find((c) => c.id === id)
  if (!isNew && !card) return <Navigate to="/baby/cards" replace />
  return <CardForm key={id ?? 'new'} card={card} />
}

function CardForm({ card }: { card?: BabyCard }) {
  const { actor } = useBaby()
  const navigate = useNavigate()
  const isNew = !card

  const [icon, setIcon] = useState(card?.icon ?? CARD_ICONS[0].emoji)
  // Tạo mới: tên gợi ý theo icon cho tới khi người dùng tự gõ tên
  const [name, setName] = useState(card?.name ?? '')
  const [color, setColor] = useState(card?.color ?? CARD_COLORS[0])
  const [minutesText, setMinutesText] = useState(String(card?.defaultMinutes ?? 30))
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const minutes = Number(minutesText) || 0
  const iconLabel = CARD_ICONS.find((i) => i.emoji === icon)?.label ?? ''
  const displayName = name.trim() || iconLabel

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (!displayName) return setError('Vui lòng nhập tên thẻ.')
    if (minutes < 1 || minutes > MAX_MINUTES) return setError('Thời gian mặc định phải từ 1 phút đến 24 giờ.')

    setSaving(true)
    try {
      const input = { name: displayName, icon, color, defaultMinutes: minutes }
      if (isNew) await createCard(input, actor)
      else await updateCard(card.id, input)
      navigate('/baby/cards')
    } catch (err) {
      console.error(err)
      setError('Lưu thất bại. Vui lòng thử lại.')
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!card) return
    setDeleting(true)
    try {
      await deleteCard(card.id)
      navigate('/baby/cards')
    } catch (err) {
      console.error(err)
      setError('Xoá thất bại. Vui lòng thử lại.')
      setDeleting(false)
    }
  }

  return (
    <PageShell>
      <AppHeader title={isNew ? 'Tạo thẻ hoạt động' : 'Sửa thẻ hoạt động'} backTo="/baby/cards" />
      <GlassPanel className={`${PANEL_CLASS} ${FIT_CLASS}`}>
        <form id={FORM_ID} onSubmit={handleSubmit} className={FORM_CLASS} noValidate>
          {/* Xem trước thẻ như khi nằm trong khay ở Time line */}
          <div className={`${PREVIEW} flex items-center gap-3 rounded-2xl border border-white/15 bg-white/5 px-3`}>
            <CardIcon icon={icon} color={color} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-base leading-6 font-semibold">{displayName || 'Tên thẻ'}</span>
              <span className="block truncate text-xs leading-5 text-white/60">
                {minutes > 0 ? `Mặc định ${formatDuration(Math.min(minutes, MAX_MINUTES))}` : 'Chưa có thời gian mặc định'}
              </span>
            </span>
          </div>

          <TextField
            id="name"
            label="Tên thẻ"
            placeholder={iconLabel ? `Ví dụ: ${iconLabel}` : 'Ví dụ: Ăn sữa'}
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={30}
          />

          <div className="space-y-1.5">
            <FieldLabel>Icon</FieldLabel>
            <div className={PICKER_GRID}>
              {CARD_ICONS.map((i) => (
                <button
                  key={i.emoji}
                  type="button"
                  onClick={() => setIcon(i.emoji)}
                  aria-pressed={i.emoji === icon}
                  aria-label={i.label}
                  title={i.label}
                  className={`${SIZE.control} flex items-center justify-center rounded-xl transition duration-150 ${
                    i.emoji === icon ? TILE_3D_SELECTED : TILE_3D
                  }`}
                >
                  <Icon3D emoji={i.emoji} className={`h-8 w-8 transition-transform ${i.emoji === icon ? 'scale-110' : ''}`} />
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <FieldLabel>Màu</FieldLabel>
            <div className={PICKER_GRID}>
              {CARD_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  aria-pressed={c === color}
                  aria-label={`Màu ${c}`}
                  className={`${SIZE.control} relative rounded-xl bg-gradient-to-br transition duration-150 active:translate-y-0.5 ${c} ${BLOCK_3D} ${
                    c === color ? '-translate-y-0.5 ring-2 ring-white ring-offset-2 ring-offset-indigo-900' : ''
                  }`}
                >
                  <span className={GLOSS_3D} />
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <MinutesField
              id="minutes"
              label="Thời gian mặc định"
              suffix="phút"
              placeholder="30"
              max={MAX_MINUTES}
              value={minutesText}
              onChange={setMinutesText}
            />
            <Segmented
              options={QUICK_MINUTES}
              value={QUICK_MINUTES.some((q) => q.value === minutes) ? minutes : null}
              onChange={(v) => setMinutesText(String(v))}
            />
          </div>

          {confirmDelete && <Alert type="error">Bấm thùng rác lần nữa để xoá thẻ. Các hoạt động đã ghi vẫn được giữ lại.</Alert>}
          {error && <Alert type="error">{error}</Alert>}
        </form>
      </GlassPanel>
      <SaveDeleteFabs
        formId={FORM_ID}
        canDelete={!isNew}
        confirming={confirmDelete}
        saving={saving}
        deleting={deleting}
        saveLabel={isNew ? 'Tạo thẻ' : 'Lưu thay đổi'}
        deleteLabel="Xoá thẻ"
        onAskDelete={() => setConfirmDelete(true)}
        onCancelDelete={() => setConfirmDelete(false)}
        onDelete={handleDelete}
      />
    </PageShell>
  )
}

export function CardFormPageSkeleton({ isNew }: { isNew: boolean }) {
  const picker = (n: number) => (
    <div className="space-y-1.5">
      <Skeleton className={`${SIZE.label} w-16 rounded-md`} />
      <div className={PICKER_GRID}>
        {Array.from({ length: n }, (_, i) => (
          <Skeleton key={i} className={SIZE.control} />
        ))}
      </div>
    </div>
  )
  return (
    <PageShell>
      <AppHeaderSkeleton />
      <GlassPanel className={`${PANEL_CLASS} ${FIT_CLASS}`}>
        <div className={FORM_CLASS}>
          <Skeleton className={`${PREVIEW} w-full rounded-2xl`} />
          <TextFieldSkeleton />
          {picker(CARD_ICONS.length)}
          {picker(CARD_COLORS.length)}
          <div className="space-y-2">
            <TextFieldSkeleton />
            <SegmentedSkeleton count={QUICK_MINUTES.length} />
          </div>
        </div>
      </GlassPanel>
      <FabSkeleton count={isNew ? 1 : 2} />
    </PageShell>
  )
}
