// Gửi thư (kèm quà) tới người chơi game Vườn mây. Chạy trên máy quản trị bằng Admin SDK (bỏ qua Firestore Rules).
// Xem CLAUDE.md "Hòm thư". Cần khoá service account (Firebase Console > Project settings > Service accounts > Generate new private key):
//   - đặt đường dẫn vào biến GOOGLE_APPLICATION_CREDENTIALS, hoặc
//   - lưu thành scripts/.service-account.json (đã gitignore, TUYỆT ĐỐI KHÔNG commit).
//
// Cách dùng:
//   node scripts/send-mail.mjs --to all --title "Quà cuối tuần" --body "Cảm ơn bạn!" --feathers 500 --vong 10 --expires 7d
//   node scripts/send-mail.mjs --to ten@email.com --title "Đền bù" --stones 160 --seed carot:10 --insect sau:5 --pot su_lam_1
//   node scripts/send-mail.mjs --broadcast --new-players --title "Chào mừng" --vong 5     (1 thư CHUNG, cả người chơi mới sau này)
// Tham số:
//   --to all | <email> | <uid>   gửi thư RIÊNG (mỗi vườn 1 thư); all = mọi vườn đang có
//   --family <familyId>          chỉ các vườn của gia đình này
//   --broadcast                  gửi 1 thư CHUNG (gardenBroadcasts); thêm --new-players để người chơi tạo vườn sau này cũng nhận
//   --title, --body, --from      tiêu đề, nội dung (\n để xuống dòng), người gửi (mặc định "Vườn mây")
//   --feathers N --stones N --vong N --sao N        lông chim, đá vũ trụ, Vọng Tinh, Vọng Nguyệt
//   --seed <id cây>:N  --insect <id>:N  --pot <id loại chậu>[:N]  --charm B|A|S|keep:N (bùa)  --fert B|A:N (phân bón)  --shard sao_sang|sao:N (mảnh vỡ sao)    lặp lại được
//   --expires 7d | 12h | 2026-12-31                 hạn nhận (mặc định không hết hạn)
//   --dry-run                    chỉ in ra, không ghi;  --yes   không hỏi xác nhận
import { existsSync, readFileSync } from 'node:fs'
import { createInterface } from 'node:readline/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { cert, initializeApp, applicationDefault } from 'firebase-admin/app'
import { FieldValue, getFirestore, Timestamp } from 'firebase-admin/firestore'
import { getAuth } from 'firebase-admin/auth'

const here = dirname(fileURLToPath(import.meta.url))

// ---- đọc tham số ----
const args = process.argv.slice(2)
const opt = { seed: [], insect: [], pot: [], charm: [], fert: [], shard: [] }
for (let i = 0; i < args.length; i++) {
  const a = args[i]
  if (!a.startsWith('--')) fail(`Tham số lạ: ${a}`)
  const k = a.slice(2)
  if (['broadcast', 'new-players', 'dry-run', 'yes'].includes(k)) { opt[k] = true; continue }
  const v = args[++i]
  if (v === undefined) fail(`Thiếu giá trị cho --${k}`)
  if (k in opt && Array.isArray(opt[k])) opt[k].push(v)
  else opt[k] = v
}
function fail(msg) { console.error(`Lỗi: ${msg}`); process.exit(1) }
const int = (k) => {
  if (opt[k] === undefined) return 0
  const n = Number(opt[k])
  if (!Number.isInteger(n) || n < 0) fail(`--${k} phải là số nguyên ≥ 0`)
  return n
}
const pairs = (list, name) => {
  const out = {}
  for (const s of list) {
    const [id, q = '1'] = s.split(':')
    const n = Number(q)
    if (!id || !Number.isInteger(n) || n <= 0) fail(`--${name} sai dạng: ${s} (đúng: <id>:<số>)`)
    out[id] = (out[id] ?? 0) + n
  }
  return out
}

if (!opt.title) fail('Cần --title')
if (!opt.broadcast && !opt.to) fail('Cần --to all | <email> | <uid> (hoặc --broadcast)')
if (opt.broadcast && opt.to) fail('Không dùng --to cùng --broadcast')

