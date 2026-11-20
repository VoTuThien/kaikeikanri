import { useMemo, useState } from 'react'
import { LineIcon } from '../../../components/ui/Fab'
import type { Actor } from '../../../lib/firestore'
import { errorText, placedIds, upgradePot, type Garden } from '../data/api'
import { insectById } from '../data/gacha'
import { potImage, potKindById, potSetById, type OwnedPot } from '../data/pots'
import {
  charmById,
  FAIL_SPLIT,
  fodderBonus,
  MAX_FODDER,
  MAX_LUCK,
  MAX_POT_LEVEL,
  potRank,
  riskyFodder,
  SAME_KIND_MULT,
  upgradeCost,
  upgradeRate,
  type UpgradeOutcome,
} from '../data/upgrade'
import { DragScroll } from './DragScroll'
import { FEATHER_IMG } from './GachaUi'
import { BTN, RankBadge } from './PotUi'
import { ItemTile, TileFooter } from './ItemTile'
import { ItemImg } from './ItemImg'
import { GLASS_ROUND } from './glass'

// Màn hình ĐẬP CHẬU (nâng cấp chậu có tỉ lệ, xem CLAUDE.md "Nâng cấp chậu có tỉ lệ"): phủ kín khung game.
// Trái = chậu đang nâng; giữa = tỉ lệ thành công (to) + các phần cộng, khả năng thất bại, chi phí, 5 ô chậu bỏ vào, bùa; nút ? = giải thích.

const pct = (v: number) => `${Math.round(v * 1000) / 10}%`.replace('.', ',')
const potName = (p: OwnedPot) => potKindById.get(p.kind)?.name ?? 'Chậu'

const RESULT: Record<UpgradeOutcome, { title: string; tone: string }> = {
  up: { title: 'Thành công!', tone: 'border-amber-200/80 from-amber-300/40 to-orange-600/30 shadow-[0_0_40px_rgba(253,211,77,0.55)]' },
  held: { title: 'Thất bại — bùa giữ cấp đã giữ nguyên cấp', tone: 'border-sky-200/60 from-sky-400/30 to-indigo-700/30' },
  keep: { title: 'Thất bại — chậu giữ nguyên cấp', tone: 'border-white/40 from-slate-400/30 to-slate-700/30' },
  drop: { title: 'Thất bại — chậu bị tuột cấp', tone: 'border-rose-300/60 from-rose-500/30 to-red-800/30' },
  reset: { title: 'Thất bại — chậu trở về cấp 1', tone: 'border-rose-300/70 from-rose-600/35 to-red-900/35' },
}

