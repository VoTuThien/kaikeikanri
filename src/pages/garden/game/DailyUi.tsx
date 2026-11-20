import { useState } from 'react'
import { LineIcon } from '../../../components/ui/Fab'
import { Icon3D } from '../../../components/ui/Icon3D'
import type { Actor } from '../../../lib/firestore'
import { claimDaily, errorText, type Garden } from '../data/api'
import { DAILY_BONUS, DAILY_REWARD, dailyView, type QuestView } from '../data/daily'
import { useNow } from '../data/GardenContext'
import { formatLeft } from '../data/crops'
import { DragScroll } from './DragScroll'
import { FEATHER_IMG, ROLL_IMG, STONE_IMG } from './GachaUi'
import { BTN } from './PotUi'

// Popup NHIỆM VỤ HẰNG NGÀY (riêng, không gộp với Thành tựu; xem CLAUDE.md "Nhiệm vụ hằng ngày"):
// 5 nhiệm vụ của hôm nay (thanh tiến độ, thưởng, [Nhận]) + dòng thưởng xong cả 5 (2 Sao Duyên). Làm mới lúc 0 giờ.

function Chip({ img, emoji, n, label }: { img?: string; emoji?: string; n: number; label: string }) {
  return (
    <span className="flex items-center gap-0.5 text-[11px] leading-4 font-semibold tabular-nums" aria-label={`${n} ${label}`}>
      {img ? <img src={img} alt="" className="h-4 w-4 object-contain" /> : <Icon3D emoji={emoji ?? '⭐'} className="h-3.5 w-3.5" />}
      {n.toLocaleString('vi-VN')}
    </span>
  )
}

function Row({ r, busy, onClaim }: { r: QuestView; busy: boolean; onClaim: () => void }) {
  const rw = DAILY_REWARD[r.q.tier - 1]
  const pct = Math.min(100, (r.have / r.q.goal) * 100)
  return (
    <div className={`flex h-16 items-center gap-3 border-b border-white/10 px-3 ${r.done && !r.claimed ? 'bg-amber-300/10' : ''} ${r.claimed ? 'opacity-55' : ''}`}>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center border border-white/25 bg-gradient-to-br from-emerald-500/50 to-teal-700/60 shadow shadow-black/40">
        <Icon3D emoji={r.q.icon} className="h-6 w-6" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm leading-5 font-semibold">{r.q.name}</p>
        <div className="mt-1 flex items-center gap-2">
          <span className="h-1.5 flex-1 bg-white/15">
            <span className={`block h-full bg-gradient-to-r ${r.done ? 'from-amber-300 to-orange-500' : 'from-lime-300 to-emerald-500'}`} style={{ width: `${pct}%` }} />
          </span>
          <span className="w-16 shrink-0 text-right text-[10px] leading-3 text-white/70 tabular-nums">{Math.min(r.have, r.q.goal)}/{r.q.goal}</span>
        </div>
      </div>
      <div className="grid w-32 shrink-0 grid-cols-2 gap-x-1.5 gap-y-0.5">
        <Chip img={FEATHER_IMG} n={rw.feathers} label="lông chim" />
        <Chip img={STONE_IMG} n={rw.stones} label="đá vũ trụ" />
        <Chip emoji="⭐" n={rw.xp} label="kinh nghiệm" />
      </div>
      <div className="w-20 shrink-0">
        {r.claimed ? (
          <span className="flex h-9 items-center justify-center gap-1 text-xs text-white/70"><LineIcon icon="save" className="h-4 w-4" /> Đã nhận</span>
        ) : (
          <button type="button" disabled={!r.done || busy} onClick={onClaim} className={`${BTN} h-9 w-full text-xs ${r.done ? 'from-amber-400/80 to-rose-500/80' : 'from-slate-500/40 to-slate-700/50'}`}>
            Nhận
          </button>
        )}
      </div>
    </div>
  )
}

