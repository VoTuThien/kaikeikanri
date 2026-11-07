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

// Xem ghi chú (bước 1), 2 tab (lưu trên URL `?tab=sent` để quay lại từ bước 2 vẫn đúng tab):
// - "Gửi cho mình": các ghi chú gửi đến mình, theo số thứ tự (ưu tiên). Kéo ≡ / sửa số để đổi thứ tự, trượt sang TRÁI để xoá.
//   Chạm 1 ghi chú để mở các thẻ nội dung (đánh dấu xong, nạp / rút quỹ) ở /note/inbox/:id.
// - "Mình đã gửi": các ghi chú mình gửi cho thành viên khác, mới nhất trước, CHỈ XEM (trạng thái đã xong, nạp / rút quỹ).

type Tab = 'inbox' | 'sent'
const TABS: { value: Tab; label: string }[] = [
  { value: 'inbox', label: 'Gửi cho mình' },
  { value: 'sent', label: 'Mình đã gửi' },
]

export function NoteInboxPage() {
  const { loading, inbox, sent, actor } = useNote()
  const [params, setParams] = useSearchParams()
  const [error, setError] = useState('')
  const tab: Tab = params.get('tab') === 'sent' ? 'sent' : 'inbox'
  if (loading) return <NoteInboxPageSkeleton sent={tab === 'sent'} />
  const notes = tab === 'sent' ? sent : inbox

  return (
    <PageShell>
      {/* Dòng phụ dưới tiêu đề: số ghi chú đã hoàn thành / tổng số ghi chú của tab đang chọn */}
      <AppHeader title="Xem ghi chú" subtitle={doneSummary(notes)} backTo="/note" />
      <Segmented
        options={TABS}
        value={tab}
        onChange={(t) => {
          setError('')
          setParams(t === 'sent' ? { tab: 'sent' } : {}, { replace: true })
        }}
      />
      {error && <Alert type="error">{error}</Alert>}
      {notes.length === 0 ? (
        <GlassPanel className="space-y-3 text-center">
          <div className="flex h-12 justify-center">
            <Icon3D emoji={tab === 'sent' ? '📤' : '📬'} className="h-12 w-12" />
          </div>
          <p className="text-sm leading-5 text-white/70">
            {tab === 'sent'
              ? 'Bạn chưa gửi ghi chú nào cho thành viên khác.'
              : 'Chưa có ghi chú nào gửi đến bạn. Bấm nút dấu cộng để tạo ghi chú.'}
          </p>
        </GlassPanel>
      ) : (
        <ScrollArea className={LIST_CLASS}>
          {tab === 'sent' ? (
            <SentNoteList notes={sent} linkTo={(n) => `/note/inbox/${n.id}?tab=sent`} />
          ) : (
            <NoteList notes={inbox} me={actor.uid} linkTo={(n) => `/note/inbox/${n.id}`} onError={setError} />
          )}
        </ScrollArea>
      )}
      <FabGroup>
        <FabLink to={`/note/sent/new?to=${actor.uid}`} icon="add" label="Tạo ghi chú" />
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
