import { useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Segmented } from '../../components/ui/Segmented'
import { Select } from '../../components/ui/Select'
import { FieldLabel, TextField } from '../../components/ui/TextField'
import { foodKey, TRIAL_DAYS, trialInfo, type BabyFood } from './data/foods'
import { MEAL_RATINGS, MEAL_TEXTURES, type BabyMeal } from './data/types'

// Phần CHI TIẾT BỮA ĂN DẶM trong khung nhập ở Time line (chỉ hiện với thẻ ăn dặm 🥣):
// - Món ăn: chạm các thực phẩm của con để chọn (món từng có phản ứng viền đỏ, chọn thì cảnh báo); gõ món mới rồi "Thêm"
//   (món mới sẽ tự thêm vào danh sách Thực phẩm, trạng thái đang thử, khi lưu bữa ăn).
// - Lượng ăn, độ thô, con ăn thế nào (Ăn hết / Ăn được / Ăn ít / Không ăn).
// - Quy tắc thử món mới 3 ngày: thêm món mới khi đang theo dõi món khác thì nhắc.

export const EMPTY_MEAL: BabyMeal = { foods: [], amount: '', texture: '', rating: null }

const CHIPS = 'flex max-h-[4.75rem] flex-wrap gap-1.5 overflow-y-auto overscroll-contain'
const CHIP = 'h-7 border px-2.5 text-xs leading-6 font-semibold transition active:scale-95'

export function MealFields({ meal, onChange, foods, date }: { meal: BabyMeal; onChange: (meal: BabyMeal) => void; foods: BabyFood[]; date: string }) {
  const [draft, setDraft] = useState('')
  const set = (patch: Partial<BabyMeal>) => onChange({ ...meal, ...patch })
  const picked = new Set(meal.foods.map(foodKey))
  const byKey = new Map(foods.map((f) => [foodKey(f.name), f]))

  function toggle(name: string) {
    const k = foodKey(name)
    set({ foods: picked.has(k) ? meal.foods.filter((f) => foodKey(f) !== k) : [...meal.foods, name] })
  }

  function addDraft() {
    const name = draft.trim().replace(/\s+/g, ' ')
    if (!name) return
    // Đã có trong danh sách thì chọn món đó (giữ đúng tên đã lưu)
    const known = byKey.get(foodKey(name))
    if (!picked.has(foodKey(name))) set({ foods: [...meal.foods, known?.name ?? name] })
    setDraft('')
  }

  // Cảnh báo: món từng có phản ứng; món mới khi đang theo dõi món khác (quy tắc 3 ngày)
  const reactions = meal.foods.map((n) => byKey.get(foodKey(n))).filter((f): f is BabyFood => f?.status === 'reaction')
  const newOnes = meal.foods.filter((n) => !byKey.has(foodKey(n)))
  const trials = foods.filter((f) => {
    const t = trialInfo(f, date)
    return t && !t.due && !picked.has(foodKey(f.name))
  })
  // Chip: món đã chọn trước, rồi các món khác của con (có phản ứng xếp cuối)
  const chips = [
    ...meal.foods,
    ...foods.filter((f) => !picked.has(foodKey(f.name))).sort((a, b) => Number(a.status === 'reaction') - Number(b.status === 'reaction')).map((f) => f.name),
  ]

  return (
    <div className="space-y-2 border-t border-white/10 pt-2">
      <FieldLabel>Món ăn dặm</FieldLabel>
      {chips.length > 0 && (
        <div className={CHIPS}>
          {chips.map((name) => {
            const on = picked.has(foodKey(name))
            const food = byKey.get(foodKey(name))
            const bad = food?.status === 'reaction'
            return (
              <button
                key={foodKey(name)}
                type="button"
                aria-pressed={on}
                onClick={() => toggle(name)}
                className={`${CHIP} ${
                  on
                    ? bad
                      ? 'border-rose-200 bg-rose-500/60'
                      : 'border-fuchsia-200/80 bg-fuchsia-400/45'
                    : bad
                      ? 'border-rose-300/70 bg-rose-500/10 text-rose-100'
                      : 'border-white/25 bg-white/10 text-white/80'
                }`}
              >
                {name}
                {!food && on ? ' · mới' : ''}
              </button>
            )
          })}
        </div>
      )}
      {/* Món mới: gõ tên rồi Thêm (Enter cũng thêm, không gửi form) */}
      <div className="grid grid-cols-[1fr_5rem] gap-2">
        <TextField
          id="meal-new-food"
          label="Món mới"
          hideLabel
          placeholder="Thêm món, vd: Bí đỏ"
          autoComplete="off"
          maxLength={40}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              addDraft()
            }
          }}
        />
        <Button type="button" variant="secondary" onClick={addDraft} disabled={!draft.trim()}>
          Thêm
        </Button>
      </div>
      {reactions.length > 0 && (
        <p className="text-xs leading-4 font-semibold text-rose-200">
          {`Cẩn thận: ${reactions.map((f) => `${f.name}${f.reaction ? ` (${f.reaction})` : ''}`).join(', ')} từng có phản ứng.`}
        </p>
      )}
      {newOnes.length > 0 && trials.length > 0 && (
        <p className="text-xs leading-4 text-amber-100">
          {`Đang theo dõi ${trials.map((f) => f.name).join(', ')} (quy tắc ${TRIAL_DAYS} ngày): chưa nên cho thử món mới ${newOnes.join(', ')}.`}
        </p>
      )}
      <div className="grid grid-cols-2 gap-2">
        <TextField id="meal-amount" label="Lượng ăn" placeholder="vd: 5 thìa" maxLength={30} value={meal.amount} onChange={(e) => set({ amount: e.target.value })} />
        <Select id="meal-texture" label="Độ thô" value={meal.texture} onChange={(e) => set({ texture: e.target.value })}>
          <option value="">Không ghi</option>
          {MEAL_TEXTURES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </Select>
      </div>
      <div className="space-y-1.5">
        <FieldLabel>Con ăn thế nào</FieldLabel>
        <Segmented options={MEAL_RATINGS} value={meal.rating} onChange={(rating) => set({ rating: meal.rating === rating ? null : rating })} />
      </div>
    </div>
  )
}

// Bữa ăn có ghi gì không (để lưu null khi để trống hết)
export const mealIsEmpty = (m: BabyMeal) => m.foods.length === 0 && !m.amount.trim() && !m.texture && !m.rating
