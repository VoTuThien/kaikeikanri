import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AppHeader, AppHeaderSkeleton } from '../../components/AppHeader'
import { PageShell, ScrollArea } from '../../components/PageShell'
import { Alert } from '../../components/ui/Alert'
import { FabGroup, FabLink, FabSkeleton } from '../../components/ui/Fab'
import { GlassPanel } from '../../components/ui/GlassPanel'
import { Icon3D } from '../../components/ui/Icon3D'
import { Segmented, SegmentedSkeleton } from '../../components/ui/Segmented'
import { doneSummary, LIST_CLASS, NoteList, NoteListSkeleton, SentNoteList, SentNoteListSkeleton } from './components'
import { useNote } from './data/NoteContext'
import { ALL_MEMBERS } from '../../lib/notifications'

// Xem ghi chú (bước 1), 3 tab (lưu trên URL `?tab=all|sent` để quay lại từ bước 2 vẫn đúng tab):
// - "Cả nhà": ghi chú CHUNG của cả gia đình — ai cũng xem, sửa, đánh dấu xong, nạp / rút được (thao tác giống "Gửi cho mình").
// - "Gửi cho mình": các ghi chú gửi đến mình, theo số thứ tự (ưu tiên). Kéo ≡ / sửa số để đổi thứ tự, trượt sang TRÁI để xoá.
//   Chạm 1 ghi chú để mở các thẻ nội dung (đánh dấu xong, nạp / rút quỹ) ở /note/inbox/:id.
// - "Mình đã gửi": các ghi chú mình gửi cho thành viên khác, mới nhất trước, CHỈ XEM (trạng thái đã xong, nạp / rút quỹ).

type Tab = 'inbox' | 'all' | 'sent'
const TABS: { value: Tab; label: string }[] = [
  { value: 'inbox', label: 'Gửi cho mình' },
  { value: 'all', label: 'Cả nhà' },
  { value: 'sent', label: 'Mình đã gửi' },
]
const tabOf = (v: string | null): Tab => (v === 'sent' || v === 'all' ? v : 'inbox')

export function NoteInboxPage() {
  const { loading, inbox, sent, shared, actor } = useNote()
  const [params, setParams] = useSearchParams()
  const [error, setError] = useState('')
  const tab = tabOf(params.get('tab'))
  if (loading) return <NoteInboxPageSkeleton sent={tab === 'sent'} />
  const notes = tab === 'sent' ? sent : tab === 'all' ? shared : inbox

  return (
    <PageShell>
      {/* Dòng phụ dưới tiêu đề: số ghi chú đã hoàn thành / tổng số ghi chú của tab đang chọn */}
      <AppHeader title="Xem ghi chú" subtitle={doneSummary(notes)} backTo="/note" />
      <Segmented
        options={TABS}
        value={tab}
        onChange={(t) => {
          setError('')
          setParams(t === 'inbox' ? {} : { tab: t }, { replace: true })
        }}
      />
      {error && <Alert type="error">{error}</Alert>}
      {notes.length === 0 ? (
        <GlassPanel className="space-y-3 text-center">
          <div className="flex h-12 justify-center">
            <Icon3D emoji={tab === 'sent' ? '📤' : tab === 'all' ? '👥' : '📬'} className="h-12 w-12" />
          </div>
          <p className="text-sm leading-5 text-white/70">
            {tab === 'sent'
              ? 'Bạn chưa gửi ghi chú nào cho thành viên khác.'
              : tab === 'all'
                ? 'Chưa có ghi chú chung nào của cả gia đình. Bấm nút dấu cộng để tạo, mọi người cùng xem và đánh dấu xong được.'
                : 'Chưa có ghi chú nào gửi đến bạn. Bấm nút dấu cộng để tạo ghi chú.'}
          </p>
        </GlassPanel>
      ) : (
        <ScrollArea className={LIST_CLASS}>
          {tab === 'sent' ? (
            <SentNoteList notes={sent} linkTo={(n) => `/note/inbox/${n.id}?tab=sent`} />
          ) : (
            <NoteList notes={notes} me={actor.uid} linkTo={(n) => `/note/inbox/${n.id}${tab === 'all' ? '?tab=all' : ''}`} onError={setError} />
          )}
        </ScrollArea>
      )}
      <FabGroup>
        <FabLink to={`/note/sent/new?to=${tab === 'inbox' ? actor.uid : ALL_MEMBERS}`} icon="add" label="Tạo ghi chú" />
      </FabGroup>
    </PageShell>
  )
}

export function NoteInboxPageSkeleton({ sent = false }: { sent?: boolean }) {
  return (
    <PageShell>
      <AppHeaderSkeleton subtitle />
      <SegmentedSkeleton count={TABS.length} />
      <ScrollArea className={`${LIST_CLASS} !overflow-hidden`}>
        {sent ? <SentNoteListSkeleton /> : <NoteListSkeleton />}
      </ScrollArea>
      <FabSkeleton />
    </PageShell>
  )
}
