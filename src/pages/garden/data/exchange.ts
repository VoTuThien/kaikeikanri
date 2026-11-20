// Đổi mảnh vỡ sao ở cửa hàng (tab "Đổi sao", xem CLAUDE.md "Mảnh vỡ sao"). Giới hạn số lần MỖI THÁNG (làm mới đầu tháng, cùng lúc đổi banner).
import { CROPS } from './crops'
import { INSECTS, bannerOf } from './gacha'
import type { ShardId } from './items'
import { POT_SETS, type Rank } from './pots'

// `choose`: món phải chọn loại trước khi đổi (chậu / hạt / côn trùng)
export type Choose = 'potS' | 'potA' | 'seedS' | 'seedA' | 'insect'
export interface Offer {
  id: string
  pay: ShardId
  price: number
  limit: number // số lần / tháng
  name: string
  icon: string
  give: { vong_tinh?: number; sao_duyen?: number; charm?: 'S' | 'A' | 'keep'; fert?: { id: 'B' | 'A'; qty: number }; seeds?: number; insects?: number; pot?: true }
  choose?: Choose
}
export const OFFERS: Offer[] = [
  { id: 'ss_charmS', pay: 'sao_sang', price: 10, limit: 2, name: 'Bùa may mắn S', icon: '🍀', give: { charm: 'S' } },
  { id: 'ss_keep', pay: 'sao_sang', price: 8, limit: 2, name: 'Bùa giữ cấp', icon: '🔒', give: { charm: 'keep' } },
  { id: 'ss_seedS', pay: 'sao_sang', price: 5, limit: 2, name: '10 hạt hạng S (chọn loại)', icon: '🌱', give: { seeds: 10 }, choose: 'seedS' },
  { id: 'ss_vong', pay: 'sao_sang', price: 5, limit: 5, name: '1 Vọng Tinh', icon: '⭐', give: { vong_tinh: 1 } },
  { id: 'ss_potS', pay: 'sao_sang', price: 120, limit: 1, name: 'Chọn 1 chậu S (không thuộc banner đang chạy)', icon: '🪴', give: { pot: true }, choose: 'potS' },
  { id: 's_charmA', pay: 'sao', price: 20, limit: 5, name: 'Bùa may mắn A', icon: '🍀', give: { charm: 'A' } },
  { id: 's_vong', pay: 'sao', price: 15, limit: 5, name: '1 Vọng Tinh', icon: '⭐', give: { vong_tinh: 1 } },
  { id: 's_sao', pay: 'sao', price: 15, limit: 5, name: '1 Sao Duyên', icon: '⭐', give: { sao_duyen: 1 } },
  { id: 's_seedA', pay: 'sao', price: 30, limit: 3, name: '10 hạt hạng A (chọn loại)', icon: '🌱', give: { seeds: 10 }, choose: 'seedA' },
  { id: 's_potA', pay: 'sao', price: 80, limit: 1, name: 'Chọn 1 chậu A', icon: '🪴', give: { pot: true }, choose: 'potA' },
  { id: 's_insect', pay: 'sao', price: 10, limit: 5, name: '5 côn trùng (chọn loại)', icon: '🐞', give: { insects: 5 }, choose: 'insect' },
  { id: 's_fertB', pay: 'sao', price: 2, limit: 5, name: '10 túi phân bón B', icon: '🌱', give: { fert: { id: 'B', qty: 10 } } },
  { id: 's_fertA', pay: 'sao', price: 4, limit: 5, name: '5 túi phân bón A', icon: '🌿', give: { fert: { id: 'A', qty: 5 } } },
]
export const offerById = new Map(OFFERS.map((o) => [o.id, o]))

const potKindsOf = (rank: Rank, skipSet?: string) => POT_SETS.filter((s) => s.rank === rank && s.id !== skipSet).flatMap((s) => s.kinds)
// Các lựa chọn của 1 món (id chậu / cây / côn trùng); rỗng = món chưa đổi được (vd chưa có cây hạng A)
export function choicesOf(c: Choose, date = new Date()): string[] {
  if (c === 'potS') return potKindsOf('S', bannerOf(date).setId)
  if (c === 'potA') return potKindsOf('A')
  if (c === 'seedS') return CROPS.filter((x) => x.rank === 'S').map((x) => x.id)
  if (c === 'seedA') return CROPS.filter((x) => x.rank === 'A').map((x) => x.id)
  return INSECTS.map((i) => i.id)
}
export const offerAvailable = (o: Offer) => !o.choose || choicesOf(o.choose).length > 0