export function UpgradeScreen({ garden, actor, potId, onClose }: { garden: Garden; actor: Actor; potId: string; onClose: () => void }) {
  const [fodderIds, setFodderIds] = useState<string[]>([])
  const [luck, setLuck] = useState({ B: 0, A: 0, S: 0 })
  const [keep, setKeep] = useState(false)
  const [picking, setPicking] = useState(false)
  const [help, setHelp] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [result, setResult] = useState<{ outcome: UpgradeOutcome; from: number; to: number; rate: number } | null>(null)

  const pot = garden.pots.find((p) => p.id === potId) ?? null
  const placed = useMemo(() => placedIds(garden), [garden])
  // chậu còn tồn tại (vừa đập xong thì danh sách có thể đổi)
  const fodder = fodderIds.map((id) => garden.pots.find((p) => p.id === id)).filter((p): p is OwnedPot => !!p)
  const candidates = useMemo(
    () => (pot ? garden.pots.filter((p) => p.id !== pot.id && !placed.has(p.id) && potKindById.has(p.kind) && !fodderIds.includes(p.id)) : []),
    [garden.pots, pot, placed, fodderIds],
  )

  if (!pot) return null
  const kind = potKindById.get(pot.kind)
  const set = kind ? potSetById.get(kind.set) : undefined
  const maxed = pot.level >= MAX_POT_LEVEL
  const rate = upgradeRate(pot, fodder, luck)
  const cost = upgradeCost(pot)
  const lacking = Object.entries(cost.insects).some(([id, n]) => (garden.insects[id] ?? 0) < n) || garden.feathers < cost.feathers
  const risky = riskyFodder(fodder, garden.pots)
  const luckUsed = luck.B + luck.A + luck.S
  const sorted = [...candidates].sort((a, b) => fodderBonus(b, pot) - fodderBonus(a, pot))

  function say(m: string) {
    setMsg(m)
    window.setTimeout(() => setMsg((cur) => (cur === m ? null : cur)), 2600)
  }
  async function go() {
    if (busy || maxed) return
    if (risky.length && !confirm) { setConfirm(true); return }
    setBusy(true)
    try {
      const r = await upgradePot(actor, pot!.id, fodder.map((f) => f.id), luck, keep)
      setResult(r)
      setFodderIds([]); setLuck({ B: 0, A: 0, S: 0 }); setKeep(false); setConfirm(false)
    } catch (err) {
      say(errorText(err))
    } finally {
      setBusy(false)
    }
  }
  const stepLuck = (k: 'B' | 'A' | 'S', d: number) => {
    setConfirm(false)
    setLuck((l) => {
      const n = l[k] + d
      if (n < 0 || n > garden.charms[k] || (d > 0 && luckUsed >= MAX_LUCK)) return l
      return { ...l, [k]: n }
    })
  }

  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-gradient-to-br from-[#120a33]/95 via-[#22124a]/95 to-[#3a1546]/95 backdrop-blur-xl">
      {/* thanh trên */}
      <div className="flex h-14 shrink-0 items-center gap-2 border-b border-white/15" style={{ paddingLeft: 'calc(var(--safe-l) + 12px)', paddingRight: 'calc(var(--safe-r) + 12px)' }}>
        <button type="button" data-round aria-label="Đóng" onClick={onClose} className={`${GLASS_ROUND} h-10 w-10`}>
          <LineIcon icon="cancel" className="h-5 w-5" />
        </button>
        <div className="ml-1 min-w-0 flex-1">
          <p className="text-lg leading-6 font-light lowercase">đập chậu</p>
          <p className="truncate text-xs leading-4 text-white/65">Áp dụng cho cây từ lần gieo sau · đang có <img src={FEATHER_IMG} alt="" className="inline h-3.5 w-3.5" /> {garden.feathers.toLocaleString('vi-VN')}</p>
        </div>
        <button type="button" data-round aria-label="Cách đập chậu" onClick={() => setHelp(true)} className={`${GLASS_ROUND} h-10 w-10`}>
          <LineIcon icon="help" className="h-6 w-6" />
        </button>
      </div>

      <div className="flex min-h-0 flex-1 gap-3 py-2" style={{ paddingLeft: 'calc(var(--safe-l) + 12px)', paddingRight: 'calc(var(--safe-r) + 12px)' }}>
        {/* trái: chậu đang nâng */}
        <div className="flex w-48 shrink-0 flex-col items-center justify-center border border-white/15 bg-white/5 p-2 text-center">
          <div className="flex items-end gap-1">
            <img src={potImage(pot.kind, pot.level)} alt="" className="h-20 w-20 object-contain" />
            {!maxed && <>
              <span className="mb-8 text-lg text-white/70">→</span>
              <img src={potImage(pot.kind, pot.level + 1)} alt="" className="h-20 w-20 object-contain drop-shadow-[0_0_10px_rgba(255,200,90,0.5)]" />
            </>}
          </div>
          <p className="mt-1 flex items-center gap-1.5 text-sm leading-5 font-semibold">{set && <RankBadge rank={set.rank} />}{kind?.name}</p>
          <p className="text-xs leading-4 text-white/70">Bộ {set?.name}</p>
          <p className="mt-1 text-base leading-6 font-bold text-amber-200">{maxed ? `Cấp ${pot.level} (tối đa)` : `Cấp ${pot.level} → ${pot.level + 1}`}</p>
        </div>

        {/* giữa: tỉ lệ, chi phí, chậu bỏ vào, bùa */}
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex items-center gap-3">
            <p className="text-4xl leading-none font-bold text-amber-200 tabular-nums">{maxed ? '—' : pct(rate.total)}</p>
            <div className="min-w-0 text-[11px] leading-4 text-white/75">
              <p>Gốc {pct(rate.base)} + chậu {pct(rate.pots)} + bùa {pct(rate.charms)}{rate.base + rate.pots + rate.charms > rate.cap ? ` · tối đa ${pct(rate.cap)}` : ''}</p>
              <p>{keep ? 'Thất bại: giữ nguyên cấp (bùa giữ cấp)' : `Thất bại: ${pct(FAIL_SPLIT.reset)} về cấp 1 · ${pct(FAIL_SPLIT.keep)} giữ nguyên · ${pct(FAIL_SPLIT.drop)} tuột 1–4 cấp`}</p>
            </div>
          </div>
          {/* chi phí mỗi lần thử */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-white/60">Mỗi lần:</span>
            {Object.entries(cost.insects).map(([id, n]) => {
              const have = garden.insects[id] ?? 0
              return (
                <span key={id} className={`flex items-center gap-1 border px-1.5 py-0.5 ${have < n ? 'border-rose-400/70 text-rose-200' : 'border-white/20'}`}>
                  <ItemImg img={insectById.get(id)?.img} emoji={insectById.get(id)?.icon ?? '🐛'} className="h-5 w-5" /> {insectById.get(id)?.name} {have}/{n}
                </span>
              )
            })}
            <span className={`flex items-center gap-1 border px-1.5 py-0.5 ${garden.feathers < cost.feathers ? 'border-rose-400/70 text-rose-200' : 'border-white/20'}`}>
              <img src={FEATHER_IMG} alt="" className="h-4 w-4" /> {cost.feathers}
            </span>
          </div>
          {/* 5 ô chậu bỏ vào */}
          <div className="grid grid-cols-5 gap-1.5">
            {Array.from({ length: MAX_FODDER }, (_, i) => {
              const f = fodder[i]
              return f ? (
                <button key={i} type="button" onClick={() => { setFodderIds(fodderIds.filter((id) => id !== f.id)); setConfirm(false) }}
                  className="relative flex h-14 flex-col items-center justify-center border border-amber-200/50 bg-white/10" aria-label={`Bỏ ${potName(f)} ra`}>
                  <img src={potImage(f.kind, f.level)} alt="" className="h-8 w-8 object-contain" />
                  <span className="text-[10px] leading-3 font-semibold text-amber-200">+{pct(fodderBonus(f, pot))}</span>
                  <RankBadge rank={potRank(f.kind)} className="absolute top-0.5 left-0.5" />
                  <span className="absolute top-0 right-1 text-[10px] text-white/70">Lv{f.level}</span>
                </button>
              ) : (
                <button key={i} type="button" disabled={maxed || !candidates.length} onClick={() => setPicking(true)}
                  className="flex h-14 items-center justify-center border border-dashed border-white/30 bg-white/5 text-2xl text-white/50 disabled:opacity-40" aria-label="Thêm chậu bỏ vào">
                  +
                </button>
              )
            })}
          </div>
          {/* bùa */}
          <div className="grid grid-cols-4 gap-1.5">
            {(['B', 'A', 'S'] as const).map((k) => (
              <div key={k} className="flex h-10 items-center justify-between border border-white/15 bg-white/5 px-1 text-xs">
                <button type="button" aria-label={`Bớt bùa ${k}`} disabled={luck[k] <= 0} onClick={() => stepLuck(k, -1)} className="h-8 w-6 text-base disabled:opacity-30">−</button>
                <span className="flex flex-col items-center leading-3">
                  <span className="flex items-center gap-0.5 font-semibold"><ItemImg img={charmById.get(k)!.img} emoji="🍀" className="h-5 w-5" />{k} ×{luck[k]}</span>
                  <span className="text-[10px] text-white/55">có {garden.charms[k]}</span>
                </span>
                <button type="button" aria-label={`Thêm bùa ${k}`} disabled={luck[k] >= garden.charms[k] || luckUsed >= MAX_LUCK} onClick={() => stepLuck(k, 1)} className="h-8 w-6 text-base disabled:opacity-30">+</button>
              </div>
            ))}
            <button type="button" disabled={!keep && garden.charms.keep < 1} onClick={() => { setKeep(!keep); setConfirm(false) }}
              className={`flex h-10 flex-col items-center justify-center border text-[11px] leading-3 disabled:opacity-35 ${keep ? 'border-sky-200/80 bg-sky-400/30' : 'border-white/15 bg-white/5'}`}>
              <span className="flex items-center gap-1 font-semibold"><ItemImg img={charmById.get('keep')!.img} emoji="🔒" className="h-5 w-5" />Giữ cấp {keep ? '✓' : ''}</span>
              <span className="text-[10px] text-white/55">có {garden.charms.keep}</span>
            </button>
          </div>
          {/* nút + cảnh báo */}
          <div className="mt-auto flex items-center gap-2">
            <p className="min-w-0 flex-1 text-[11px] leading-4 text-rose-200">
              {confirm && risky.length > 0 && `Sẽ mất: ${risky.map((r) => `${potName(r.pot)} (${r.why})`).join(', ')}. Bấm lần nữa để đập.`}
              {!confirm && lacking && !maxed && <span className="text-white/60">Chưa đủ côn trùng / lông chim.</span>}
            </p>
            <button type="button" disabled={busy || maxed || lacking} onClick={() => void go()}
              className={`${BTN} h-11 w-44 ${confirm ? 'from-rose-500/80 to-red-700/80' : 'from-amber-400/80 to-fuchsia-600/80'}`}>
              {busy ? '…' : confirm ? 'Đập luôn' : 'Đập'}
            </button>
          </div>
        </div>
      </div>

      {/* chọn chậu bỏ vào: dải cuộn ngang ở đáy */}
      {picking && (
        <div className="absolute inset-0 z-10 flex flex-col justify-end bg-black/45" onClick={() => setPicking(false)}>
          <div className="border-t border-white/20 bg-indigo-950/90 pt-2 pb-3" onClick={(e) => e.stopPropagation()}>
            <p className="px-4 pb-1 text-xs text-white/70">Chọn chậu trong kho để bỏ vào (sẽ MẤT dù thành công hay thất bại; cùng loại ×{String(SAME_KIND_MULT).replace('.', ',')})</p>
            <DragScroll axis="x" className="h-[124px]">
              <div className="flex h-full items-start gap-2 px-4">
                {sorted.map((p) => (
                  <ItemTile key={p.id} className="w-[88px] shrink-0" img={potImage(p.kind, p.level)} emoji="🪴" name={potName(p)} rank={potRank(p.kind)} tr={`Lv${p.level}`}
                    disabled={fodder.length >= MAX_FODDER} onClick={() => { setFodderIds([...fodderIds, p.id]); setConfirm(false); if (fodder.length + 1 >= MAX_FODDER) setPicking(false) }}
                    footer={<TileFooter className="h-6 text-xs text-amber-200">+{pct(fodderBonus(p, pot))}</TileFooter>} />
                ))}
                {!sorted.length && <p className="self-center text-sm text-white/60">Kho không còn chậu nào để bỏ vào.</p>}
              </div>
            </DragScroll>
          </div>
        </div>
      )}

      {/* kết quả */}
      {result && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/55" onClick={() => setResult(null)}>
          <div className={`w-80 border bg-gradient-to-b p-5 text-center ${RESULT[result.outcome].tone}`}>
            <img src={potImage(pot.kind, result.to)} alt="" className="mx-auto h-24 w-24 object-contain" />
            <p className="mt-2 text-lg leading-6 font-bold">{RESULT[result.outcome].title}</p>
            <p className="text-sm text-white/80">Cấp {result.from} → {result.to} · tỉ lệ {pct(result.rate)}</p>
            <button type="button" onClick={() => setResult(null)} className={`${BTN} mx-auto mt-4 w-32`}>OK</button>
          </div>
        </div>
      )}

      {help && <UpgradeHelp onClose={() => setHelp(false)} />}

      {msg && (
        <div className="pointer-events-none absolute inset-x-0 bottom-3 z-30 flex justify-center">
          <p className="max-w-[80%] border border-white/25 bg-black/70 px-4 py-2 text-center text-sm font-semibold backdrop-blur-md">{msg}</p>
        </div>
      )}
    </div>
  )
}

