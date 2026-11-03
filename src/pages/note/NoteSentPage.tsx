import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AppHeader, AppHeaderSkeleton } from '../../components/AppHeader'
import { PageShell, ScrollArea } from '../../components/PageShell'
import { Alert } from '../../components/ui/Alert'
import { FabGroup, FabLink, FabSkeleton } from '../../components/ui/Fab'
import { GlassPanel } from '../../components/ui/GlassPanel'
import { Icon3D } from '../../components/ui/Icon3D'
import { useFamily } from '../../contexts/FamilyContext'
import type { Member } from '../family/data/api'
import { useMembers } from '../family/data/useMembers'
import { LIST_CLASS, ListInfo, ListInfoSkeleton, MemberPicker, MemberPickerSkeleton, NoteList, NoteListSkeleton, recipientLabel } from './components'
import { useNote, useNotesTo } from './data/NoteContext'
import { noteDone } from './data/types'

// Tạo ghi chú (bước 1): danh sách các ghi chú gửi cho 1 thành viên (chọn bằng avatar trên thanh tiêu đề, mặc định là chính mình).
// Chạm 1 ghi chú để mở / sửa các thẻ nội dung bên trong (/note/sent/:id); nút dấu cộng để tạo ghi chú mới (/note/sent/new).
// Người nhận đang chọn nằm trên URL (?to=uid) để quay lại từ màn hình nội dung vẫn đúng người.

export function NoteSentPage() {
  const { loading } = useNote()
  const members = useMembers(useFamily().current?.familyId)
  if (loading || !members) return <NoteSentPageSkeleton />
  return <Sent members={members} />
}

function Sent({ members }: { members: Member[] }) {
  const { actor } = useNote()
  const [params, setParams] = useSearchParams()
  const [error, setError] = useState('')
  // Người nhận không còn trong gia đình thì về chính mình
  const to = members.find((m) => m.uid === params.get('to')) ?? members.find((m) => m.uid === actor.uid)
  const toUid = to?.uid ?? actor.uid
  const notes = useNotesTo(toUid)

  return (
    <PageShell>
      <AppHeader
        title="Tạo ghi chú"
        backTo="/note"
        right={<MemberPicker members={members} value={toUid} me={actor.uid} onChange={(uid) => setParams({ to: uid }, { replace: true })} />}
      />
      {/* Người nhận + số ghi chú đã tạo / đã hoàn thành: ngay dưới thanh tiêu đề, đứng yên khi cuộn danh sách */}
      <ListInfo right={notes && `${notes.length} ghi chú · ${notes.filter(noteDone).length} đã hoàn thành`}>
        Gửi cho: <span className="font-semibold text-white">{recipientLabel(to, actor.uid)}</span>
      </ListInfo>
      {error && <Alert type="error">{error}</Alert>}
      {notes && notes.length === 0 ? (
        <GlassPanel className="space-y-3 text-center">
          <div className="flex h-12 justify-center">
            <Icon3D emoji="✍️" className="h-12 w-12" />
          </div>
          <p className="text-sm leading-5 text-white/70">
            Chưa có ghi chú nào gửi cho <span className="font-semibold text-white">{recipientLabel(to, actor.uid)}</span>. Bấm nút dấu cộng để tạo
            ghi chú, ví dụ: Đi chợ gồm Mua cà chua, Mua cá. Chạm avatar trên cùng để chọn người nhận khác.
          </p>
        </GlassPanel>
      ) : (
        <ScrollArea className={notes ? LIST_CLASS : `${LIST_CLASS} !overflow-hidden`}>
          {notes ? <NoteList notes={notes} me={actor.uid} linkTo={(n) => `/note/sent/${n.id}`} onError={setError} /> : <NoteListSkeleton />}
        </ScrollArea>
      )}
      <FabGroup>
        <FabLink to={`/note/sent/new?to=${toUid}`} icon="add" label="Tạo ghi chú mới" />
      </FabGroup>
    </PageShell>
  )
}

export function NoteSentPageSkeleton() {
  return (
    <PageShell>
      <AppHeaderSkeleton right={<MemberPickerSkeleton />} />
      <ListInfoSkeleton width="w-56" />
      <ScrollArea className={`${LIST_CLASS} !overflow-hidden`}>
        <NoteListSkeleton />
      </ScrollArea>
      <FabSkeleton />
    </PageShell>
  )
}
