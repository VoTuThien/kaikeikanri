import { useMemo, useState } from 'react'
import { LineIcon } from '../../../components/ui/Fab'
import { Icon3D } from '../../../components/ui/Icon3D'
import { ItemImg } from './ItemImg'
import type { Actor } from '../../../lib/firestore'
import { claimAchievement, claimAllAchievements, errorText, type Garden } from '../data/api'
import { ACHIEVEMENTS, achState, GROUPS, ROMAN, type AchState, type GroupId, type Reward } from '../data/achievements'
import { DragScroll } from './DragScroll'
import { FEATHER_IMG, ROLL_IMG, STONE_IMG } from './GachaUi'
import { BTN } from './PotUi'
import { GLASS_ROUND } from './glass'

// Popup Thành tựu (xem CLAUDE.md "Thành tựu"): phủ kín khung game như màn hình gacha.
// Cột trái = các nhóm (chấm đỏ + số bậc chờ nhận), bên phải = danh sách cuộn dọc; thành tựu nhiều bậc gộp 1 dòng.
// Thứ tự: có thể nhận → đang làm → đã xong. Nhận từng bậc ([Nhận]) hoặc [Nhận tất cả] của nhóm đang xem.

const REWARD_IMG: { key: keyof Reward; img: string; label: string }[] = [
  { key: 'feathers', img: FEATHER_IMG, label: 'lông chim' },
  { key: 'stones', img: STONE_IMG, label: 'đá vũ trụ' },
  { key: 'vong_tinh', img: ROLL_IMG.vong_tinh, label: 'Vọng Tinh' },
  { key: 'sao_duyen', img: ROLL_IMG.sao_duyen, label: 'Vọng Nguyệt' },
]
export const rewardText = (r: Reward) =>
  REWARD_IMG.filter((x) => (r[x.key] ?? 0) > 0).map((x) => `+${(r[x.key] ?? 0).toLocaleString('vi-VN')} ${x.label}`).join(', ')

function Rewards({ r, dim }: { r: Reward; dim: boolean }) {
  return (
    <div className={`grid w-36 shrink-0 grid-cols-2 gap-x-1.5 gap-y-0.5 ${dim ? 'opacity-40' : ''}`}>
      {REWARD_IMG.filter((x) => (r[x.key] ?? 0) > 0).map((x) => (
        <span key={x.key} className="flex items-center gap-0.5 text-[11px] leading-4 font-semibold tabular-nums" aria-label={`${r[x.key]} ${x.label}`}>
          <img src={x.img} alt="" className="h-4 w-4 shrink-0 object-contain" />
          {(r[x.key] ?? 0).toLocaleString('vi-VN')}
        </span>
      ))}
    </div>
  )
}

const order = (s: AchState) => (s.ready ? 0 : s.done ? 2 : 1)

