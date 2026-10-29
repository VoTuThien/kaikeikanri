import { lazy, Suspense, useState, type FormEvent } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { AppHeader, AppHeaderSkeleton } from '../../components/AppHeader'
import { FIT_CLASS, PageShell } from '../../components/PageShell'
import { Alert } from '../../components/ui/Alert'
import { Button } from '../../components/ui/Button'
import { FabSkeleton, SaveDeleteFabs } from '../../components/ui/Fab'
import { GlassPanel } from '../../components/ui/GlassPanel'
import { Icon3D } from '../../components/ui/Icon3D'
import { Skeleton } from '../../components/ui/Skeleton'
import { FieldLabel, TextField, TextFieldSkeleton } from '../../components/ui/TextField'
import { SIZE } from '../../components/ui/sizes'
import { TILE_3D, TILE_3D_SELECTED } from '../../components/ui/style3d'
import { createPlace, deletePlace, formatCoords, parseCoords, updatePlace } from './data/api'
import { footprint } from './data/layout'
import { useStatus } from './data/StatusContext'
import { PLACE_TYPES, placeTypeInfo, type Place, type PlaceType } from './data/types'

// Thư viện 3D chỉ tải khi mở màn hình này
const PlacePreview = lazy(() => import('./models/PlacePreview'))

// Thu gọn khoảng cách để form vừa 1 màn hình iPhone
const PANEL_CLASS = '!p-5'
const FORM_CLASS = 'space-y-3'
const FORM_ID = 'place-form'
const PREVIEW_HEIGHT = 'h-28'
// 7 loại địa điểm trên 1 hàng, ô bằng nhau
const TYPE_GRID = 'grid grid-cols-7 gap-1.5'
// Ô tọa độ chiếm 2 cột, nút lấy vị trí 1 cột, căn đáy để thẳng hàng với ô nhập
const COORD_ROW = 'grid grid-cols-3 items-end gap-3'

const DEFAULT_HINT = 'Dán tọa độ từ Google Maps (vd 10.776889, 106.700806) hoặc bấm "Vị trí".'

export function PlaceFormPage() {
  const { id } = useParams()
  const { loading, places } = useStatus()
  const isNew = !id
  if (loading) return <PlaceFormPageSkeleton isNew={isNew} />

  const place = places.find((p) => p.id === id)
  if (!isNew && !place) return <Navigate to="/status/places" replace />
  return <PlaceForm key={id ?? 'new'} place={place} />
}

