// Chép các file của Tesseract.js (đọc chữ trên ảnh hoá đơn, chạy NGAY TRÊN MÁY) vào public/tesseract/ để app tự phục vụ,
// không tải từ CDN bên ngoài. Chạy tự động trước `npm run dev` / `npm run build` (predev / prebuild).
//   worker.min.js                     web worker của Tesseract.js
//   tesseract-core-*-lstm.wasm.js     lõi WebAssembly (chỉ bản LSTM; máy không có SIMD như iOS 15 dùng bản thường)
//   vie.traineddata.gz                dữ liệu nhận dạng tiếng Việt (bản best_int, ~1.4MB)
import { copyFileSync, existsSync, mkdirSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const out = join(root, 'public', 'tesseract')
const nm = join(root, 'node_modules')

const files = [
  ['tesseract.js/dist/worker.min.js', 'worker.min.js'],
  ['tesseract.js-core/tesseract-core-lstm.wasm.js', 'tesseract-core-lstm.wasm.js'],
  ['tesseract.js-core/tesseract-core-simd-lstm.wasm.js', 'tesseract-core-simd-lstm.wasm.js'],
  ['tesseract.js-core/tesseract-core-relaxedsimd-lstm.wasm.js', 'tesseract-core-relaxedsimd-lstm.wasm.js'],
  ['@tesseract.js-data/vie/4.0.0_best_int/vie.traineddata.gz', 'vie.traineddata.gz'],
]

mkdirSync(out, { recursive: true })
for (const [from, to] of files) {
  const src = join(nm, from)
  const dst = join(out, to)
  if (!existsSync(src)) throw new Error(`Thiếu ${from} — chạy "npm install" trước`)
  if (existsSync(dst) && statSync(dst).size === statSync(src).size) continue
  copyFileSync(src, dst)
  console.log(`tesseract: ${to}`)
}
