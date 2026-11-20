// Chạy SAU khi deploy (cuối `npm run deploy`): ghi mã phiên bản vừa build (dist/version.json) vào Firestore `appMeta/version`.
// App đang mở lắng nghe document này realtime (src/components/UpdatePrompt.tsx) → thấy mã khác bản đang chạy thì tải bản mới và khoá màn hình "Tải lại".
// Cần khoá service account như script gửi thư (scripts/.service-account.json hoặc GOOGLE_APPLICATION_CREDENTIALS);
// thiếu khoá thì chỉ báo và bỏ qua (deploy vẫn xong, app vẫn tự kiểm tra bản mới khi mở / quay lại app).
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { applicationDefault, cert, initializeApp } from 'firebase-admin/app'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'

const here = dirname(fileURLToPath(import.meta.url))
const versionFile = join(here, '..', 'dist', 'version.json')
if (!existsSync(versionFile)) {
  console.warn('[publish-version] Không thấy dist/version.json (chưa build?) → bỏ qua.')
  process.exit(0)
}
const { version } = JSON.parse(readFileSync(versionFile, 'utf8'))

const keyFile = join(here, '.service-account.json')
let credential
if (process.env.GOOGLE_APPLICATION_CREDENTIALS) credential = applicationDefault()
else if (existsSync(keyFile)) credential = cert(JSON.parse(readFileSync(keyFile, 'utf8')))
else {
  console.warn('[publish-version] Không có khoá service account (scripts/.service-account.json) → KHÔNG báo bản mới realtime. App vẫn tự kiểm tra khi mở / quay lại app.')
  process.exit(0)
}
initializeApp({ credential })
try {
  await getFirestore().doc('appMeta/version').set({ version, deployedAt: FieldValue.serverTimestamp() })
  console.log(`[publish-version] Đã báo bản mới ${version} cho mọi máy đang mở app.`)
} catch (err) {
  console.warn('[publish-version] Ghi phiên bản thất bại (deploy vẫn xong):', err?.message ?? err)
}
