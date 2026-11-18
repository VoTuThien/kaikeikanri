import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AppHeader, AppHeaderSkeleton } from '../../components/AppHeader'
import { PageShell, ScrollArea } from '../../components/PageShell'
import { Alert } from '../../components/ui/Alert'
import { FAB_SPACE, Fab, FabGroup, FabSkeleton } from '../../components/ui/Fab'
import { GLASS_CLASS } from '../../components/ui/GlassPanel'
import { Skeleton } from '../../components/ui/Skeleton'
import { LIST_ROW_BG } from '../../components/ui/listStyle'
import { SIZE } from '../../components/ui/sizes'
import { CropBlock } from './components'
import { errorText, sell } from './data/api'
import { CROPS, formatCoins } from './data/crops'
import { useGarden } from './data/GardenContext'

// Kho nông sản: mỗi loại 1 dòng, nút Bán bán hết loại đó; FAB đồng xu bán tất cả.
export function BarnPage() {
  const { loading, garden, actor } = useGarden()
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ type: 'error' | 'success'; text: string } | null>(null)
  if (loading || !garden) return <BarnPageSkeleton />

  const items = CROPS.filter((c) => (garden.barn[c.id] ?? 0) > 0).map((c) => ({ crop: c, count: garden.barn[c.id] }))
  const total = items.reduce((s, i) => s + i.count * i.crop.sellPrice, 0)
  const count = items.reduce((s, i) => s + i.count, 0)

  async function doSell(cropId: string | null) {
    if (busy) return
    setBusy(cropId ?? 'all')
    setMsg(null)
    try {
      const coins = await sell(actor, cropId)
      setMsg({ type: 'success', text: `Đã bán, nhận ${formatCoins(coins)} xu.` })
    } catch (err) {
      console.error(err)
      setMsg({ type: 'error', text: errorText(err) })
    } finally {
      setBusy(null)
    }
  }

  return (
    <PageShell>
      <AppHeader title="Kho nông sản" backTo="/garden" subtitle={`${count} nông sản · bán được ${formatCoins(total)} xu · đang có ${formatCoins(garden.coins)} xu`} />
      {msg && <Alert type={msg.type}>{msg.text}</Alert>}
      <ScrollArea className={`${GLASS_CLASS} !p-0`}>
        {items.length === 0 ? (
          <p className="p-5 text-sm leading-6 text-white/70">
            Kho đang trống.{' '}
            <Link to="/garden/farm" className="font-semibold text-fuchsia-200 underline">
              Ra vườn
            </Link>{' '}
            thu hoạch rồi quay lại bán nhé.
          </p>
        ) : (
          <ul className={`divide-y divide-white/10 ${FAB_SPACE}`}>
            {items.map(({ crop, count: n }) => (
              <li key={crop.id} className={`${SIZE.row} ${LIST_ROW_BG} flex items-center gap-3 px-4`}>
                <CropBlock icon={crop.icon} color={crop.color} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm leading-5 font-semibold">
                    {crop.name} × {n}
                  </span>
                  <span className="block truncate text-xs leading-4 text-white/60">
                    {crop.sellPrice} xu / cái · {formatCoins(n * crop.sellPrice)} xu
                  </span>
                </span>
                <button type="button" disabled={!!busy} onClick={() => doSell(crop.id)}
                  className={`${SIZE.chip} w-20 shrink-0 border border-yellow-200/40 bg-gradient-to-br from-amber-400/70 to-orange-500/70 text-sm font-semibold transition enabled:active:scale-95 disabled:opacity-60`}>
                  {busy === crop.id ? '…' : 'Bán'}
                </button>
              </li>
            ))}
          </ul>
        )}
      </ScrollArea>
      <FabGroup>
        <Fab icon="coin" label="Bán tất cả" disabled={items.length === 0} loading={busy === 'all'} onClick={() => doSell(null)} />
      </FabGroup>
    </PageShell>
  )
}

export function BarnPageSkeleton() {
  return (
    <PageShell>
      <AppHeaderSkeleton subtitle />
      <ScrollArea className={`${GLASS_CLASS} !p-0`}>
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className={`${SIZE.row} flex items-center gap-3 px-4`}>
            <Skeleton className="h-11 w-11" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-3 w-40" />
            </div>
            <Skeleton className={`${SIZE.chip} w-20`} />
          </div>
        ))}
      </ScrollArea>
      <FabSkeleton />
    </PageShell>
  )
}
