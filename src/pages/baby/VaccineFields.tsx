import { LineIcon } from '../../components/ui/Fab'
import { MoneyField } from '../../components/ui/MoneyField'
import { Button } from '../../components/ui/Button'
import { TextField } from '../../components/ui/TextField'

// Nhập các mũi vắc xin tiêm trong 1 ngày (form Phát triển, hiện khi check "Có tiêm vắc xin"):
// mỗi mũi 1 khung: [Phòng bệnh] [Vaccine] / [Mũi] [Nơi tiêm] / [Giá]; nút X góc khung để bỏ mũi đó, "+ Thêm vắc xin" để thêm mũi.
// Gõ xong "Phòng bệnh" (rời ô) thì tự điền mũi thứ mấy (đếm các lần tiêm trước của con) và tên vaccine / nơi tiêm / giá của lần tiêm gần nhất cùng bệnh.
// Các ô có gợi ý từ những gì cả gia đình đã từng nhập (datalist).

export interface ShotRow {
  key: string
  disease: string
  name: string
  doseText: string // "" = không ghi
  price: number
  place: string
}

let seq = 0
export const newShotRow = (v?: Partial<Omit<ShotRow, 'key'>>): ShotRow => ({
  key: `s${++seq}`,
  disease: v?.disease ?? '',
  name: v?.name ?? '',
  doseText: v?.doseText ?? '',
  price: v?.price ?? 0,
  place: v?.place ?? '',
})

const CARD = 'space-y-2 border border-white/15 bg-white/5 p-3'
const ROW_2 = 'grid grid-cols-2 gap-2'
const ROW_DOSE = 'grid grid-cols-[4.5rem_1fr] gap-2'

export function VaccineFields({
  rows,
  onChange,
  onDiseaseDone,
  suggest,
}: {
  rows: ShotRow[]
  onChange: (rows: ShotRow[]) => void
  onDiseaseDone: (key: string) => void // rời ô Phòng bệnh: điền sẵn mũi / tên / nơi / giá
  suggest: { diseases: string[]; names: string[]; places: string[] }
}) {
  const set = (key: string, patch: Partial<ShotRow>) => onChange(rows.map((r) => (r.key === key ? { ...r, ...patch } : r)))

  return (
    <div className="space-y-2">
      {rows.map((r, i) => (
        <div key={r.key} className={CARD}>
          <div className="flex h-7 items-center justify-between">
            <span className="text-xs leading-5 font-semibold text-fuchsia-200">Vắc xin {i + 1}</span>
            <button
              type="button"
              aria-label={`Bỏ vắc xin ${i + 1}`}
              onClick={() => onChange(rows.length > 1 ? rows.filter((x) => x.key !== r.key) : [newShotRow()])}
              className="flex h-7 w-7 items-center justify-center border border-white/25 bg-white/10 transition active:scale-95"
            >
              <LineIcon icon="cancel" className="h-4 w-4" />
            </button>
          </div>
          <div className={ROW_2}>
            <TextField
              id={`shot-disease-${r.key}`}
              label="Phòng bệnh"
              placeholder="vd: Lao"
              list="shot-diseases"
              autoComplete="off"
              maxLength={40}
              value={r.disease}
              onChange={(e) => set(r.key, { disease: e.target.value })}
              onBlur={() => onDiseaseDone(r.key)}
            />
            <TextField
              id={`shot-name-${r.key}`}
              label="Vaccine"
              placeholder="vd: BCG"
              list="shot-names"
              autoComplete="off"
              maxLength={40}
              value={r.name}
              onChange={(e) => set(r.key, { name: e.target.value })}
            />
          </div>
          <div className={ROW_DOSE}>
            <TextField
              id={`shot-dose-${r.key}`}
              label="Mũi"
              inputMode="numeric"
              placeholder="1"
              className="!px-3"
              value={r.doseText}
              onChange={(e) => set(r.key, { doseText: e.target.value.replace(/\D/g, '').slice(0, 2) })}
            />
            <TextField
              id={`shot-place-${r.key}`}
              label="Nơi tiêm"
              placeholder="vd: BV Hùng Vương"
              list="shot-places"
              autoComplete="off"
              maxLength={60}
              value={r.place}
              onChange={(e) => set(r.key, { place: e.target.value })}
            />
          </div>
          <MoneyField id={`shot-price-${r.key}`} label="Giá" placeholder="0" value={r.price} onChange={(price) => set(r.key, { price })} />
        </div>
      ))}
      <Button type="button" variant="secondary" onClick={() => onChange([...rows, newShotRow()])}>
        + Thêm vắc xin
      </Button>
      <datalist id="shot-diseases">
        {suggest.diseases.map((v) => (
          <option key={v} value={v} />
        ))}
      </datalist>
      <datalist id="shot-names">
        {suggest.names.map((v) => (
          <option key={v} value={v} />
        ))}
      </datalist>
      <datalist id="shot-places">
        {suggest.places.map((v) => (
          <option key={v} value={v} />
        ))}
      </datalist>
    </div>
  )
}