function PlaceForm({ place }: { place?: Place }) {
  const { actor } = useStatus()
  const navigate = useNavigate()
  const isNew = !place

  const [type, setType] = useState<PlaceType>(place?.type ?? 'house')
  const [name, setName] = useState(place?.name ?? '')
  const [coordText, setCoordText] = useState(place ? formatCoords(place.lat, place.lng) : '')
  const [note, setNote] = useState(place?.note ?? '')
  const [hint, setHint] = useState(DEFAULT_HINT)
  const [locating, setLocating] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  function fillCurrentLocation() {
    if (!navigator.geolocation) return setError('Thiết bị không hỗ trợ lấy vị trí.')
    setError('')
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoordText(formatCoords(pos.coords.latitude, pos.coords.longitude))
        setHint(`Đã lấy vị trí hiện tại, sai số khoảng ±${Math.round(pos.coords.accuracy)}m.`)
        setLocating(false)
      },
      (err) => {
        setError(
          err.code === err.PERMISSION_DENIED
            ? 'Bạn chưa cho phép app dùng vị trí. Hãy bật trong Cài đặt > Quyền riêng tư > Dịch vụ định vị.'
            : 'Không lấy được vị trí. Hãy thử lại ở nơi thoáng hơn.',
        )
        setLocating(false)
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    )
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    const coords = parseCoords(coordText)
    if (!name.trim()) return setError('Vui lòng nhập tên địa điểm.')
    if (!coords) return setError('Tọa độ chưa đúng. Ví dụ đúng: 10.776889, 106.700806')

    setSaving(true)
    try {
      const input = { name: name.trim(), type, ...coords, note: note.trim() }
      if (isNew) await createPlace(input, actor)
      else await updatePlace(place.id, input)
      navigate('/status/places')
    } catch (err) {
      console.error(err)
      setError('Lưu thất bại. Vui lòng thử lại.')
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!place) return
    setDeleting(true)
    try {
      await deletePlace(place.id)
      navigate('/status/places')
    } catch (err) {
      console.error(err)
      setError('Xoá thất bại. Vui lòng thử lại.')
      setDeleting(false)
    }
  }

  return (
    <PageShell>
      <AppHeader title={isNew ? 'Tạo địa điểm' : 'Sửa địa điểm'} backTo="/status/places" />
      <GlassPanel className={`${PANEL_CLASS} ${FIT_CLASS}`}>
        <form id={FORM_ID} onSubmit={handleSubmit} className={FORM_CLASS} noValidate>
          {/* Xem trước mô hình 3D của loại đang chọn */}
          <div className={`${PREVIEW_HEIGHT} relative overflow-hidden rounded-2xl border border-white/15 bg-gradient-to-b from-sky-300/25 to-indigo-900/30`}>
            <Suspense fallback={<Skeleton className="h-full w-full rounded-none" />}>
              <PlacePreview type={type} />
            </Suspense>
            <span className="pointer-events-none absolute bottom-2 left-2 rounded-full border border-white/25 bg-black/30 px-3 text-xs leading-6 font-semibold backdrop-blur">
              {placeTypeInfo(type).label} · {footprint(type)}×{footprint(type)} ô
            </span>
          </div>

          <div className="space-y-1.5">
            <FieldLabel>Loại địa điểm</FieldLabel>
            <div className={TYPE_GRID}>
              {PLACE_TYPES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setType(t.value)}
                  aria-pressed={t.value === type}
                  aria-label={t.label}
                  title={t.label}
                  className={`${SIZE.control} flex items-center justify-center rounded-xl transition duration-150 ${
                    t.value === type ? TILE_3D_SELECTED : TILE_3D
                  }`}
                >
                  <Icon3D emoji={t.emoji} className={`h-7 w-7 transition-transform ${t.value === type ? 'scale-110' : ''}`} />
                </button>
              ))}
            </div>
          </div>

          <TextField
            id="name"
            label="Tên địa điểm"
            placeholder="Ví dụ: Nhà bà ngoại"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={40}
          />

          <div className={COORD_ROW}>
            <div className="col-span-2">
              <TextField
                id="coords"
                label="Tọa độ"
                inputMode="decimal"
                placeholder="10.776889, 106.700806"
                value={coordText}
                onChange={(e) => setCoordText(e.target.value)}
                autoComplete="off"
              />
            </div>
            <Button type="button" variant="secondary" loading={locating} onClick={fillCurrentLocation} className="gap-1 !px-2">
              <Icon3D emoji="📍" className="h-6 w-6" />
              Vị trí
            </Button>
          </div>

          <TextField
            id="note"
            label="Ghi chú (không bắt buộc)"
            placeholder="Ví dụ: Cổng phụ đường Lê Lợi"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={100}
          />

          {/* Cố định 2 dòng để chiều cao không đổi */}
          <p className={`${SIZE.hint} line-clamp-2 text-xs leading-5 text-white/60`}>
            {confirmDelete ? 'Bấm nút thùng rác lần nữa để xoá địa điểm này (cả mô hình trên bản đồ mini).' : hint}
          </p>

          {error && <Alert type="error">{error}</Alert>}
        </form>
      </GlassPanel>
      <SaveDeleteFabs
        formId={FORM_ID}
        canDelete={!isNew}
        confirming={confirmDelete}
        saving={saving}
        deleting={deleting}
        saveLabel={isNew ? 'Tạo địa điểm' : 'Lưu thay đổi'}
        deleteLabel="Xoá địa điểm"
        onAskDelete={() => setConfirmDelete(true)}
        onCancelDelete={() => setConfirmDelete(false)}
        onDelete={handleDelete}
      />
    </PageShell>
  )
}

export function PlaceFormPageSkeleton({ isNew }: { isNew: boolean }) {
  return (
    <PageShell>
      <AppHeaderSkeleton />
      <GlassPanel className={`${PANEL_CLASS} ${FIT_CLASS}`}>
        <div className={FORM_CLASS}>
          <Skeleton className={`${PREVIEW_HEIGHT} w-full rounded-2xl`} />
          <div className="space-y-1.5">
            <Skeleton className={`${SIZE.label} w-28 rounded-md`} />
            <div className={TYPE_GRID}>
              {PLACE_TYPES.map((t) => (
                <Skeleton key={t.value} className={SIZE.control} />
              ))}
            </div>
          </div>
          <TextFieldSkeleton />
          <div className={COORD_ROW}>
            <div className="col-span-2">
              <TextFieldSkeleton />
            </div>
            <Skeleton className={SIZE.control} />
          </div>
          <TextFieldSkeleton />
          <div className={`${SIZE.hint} space-y-1`}>
            <Skeleton className="h-4 w-64 rounded-md" />
            <Skeleton className="h-4 w-40 rounded-md" />
          </div>
        </div>
      </GlassPanel>
      <FabSkeleton count={isNew ? 1 : 2} />
    </PageShell>
  )
}