// Bảng giải thích cách đập chậu (nút ?)
const HELP: { h: string; t: string[] }[] = [
  { h: 'Tỉ lệ thành công gốc', t: ['Chậu B: 1→2 90% · 2→3 75% · 3→4 60% · 4→5 45% · 5→6 30%', 'Chậu A: 80% · 65% · 50% · 35% · 20%', 'Chậu S: 70% · 55% · 40% · 25% · 12%'] },
  { h: 'Chi phí mỗi lần thử (mất cả khi thất bại)', t: ['Mỗi bộ chậu cần 2 loại côn trùng riêng: 2 / 3 / 4 / 5 / 6 con mỗi loại theo cấp hiện tại 1 → 5.', 'Lông chim: 30 / 60 / 120 / 200 / 300. Chậu A tốn ×1,5, chậu S ×2.'] },
  { h: 'Khi thất bại', t: ['10% chậu về cấp 1 · 70% giữ nguyên cấp · 20% tuột ngẫu nhiên 1–4 cấp (không dưới cấp 1).', 'Có bùa giữ cấp: thất bại luôn giữ nguyên cấp.'] },
  { h: 'Bỏ thêm chậu (tối đa 5, lấy từ kho)', t: ['Chậu bỏ vào bị MẤT dù thành công hay thất bại. Cộng thêm mỗi chậu theo hạng + cấp của chậu bỏ vào:', 'Hạng B: +2 / 3 / 4 / 6 / 8 / 10% (lv1 → lv6)', 'Hạng A: +4 / 6 / 8 / 12 / 16 / 20%', 'Hạng S: +8 / 12 / 16 / 24 / 32 / 40%', 'Cùng loại với chậu đang đập: ×1,5. Chậu S, cấp ≥ 3 hoặc bản cuối cùng của loại phải bấm 2 lần.'] },
  { h: 'Bùa', t: ['Bùa may mắn B +5%, A +12%, S +25% (tối đa 3 bùa / lần, trộn hạng được). Bùa giữ cấp: 1 ô riêng.', 'Bùa B mua ở Cửa hàng; bùa A, S, giữ cấp nhận từ thư / gacha.'] },
  { h: 'Tỉ lệ tối đa', t: ['Chậu B và A tối đa 100%; chậu S tối đa 95% (luôn còn rủi ro).'] },
  { h: 'Hiệu ứng', t: ['Hiệu ứng tính cho cả bộ trên tầng, theo cấp trung bình các chậu khác nhau của bộ. Cấp mới áp dụng cho cây từ lần gieo sau.'] },
]
function UpgradeHelp({ onClose }: { onClose: () => void }) {
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="flex max-h-[88%] w-[34rem] max-w-[92%] flex-col border border-white/25 bg-indigo-950/90 shadow-2xl backdrop-blur-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex h-11 shrink-0 items-center justify-between border-b border-white/15 px-4">
          <p className="font-semibold">Cách đập chậu</p>
          <button type="button" className="text-sm text-white/75" onClick={onClose}>Đóng</button>
        </div>
        <DragScroll axis="y" className="min-h-0 flex-1">
          <div className="space-y-2 px-4 py-3 text-xs leading-[18px]">
            {HELP.map((s) => (
              <div key={s.h}>
                <p className="font-semibold text-amber-200">{s.h}</p>
                {s.t.map((x) => <p key={x} className="text-white/85">{x}</p>)}
              </div>
            ))}
          </div>
        </DragScroll>
      </div>
    </div>
  )
}
