import { useState } from 'react'
import { LineIcon } from '../../../components/ui/Fab'
import { Icon3D } from '../../../components/ui/Icon3D'
import type { Actor } from '../../../lib/firestore'
import { claimMails, errorText } from '../data/api'
import { cropById, cropImage } from '../data/crops'
import { insectById } from '../data/gacha'
import type { Mail, MailRewards } from '../data/mail'
import { potImage, potKindById } from '../data/pots'
import { DragScroll } from './DragScroll'
import { FEATHER_IMG, ROLL_IMG, STONE_IMG } from './GachaUi'
import { BTN } from './PotUi'

// Popup Hòm thư (xem CLAUDE.md "Hòm thư"): trái = danh sách thư (mới nhất trước, chưa nhận đậm + chấm đỏ, hết hạn mờ),
// phải = nội dung thư đang chọn + các ô quà + nút [Nhận]; thanh trên có [Nhận tất cả]. Thư do quản trị gửi bằng script.

const day = (ms: number) => new Date(ms).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
const DAY = 24 * 3600 * 1000
function expiryText(m: Mail, now: number) {
  if (m.claimedAt) return `Đã nhận ${day(m.claimedAt)}`
  if (!m.expiresAt) return 'Không hết hạn'
  if (m.expiresAt <= now) return 'Đã hết hạn'
  const d = Math.ceil((m.expiresAt - now) / DAY)
  return d <= 1 ? 'Hết hạn trong hôm nay' : `Còn ${d} ngày`
}

// Các ô quà của thư (ảnh + số lượng)
interface Gift { key: string; label: string; n: number; img?: string; emoji?: string }
export function mailGifts(r: MailRewards): Gift[] {
  const out: Gift[] = []
  if (r.feathers) out.push({ key: 'f', label: 'Lông chim', n: r.feathers, img: FEATHER_IMG })
  if (r.stones) out.push({ key: 's', label: 'Đá vũ trụ', n: r.stones, img: STONE_IMG })
  if (r.vong_tinh) out.push({ key: 'v', label: 'Vọng Tinh', n: r.vong_tinh, img: ROLL_IMG.vong_tinh })
  if (r.sao_duyen) out.push({ key: 'd', label: 'Sao Duyên', n: r.sao_duyen, img: ROLL_IMG.sao_duyen })
  for (const [k, n] of Object.entries(r.seeds ?? {})) { const c = cropById.get(k); if (c && n > 0) out.push({ key: `seed_${k}`, label: `Hạt ${c.name.toLowerCase()}`, n, img: cropImage(k) }) }
  for (const [k, n] of Object.entries(r.insects ?? {})) { const i = insectById.get(k); if (i && n > 0) out.push({ key: `ins_${k}`, label: i.name, n, emoji: i.icon }) }
  const pots = new Map<string, number>()
  for (const k of r.pots ?? []) if (potKindById.has(k)) pots.set(k, (pots.get(k) ?? 0) + 1)
  for (const [k, n] of pots) out.push({ key: `pot_${k}`, label: potKindById.get(k)!.name, n, img: potImage(k, 1) })
  return out
}