export function DailyScreen({ garden, actor, onClose }: { garden: Garden; actor: Actor; onClose: () => void }) {
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const now = useNow(30_000)
  const v = dailyView(actor.uid, garden)
  const midnight = new Date(now); midnight.setHours(24, 0, 0, 0)
  const doneCount = v.rows.filter((r) => r.done).length

  function say(m: string) {
    setMsg(m)
    window.setTimeout(() => setMsg((cur) => (cur === m ? null : cur)), 2600)
  }
  async function claim(id: string | null) {
    if (busy) return
    setBusy(true)
    try {
      const r = await claimDaily(actor, id)
      const parts = [r.feathers && `+${r.feathers} lông chim`, r.stones && `+${r.stones} đá`, r.xp && `+${r.xp} kinh nghiệm`, r.sao_duyen && `+${r.sao_duyen} Sao Duyên`].filter(Boolean)
      say(`${parts.join(', ')}${r.after > r.before ? ` · lên cấp ${r.after}!` : ''}`)
    } catch (err) {
      say(errorText(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-gradient-to-br from-[#0b1a33]/95 via-[#14284a]/95 to-[#1d1748]/95 backdrop-blur-xl">
      <div className="flex h-14 shrink-0 items-center gap-2 border-b border-white/15" style={{ paddingLeft: 'calc(var(--safe-l) + 12px)', paddingRight: 'calc(var(--safe-r) + 12px)' }}>
        <button type="button" data-round aria-label="Đóng nhiệm vụ" onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-full border border-white/30 bg-white/10">
          <LineIcon icon="cancel" className="h-5 w-5" />
        </button>
        <div className="ml-1 min-w-0">
          <p className="text-lg leading-6 font-light lowercase">nhiệm vụ hằng ngày</p>
          <p className="truncate text-xs leading-4 text-white/65">Bậc {v.tier} · xong {doneCount}/{v.rows.length} · làm mới sau {formatLeft(midnight.getTime() - now)}</p>
        </div>
        <button type="button" disabled={busy || v.ready === 0} onClick={() => void claim(null)} className={`${BTN} ml-auto w-40 from-amber-400/80 to-rose-500/80`}>
          Nhận tất cả{v.ready ? ` (${v.ready})` : ''}
        </button>
      </div>

      <DragScroll axis="y" className="min-h-0 flex-1" >
        <div style={{ paddingLeft: 'var(--safe-l)', paddingRight: 'var(--safe-r)' }}>
          {v.rows.map((r) => <Row key={r.q.id} r={r} busy={busy} onClaim={() => void claim(r.q.id)} />)}
          {/* thưởng xong cả 5 */}
          <div className={`flex h-16 items-center gap-3 px-3 ${v.allClaimed && !v.bonusClaimed ? 'bg-amber-300/10' : ''} ${v.bonusClaimed ? 'opacity-55' : ''}`}>
            <span className="flex h-10 w-10 shrink-0 items-center justify-center border border-amber-200/50 bg-gradient-to-br from-amber-400/50 to-fuchsia-600/60">
              <Icon3D emoji="🎁" className="h-6 w-6" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm leading-5 font-semibold">Hoàn thành cả {v.rows.length} nhiệm vụ</p>
              <p className="truncate text-[11px] leading-4 text-white/65">Nhận thưởng đủ {v.rows.length} nhiệm vụ hôm nay để mở quà</p>
            </div>
            <span className="flex w-32 shrink-0 items-center gap-1 text-xs font-semibold"><img src={ROLL_IMG.sao_duyen} alt="" className="h-5 w-5 object-contain" />{DAILY_BONUS.sao_duyen} Sao Duyên</span>
            <div className="w-20 shrink-0">
              {v.bonusClaimed ? (
                <span className="flex h-9 items-center justify-center gap-1 text-xs text-white/70"><LineIcon icon="save" className="h-4 w-4" /> Đã nhận</span>
              ) : (
                <button type="button" disabled={!v.allClaimed || busy} onClick={() => void claim('bonus')} className={`${BTN} h-9 w-full text-xs ${v.allClaimed ? 'from-amber-400/80 to-rose-500/80' : 'from-slate-500/40 to-slate-700/50'}`}>
                  Nhận
                </button>
              )}
            </div>
          </div>
          <p className="px-4 pt-1 pb-4 text-[11px] leading-4 text-white/55">Nhiệm vụ đổi mỗi ngày lúc 0 giờ; nhiệm vụ chưa nhận thưởng sẽ mất. Bậc nhiệm vụ = số tầng mây đã mở (mở thêm tầng thì từ hôm sau nhiệm vụ khó hơn, thưởng nhiều hơn).</p>
        </div>
      </DragScroll>

      {msg && (
        <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center">
          <p className="max-w-[80%] border border-white/25 bg-black/70 px-4 py-2 text-center text-sm font-semibold backdrop-blur-md">{msg}</p>
        </div>
      )}
    </div>
  )
}