const rewards = {}
for (const [k, key] of [['feathers', 'feathers'], ['stones', 'stones'], ['vong', 'vong_tinh'], ['sao', 'sao_duyen']]) { const n = int(k); if (n) rewards[key] = n }
const seeds = pairs(opt.seed, 'seed'); if (Object.keys(seeds).length) rewards.seeds = seeds
const insects = pairs(opt.insect, 'insect'); if (Object.keys(insects).length) rewards.insects = insects
const charms = pairs(opt.charm, 'charm')
for (const k of Object.keys(charms)) if (!['B', 'A', 'S', 'keep'].includes(k)) fail(`--charm sai loại: ${k} (B, A, S, keep)`)
if (Object.keys(charms).length) rewards.charms = charms
const ferts = pairs(opt.fert, 'fert')
for (const k of Object.keys(ferts)) if (!['B', 'A'].includes(k)) fail(`--fert sai loại: ${k} (B, A)`)
if (Object.keys(ferts).length) rewards.ferts = ferts
const shards = pairs(opt.shard, 'shard')
for (const k of Object.keys(shards)) if (!['sao_sang', 'sao'].includes(k)) fail(`--shard sai loại: ${k} (sao_sang, sao)`)
if (Object.keys(shards).length) rewards.shards = shards
const pots = Object.entries(pairs(opt.pot, 'pot')).flatMap(([id, n]) => Array(n).fill(id)); if (pots.length) rewards.pots = pots

function parseExpires(s) {
  if (!s) return null
  const m = /^(\d+)([dh])$/.exec(s)
  if (m) return new Date(Date.now() + Number(m[1]) * (m[2] === 'd' ? 86400000 : 3600000))
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) fail(`--expires sai dạng: ${s} (vd 7d, 12h, 2026-12-31)`)
  return d
}
const expires = parseExpires(opt.expires)

// ---- kết nối Firebase ----
const keyFile = join(here, '.service-account.json')
let credential
if (process.env.GOOGLE_APPLICATION_CREDENTIALS) credential = applicationDefault()
else if (existsSync(keyFile)) credential = cert(JSON.parse(readFileSync(keyFile, 'utf8')))
else fail('Không tìm thấy khoá service account: đặt GOOGLE_APPLICATION_CREDENTIALS hoặc lưu scripts/.service-account.json')
initializeApp({ credential })
const db = getFirestore()

// ---- tìm người nhận ----
const mail = {
  title: opt.title,
  body: (opt.body ?? '').replace(/\\n/g, '\n'),
  from: opt.from ?? 'Vườn mây',
  rewards,
  createdAt: FieldValue.serverTimestamp(),
  expiresAt: expires ? Timestamp.fromDate(expires) : null,
}

let targets = [] // { ref (vườn), name, family }
if (!opt.broadcast) {
  let uid = null
  if (opt.to !== 'all') uid = opt.to.includes('@') ? (await getAuth().getUserByEmail(opt.to)).uid : opt.to
  const snap = await db.collectionGroup('gardens').get()
  targets = snap.docs
    .filter((d) => d.ref.parent.parent?.parent.id === 'families')
    .filter((d) => !uid || d.id === uid)
    .filter((d) => !opt.family || d.ref.parent.parent.id === opt.family)
    .map((d) => ({ ref: d.ref, name: d.get('name') || d.id, family: d.ref.parent.parent.id }))
  if (!targets.length) fail('Không tìm thấy vườn nào khớp (người đó đã mở game Vườn mây chưa?)')
}

// ---- xác nhận ----
console.log('Thư:', JSON.stringify({ ...mail, createdAt: '(lúc gửi)', expiresAt: expires?.toISOString() ?? null }, null, 2))
if (opt.broadcast) console.log(`→ THƯ CHUNG (gardenBroadcasts)${opt['new-players'] ? ', cả người chơi mới' : ', chỉ vườn đã có trước lúc gửi'}`)
else { console.log(`→ ${targets.length} vườn:`); for (const t of targets) console.log(`   ${t.name}  (gia đình ${t.family}, uid ${t.ref.id})`) }
if (!Object.keys(rewards).length) console.log('(Thư không có quà)')
if (opt['dry-run']) { console.log('--dry-run: không ghi gì.'); process.exit(0) }
if (!opt.yes) {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  const ans = (await rl.question('Gửi? (gõ "co" để gửi): ')).trim().toLowerCase()
  rl.close()
  if (ans !== 'co' && ans !== 'có') { console.log('Đã huỷ.'); process.exit(0) }
}

// ---- ghi ----
if (opt.broadcast) {
  const ref = await db.collection('gardenBroadcasts').add({ ...mail, newPlayers: !!opt['new-players'] })
  console.log(`Đã gửi thư chung: gardenBroadcasts/${ref.id}`)
} else {
  for (let i = 0; i < targets.length; i += 400) {
    const batch = db.batch()
    for (const t of targets.slice(i, i + 400)) batch.set(t.ref.collection('mail').doc(), { ...mail, claimedAt: null })
    await batch.commit()
  }
  console.log(`Đã gửi ${targets.length} thư.`)
}
process.exit(0)
