// Tải ảnh icon 3D (Microsoft Fluent Emoji 3D, giấy phép MIT) về public/icons3d/
// Chạy: npm run icons3d
// Khi dùng emoji mới trong app: thêm emoji vào danh sách EMOJIS bên dưới rồi chạy lại lệnh trên.
import { mkdir, writeFile, access } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const EMOJIS = [
  // Chung
  '🏠', '⚙️', '🔍', '📍', '🗺️', '👥',
  // (Nút nổi FAB dùng icon nét trắng trong src/components/ui/Fab.tsx, không dùng ảnh 3D)
  // App Quỹ
  '💰', '🗂️', '➕', '➖', '💵', '💸', '📈',
  '👶', '✈️', '🎓', '🚗', '🏥', '🎁', '🛒', '💍', '🐷',
  // App Trạng thái: các loại địa điểm
  '🏪', '🏢', '🚋', '🚏',
  // App Chăm con: icon thẻ hoạt động (ăn, ngủ, chơi, đi vệ sinh...) và các ô chức năng
  '🍼', '🥣', '😴', '🧸', '🚽', '🛁', '💊', '🌳', '📚', '🎵', '🩺', '🧷', '🏷️', '🕒', '📊',
]

const SOURCE = 'https://cdn.jsdelivr.net/npm/@lobehub/fluent-emoji-3d@1.1.0/assets/'
const OUT_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons3d')

const codeOf = (s) => [...s].map((c) => c.codePointAt(0).toString(16)).join('-')

// Tên file trong project: mã Unicode, bỏ ký tự ẩn FE0F (phải khớp với src/components/ui/Icon3D.tsx)
const localName = (emoji) => `${codeOf(emoji.replace(/️/g, ''))}.webp`

// Tên file ở nguồn: có emoji cần "-fe0f", có emoji thì không -> thử lần lượt
function sourceCandidates(emoji) {
  const bare = codeOf(emoji.replace(/️/g, ''))
  return [...new Set([codeOf(emoji), bare, `${bare}-fe0f`])].map((c) => `${SOURCE}${c}.webp`)
}

await mkdir(OUT_DIR, { recursive: true })
let ok = 0
const failed = []
for (const emoji of [...new Set(EMOJIS)]) {
  const file = path.join(OUT_DIR, localName(emoji))
  try {
    await access(file)
    ok++
    continue // đã có thì bỏ qua
  } catch {
    // chưa có -> tải
  }
  let saved = false
  for (const url of sourceCandidates(emoji)) {
    const res = await fetch(url)
    if (res.ok) {
      await writeFile(file, Buffer.from(await res.arrayBuffer()))
      saved = true
      break
    }
  }
  if (saved) ok++
  else failed.push(emoji)
}
console.log(`Đã có ${ok} icon trong public/icons3d`)
if (failed.length) {
  console.log(`Không tìm thấy bản 3D cho: ${failed.join(' ')}`)
  process.exitCode = 1
}