export function MailScreen({ list, isOpen, actor, onClose }: { list: Mail[]; isOpen: (m: Mail) => boolean; actor: Actor; onClose: () => void }) {
  const [selId, setSelId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const now = Date.now()
  const mkey = (m: Mail) => `${m.broadcast ? 'b' : 'p'}_${m.id}`
  const sel = list.find((m) => mkey(m) === selId) ?? list[0] ?? null
  const openList = list.filter(isOpen)

  function say(m: string) {
    setMsg(m)
    window.setTimeout(() => setMsg((cur) => (cur === m ? null : cur)), 2600)
  }
  async function claim(mails: Mail[]) {
    if (busy || !mails.length) return
    setBusy(true)
    try {
      const n = await claimMails(actor, mails.map((m) => ({ id: m.id, broadcast: m.broadcast })))
      say(n > 1 ? `Đã nhận quà của ${n} thư` : 'Đã nhận quà')
    } catch (err) {
      say(errorText(err))
    } finally {
      setBusy(false)
    }
  }
  const gifts = sel ? mailGifts(sel.rewards) : []
  const selOpen = sel ? isOpen(sel) : false

  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-gradient-to-br from-[#0d1438]/95 via-[#1b1650]/95 to-[#2d1450]/95 backdrop-blur-xl">
      {/* thanh trên: đóng, tiêu đề, số thư chưa nhận, nhận tất cả */}
      <div className="flex h-14 shrink-0 items-center gap-2 border-b border-white/15" style={{ paddingLeft: 'calc(var(--safe-l) + 12px)', paddingRight: 'calc(var(--safe-r) + 12px)' }}>
        <button type="button" data-round aria-label="Đóng hòm thư" onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-full border border-white/30 bg-white/10">
          <LineIcon icon="cancel" className="h-5 w-5" />
        </button>
        <div className="ml-1 min-w-0">
          <p className="text-lg leading-6 font-light lowercase">hòm thư</p>
          <p className="text-xs leading-4 text-white/65">{openList.length ? `${openList.length} thư chưa nhận quà` : 'Không có thư mới'}</p>
        </div>
        <button type="button" disabled={busy || !openList.length} onClick={() => void claim(openList)} className={`${BTN} ml-auto w-40 from-amber-400/80 to-rose-500/80`}>
          Nhận tất cả{openList.length ? ` (${openList.length})` : ''}
        </button>
      </div>

      {list.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 text-white/70">
          <Icon3D emoji="📬" className="h-12 w-12" />
          <p className="text-sm">Hòm thư đang trống</p>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1" style={{ paddingLeft: 'var(--safe-l)', paddingRight: 'var(--safe-r)' }}>
          {/* trái: danh sách thư */}
          <DragScroll axis="y" className="min-h-0 w-64 shrink-0 border-r border-white/15">
            {list.map((m) => {
              const open = isOpen(m)
              const on = !!sel && mkey(sel) === mkey(m)
              return (
                <button key={mkey(m)} type="button" onClick={() => setSelId(mkey(m))}
                  className={`relative flex h-14 w-full items-center gap-2 border-b border-white/10 px-3 text-left ${on ? 'bg-white/15' : ''} ${open ? '' : 'opacity-55'}`}>
                  <Icon3D emoji="📬" className="h-6 w-6 shrink-0" />
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate text-sm leading-5 ${open ? 'font-bold' : 'font-normal'}`}>{m.title}</span>
                    <span className="block truncate text-[11px] leading-4 text-white/60">{day(m.createdAt)} · {expiryText(m, now)}</span>
                  </span>
                  {open && <span data-round aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full bg-rose-500" />}
                </button>
              )
            })}
          </DragScroll>
          {/* phải: nội dung thư */}
          {sel && (
            <div className="flex min-w-0 flex-1 flex-col">
              <div className="shrink-0 border-b border-white/10 px-4 py-2">
                <p className="truncate text-base leading-6 font-semibold">{sel.title}</p>
                <p className="text-[11px] leading-4 text-white/60">Từ: {sel.from} · {day(sel.createdAt)} · {expiryText(sel, now)}</p>
              </div>
              <DragScroll key={mkey(sel)} axis="y" className="min-h-0 flex-1">
                <p className="px-4 py-2 text-sm leading-5 whitespace-pre-line text-white/85">{sel.body}</p>
                {gifts.length > 0 && (
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(4.5rem,1fr))] gap-2 px-4 pb-3">
                    {gifts.map((x) => (
                      <div key={x.key} className={`flex h-20 flex-col items-center justify-center border border-white/20 bg-white/10 px-1 text-center ${selOpen ? '' : 'opacity-50'}`}>
                        {x.img ? <img src={x.img} alt="" className="h-9 w-9 object-contain" /> : <Icon3D emoji={x.emoji ?? '🎁'} className="h-8 w-8" />}
                        <span className="mt-0.5 text-xs leading-4 font-bold tabular-nums">×{x.n.toLocaleString('vi-VN')}</span>
                        <span className="w-full truncate text-[10px] leading-3 text-white/65">{x.label}</span>
                      </div>
                    ))}
                  </div>
                )}
              </DragScroll>
              <div className="flex h-14 shrink-0 items-center justify-end border-t border-white/10 px-4">
                {selOpen ? (
                  <button type="button" disabled={busy} onClick={() => void claim([sel])} className={`${BTN} w-40 from-amber-400/80 to-rose-500/80`}>
                    {gifts.length ? 'Nhận quà' : 'Đã đọc'}
                  </button>
                ) : (
                  <span className="text-sm text-white/60">{expiryText(sel, now)}</span>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {msg && (
        <div className="pointer-events-none absolute inset-x-0 bottom-16 flex justify-center">
          <p className="max-w-[80%] border border-white/25 bg-black/70 px-4 py-2 text-center text-sm font-semibold backdrop-blur-md">{msg}</p>
        </div>
      )}
    </div>
  )
}