function Row({ s, busy, onClaim }: { s: AchState; busy: boolean; onClaim: () => void }) {
  const t = Math.min(s.tier, s.a.goals.length - 1)
  const many = s.a.roman && s.a.goals.length > 1
  const pct = s.done ? 100 : Math.min(100, (s.have / s.goal) * 100)
  return (
    <div className={`flex h-16 items-center gap-3 border-b border-white/10 px-3 ${s.ready ? 'bg-amber-300/10' : ''} ${s.done ? 'opacity-55' : ''}`}>
      {s.a.img ? <ItemImg img={s.a.img} emoji={s.a.icon} className="h-10 w-10" /> : (
        <span className="flex h-10 w-10 shrink-0 items-center justify-center border border-white/25 bg-gradient-to-br from-violet-500/50 to-indigo-700/60 shadow shadow-black/40">
          <Icon3D emoji={s.a.icon} className="h-6 w-6" />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm leading-5 font-semibold">
          {s.a.name(t)}
          {many && <span className="ml-1 text-amber-200">{ROMAN[t] ?? t + 1}</span>}
        </p>
        <p className="truncate text-[11px] leading-4 text-white/65">{s.a.desc(s.goal)}</p>
        <div className="mt-0.5 flex items-center gap-2">
          <span className="h-1.5 flex-1 bg-white/15">
            <span className={`block h-full bg-gradient-to-r ${s.ready || s.done ? 'from-amber-300 to-orange-500' : 'from-sky-300 to-indigo-500'}`} style={{ width: `${pct}%` }} />
          </span>
          <span className="w-24 shrink-0 text-right text-[10px] leading-3 text-white/70 tabular-nums">
            {s.done ? 'Hoàn thành' : `${Math.min(s.have, s.goal).toLocaleString('vi-VN')}/${s.goal.toLocaleString('vi-VN')}`}
          </span>
        </div>
      </div>
      <Rewards r={s.a.reward(t)} dim={s.done} />
      <div className="w-20 shrink-0">
        {s.done ? (
          <span className="flex h-9 items-center justify-center gap-1 text-xs text-white/70">
            <LineIcon icon="save" className="h-4 w-4" /> Xong
          </span>
        ) : (
          <button type="button" disabled={!s.ready || busy} onClick={onClaim} className={`${BTN} h-9 w-full text-xs ${s.ready ? 'from-amber-400/80 to-rose-500/80' : 'from-slate-500/40 to-slate-700/50'}`}>
            Nhận{s.readyCount > 1 ? ` (${s.readyCount})` : ''}
          </button>
        )}
      </div>
    </div>
  )
}

export function AchievementsScreen({ garden, actor, onClose }: { garden: Garden; actor: Actor; onClose: () => void }) {
  const [group, setGroup] = useState<GroupId>('thang_tien')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const states = useMemo(
    () => ACHIEVEMENTS.filter((a) => a.goals.length && (!a.show || a.show(garden))).map((a) => achState(a, garden, garden.claimed)),
    [garden],
  )
  const readyIn = (gid: GroupId) => states.filter((s) => s.a.group === gid).reduce((n, s) => n + s.readyCount, 0)
  const rows = states.filter((s) => s.a.group === group).map((s, i) => ({ s, i })).sort((x, y) => order(x.s) - order(y.s) || x.i - y.i).map((x) => x.s)
  const doneCount = states.filter((s) => s.done).length
  const groupReady = readyIn(group)

  function say(m: string) {
    setMsg(m)
    window.setTimeout(() => setMsg((cur) => (cur === m ? null : cur)), 2600)
  }
  async function job(fn: () => Promise<string>) {
    if (busy) return
    setBusy(true)
    try { say(await fn()) } catch (err) { say(errorText(err)) } finally { setBusy(false) }
  }

  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-gradient-to-br from-[#120a33]/95 via-[#24104d]/95 to-[#3b1450]/95 backdrop-blur-xl">
      {/* thanh trên: đóng, tiêu đề, đã xong n/m, nhận tất cả */}
      <div className="flex h-14 shrink-0 items-center gap-2 border-b border-white/15" style={{ paddingLeft: 'calc(var(--safe-l) + 12px)', paddingRight: 'calc(var(--safe-r) + 12px)' }}>
        <button type="button" data-round aria-label="Đóng thành tựu" onClick={onClose} className={`${GLASS_ROUND} h-10 w-10`}>
          <LineIcon icon="cancel" className="h-5 w-5" />
        </button>
        <div className="ml-1 min-w-0">
          <p className="text-lg leading-6 font-light">Thành tựu</p>
          <p className="text-xs leading-4 text-white/65">Đã xong {doneCount}/{states.length}</p>
        </div>
        <button
          type="button"
          disabled={busy || groupReady === 0}
          onClick={() => void job(async () => { const r = await claimAllAchievements(actor, group); return `Đã nhận ${r.n} phần thưởng: ${rewardText(r.sum)}` })}
          className={`${BTN} ml-auto w-40 from-amber-400/80 to-rose-500/80`}
        >
          Nhận tất cả{groupReady ? ` (${groupReady})` : ''}
        </button>
      </div>

      <div className="flex min-h-0 flex-1" style={{ paddingLeft: 'var(--safe-l)', paddingRight: 'var(--safe-r)' }}>
        {/* cột trái: nhóm */}
        <div className="flex w-36 shrink-0 flex-col gap-1 border-r border-white/15 p-2">
          {GROUPS.map((gr) => {
            const n = readyIn(gr.id)
            const on = gr.id === group
            return (
              <button key={gr.id} type="button" onClick={() => setGroup(gr.id)}
                className={`relative flex h-11 items-center gap-2 border px-2 text-left text-sm font-semibold transition ${on ? 'border-amber-200/70 bg-white/15' : 'border-white/10 bg-white/5 text-white/80'}`}>
                <Icon3D emoji={gr.icon} className="h-5 w-5 shrink-0" />
                <span className="min-w-0 flex-1 truncate">{gr.name}</span>
                {n > 0 && <span data-round className="flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] leading-none font-bold">{n}</span>}
              </button>
            )
          })}
        </div>
        {/* bên phải: danh sách */}
        <DragScroll key={group} axis="y" className="min-h-0 flex-1">
          {rows.map((s) => (
            <Row key={s.a.id} s={s} busy={busy} onClaim={() => void job(async () => { const r = await claimAchievement(actor, s.a.id); return `Đã nhận: ${rewardText(r)}` })} />
          ))}
          <div className="h-4" />
        </DragScroll>
      </div>

      {msg && (
        <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center">
          <p className="max-w-[80%] border border-white/25 bg-black/70 px-4 py-2 text-center text-sm font-semibold backdrop-blur-md">{msg}</p>
        </div>
      )}
    </div>
  )
}
