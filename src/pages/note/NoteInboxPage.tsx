import { useState } from 'react'
import { AppHeader, AppHeaderSkeleton } from '../../components/AppHeader'
import { PageShell, ScrollArea } from '../../components/PageShell'
import { Alert } from '../../components/ui/Alert'
import { FabGroup, FabLink, FabSkeleton } from '../../components/ui/Fab'
import { GlassPanel } from '../../components/ui/GlassPanel'
import { Icon3D } from '../../components/ui/Icon3D'
import { LIST_CLASS, ListInfo, ListInfoSkeleton, NoteList, NoteListSkeleton } from './components'
import { useNote } from './data/NoteContext'
import { noteDone } from './data/types'

// Xem ghi chú (bước 1): danh sách các ghi chú gửi đến mình, theo số thứ tự (ưu tiên).
// Chạm 1 ghi chú để mở danh sách thẻ nội dung bên trong (đánh dấu xong, nạp / rút quỹ) ở /note/inbox/:id.
// Kéo ≡ / sửa số để đổi thứ tự, trượt sang TRÁI để xoá (giống các thẻ nội dung).

export function NoteInboxPage() {
  const { loading, inbox, actor } = useNote()
  const [error, setError] = useState('')
  if (loading) return <NoteInboxPageSkeleton />

  return (
    <PageShell>
      <AppHeader title="Xem ghi chú" backTo="/note" />
      {/* Ngay dưới thanh tiêu đề, đứng yên khi cuộn danh sách (giống "Gửi cho: …" ở Tạo ghi chú) */}
      <ListInfo right={`${inbox.filter(noteDone).length} đã hoàn thành`}>
        <span className="font-semibold text-white">{inbox.length} ghi chú</span> gửi đến bạn
      </ListInfo>
      {error && <Alert type="error">{error}</Alert>}
      {inbox.length === 0 ? (
        <GlassPanel className="space-y-3 text-center">
          <div className="flex h-12 justify-center">
            <Icon3D emoji="📬" className="h-12 w-12" />
          </div>
          <p className="text-sm leading-5 text-white/70">Chưa có ghi chú nào gửi đến bạn. Bấm nút dấu cộng để tạo ghi chú.</p>
        </GlassPanel>
      ) : (
        <ScrollArea className={LIST_CLASS}>
          <NoteList notes={inbox} me={actor.uid} linkTo={(n) => `/note/inbox/${n.id}`} onError={setError} />
        </ScrollArea>
      )}
      <FabGroup>
        <FabLink to={`/note/sent/new?to=${actor.uid}`} icon="add" label="Tạo ghi chú" />
      </FabGroup>
    </PageShell>
  )
}

export function NoteInboxPageSkeleton() {
  return (
    <PageShell>
      <AppHeaderSkeleton />
      <ListInfoSkeleton width="w-56" />
      <ScrollArea className={`${LIST_CLASS} !overflow-hidden`}>
        <NoteListSkeleton />
      </ScrollArea>
      <FabSkeleton />
    </PageShell>
  )
}
