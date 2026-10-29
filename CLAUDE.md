# Dự án: Quản lý kế toán (kaikeikanri)

## Tổng quan
- Web app dạng PWA, cài được lên iPhone (Add to Home Screen)
- Công nghệ: React + TypeScript + Vite, vite-plugin-pwa, Tailwind CSS
- Database / backend: Firebase (Firestore, Authentication, Hosting)
- Trả lời người dùng bằng tiếng Việt

## Chức năng
App là một "hệ thống nhiều app con": sau khi đăng nhập, màn hình chính hiện lưới icon giống màn hình iPhone,
mỗi icon là một app con (Quỹ, sau này thêm các app quản lý khác). Danh sách icon nằm ở `src/apps.ts`.
**Mỗi app con có màn hình Cài đặt riêng của nó** bên trong app, không có màn hình cài đặt chung cho tất cả.

- [x] Đăng nhập / Tạo tài khoản / Quên mật khẩu (Firebase Auth, email + mật khẩu)
- [x] Màn hình chính dạng lưới icon (`/`), đăng xuất ở màn hình này

### Gia đình (bảo mật dữ liệu)
**Dữ liệu Quỹ, Trạng thái, Chăm con thuộc về từng GIA ĐÌNH, KHÔNG chia sẻ cho mọi người dùng.**
Chỉ thành viên trong cùng gia đình mới xem / sửa được; Security Rules (`firestore.rules`) chặn ở phía server.
- Sau khi đăng nhập: **tạo gia đình mới** (`/family/create`, sinh **mã 6 ký tự**) hoặc **tham gia** bằng mã (`/family/join`, gửi yêu cầu).
  Người xin tham gia chỉ thành thành viên (và xem được dữ liệu) **sau khi chủ gia đình duyệt**.
- **Mỗi người chỉ tạo được 1 gia đình** (Rules chặn bằng dấu `users/{uid}/meta/ownedFamily`), nhưng **tham gia được nhiều gia đình**.
- **Chọn gia đình ngay ở màn hình chính** (ô chọn dưới lời chào, có thêm lựa chọn "Tạo gia đình mới" / "Tham gia gia đình khác"),
  không có màn hình chọn gia đình riêng. Lựa chọn được nhớ theo tài khoản (localStorage).
- Màn hình chính có **FAB chuông** (cạnh FAB thoát) với số đếm yêu cầu xin gia nhập, **cập nhật realtime**; bấm vào mở `/notifications` để Duyệt / Từ chối.
- **Quản lý gia đình** (`/family/manage`, mở từ "Quản lý ›" dưới ô chọn gia đình hoặc trong ô chọn): danh sách thành viên realtime;
  chủ gia đình **đổi tên** (cập nhật cả `familyCodes` và `users/{uid}/families` của mọi thành viên) và **xoá thành viên**;
  thành viên **rời gia đình**. Xoá / rời đều phải bấm 2 lần để xác nhận, và xoá luôn `presence` của người đó.
  **Chủ gia đình không rời được gia đình mình tạo** (Rules cũng chặn).
- Code: `src/contexts/FamilyContext.tsx` (danh sách gia đình, gia đình đang chọn, yêu cầu realtime), `src/pages/family/`,
  `src/lib/family.ts` (`familyCol(name)` = collection của gia đình đang chọn). Layout của mỗi app con dùng `useAppScope()`:
  chưa chọn gia đình thì về màn hình chính; Provider của app con tạo lại khi đổi gia đình.

Dữ liệu gia đình (xem `src/pages/family/data/api.ts`):
- `families/{familyId}`: `name`, `code`, `ownerUid`, `ownerName`
- `families/{familyId}/members/{uid}`: thành viên (`role` owner / member), chỉ chủ gia đình thêm được
- `families/{familyId}/requests/{uid}`: yêu cầu xin tham gia đang chờ duyệt
- `familyCodes/{code}` -> `familyId` (chỉ tra được đúng 1 mã, không liệt kê được)
- `users/{uid}/families/{familyId}`: các gia đình mình tham gia (hiện ở ô chọn); `users/{uid}/requests/{familyId}`: yêu cầu mình đã gửi
- **Mọi dữ liệu của app con phải nằm trong `families/{familyId}/...`** (dùng `familyCol`) và phải thêm `match` tương ứng
  (`allow ...: if isMember(fid)`) vào `firestore.rules`. Không tạo dữ liệu dùng chung ngoài gia đình.

### App Quỹ (`/fund`)
- [x] Quản lý nhóm quỹ (`/fund/groups`): tạo các nhóm quỹ (chi tiêu hàng tháng, quỹ cho con, quỹ du lịch…). Nhóm quỹ có thể có **lãi suất**; khi có lãi suất thì số dư tự tăng theo **lãi kép hàng tháng**
- [x] Nạp vào quỹ (`/fund/deposit`)
- [x] Rút từ quỹ (`/fund/withdraw`)
- [x] Tra cứu quỹ (`/fund/history`): lịch sử nạp / rút / lãi, lọc theo quỹ và loại
- [x] Cài đặt của app Quỹ (`/fund/settings`)

Dữ liệu Firestore (xem `src/pages/fund/data/api.ts`), thuộc gia đình đang chọn:
- `families/{familyId}/funds/{fundId}`: nhóm quỹ, `balance` là số dư hiện tại (VND, số nguyên)
- `families/{familyId}/transactions/{txId}`: giao dịch `deposit` / `withdraw` / `interest`, `amount` luôn dương, có `createdByName` (người thực hiện)
- `users/{uid}/settings/fund`: cài đặt hiển thị của app Quỹ, RIÊNG từng tài khoản
- Security Rules ở `firestore.rules`

Lãi kép: lãi suất lưu theo %/năm, mỗi tháng cộng `số dư × lãi/12` vào đúng ngày mốc (`interestAnchor` + `interestPeriods` tháng).
Lãi được cộng phía client khi mở app (`applyDueInterest`, chạy trong Firestore transaction để không cộng trùng).

### App Trạng thái (`/status`)
Biết mọi người đang ở đâu: tạo các địa điểm (mỗi địa điểm là 1 mô hình 3D), xếp lên bản đồ mini dạng bàn cờ,
rồi gắn tag người dùng lên mô hình theo vị trí GPS.
- [x] Bước 1 - Địa điểm (`/status/places`): chọn loại (7 mô hình 3D), tên, tọa độ (dán từ Google Maps hoặc lấy vị trí hiện tại), ghi chú
- [x] Bước 2 - Bản đồ mini (`/status/map`): dạng **thành phố mini** (nền cỏ một màu, cây quanh mép, **không** tô màu kiểu bàn cờ),
  camera xoay / phóng to / dịch chuyển được (OrbitControls). Bên dưới chia lưới **16×16 ô** (`BOARD_SIZE`) để đặt mô hình, lưới chỉ hiện mờ khi đang kéo.
  **Kích thước chiếm ô** (`data/layout.ts`): chợ, công ty, siêu thị, bệnh viện chiếm **2×2 ô** và vẽ to gấp đôi (cao hơn);
  nhà ở, trạm xe điện, trạm xe buýt chiếm 1 ô. `cell` là ô góc trên-trái của vùng mô hình chiếm.
  Kéo địa điểm từ khay lên, kéo mô hình sang chỗ khác để di chuyển; thả vào chỗ vướng đúng 1 mô hình thì đổi chỗ (nếu cả hai vừa),
  không đủ chỗ thì tô đỏ và không cho thả (`planDrop`); kéo xuống khay để gỡ.
  Lưu ô vào `cell` của địa điểm (`models/BoardScene.tsx`, `MiniMapPage.tsx`)
- Nền mô hình 3D (xem trước và bản đồ) là **cỏ** (`models/Nature.tsx`), không dùng ô bàn cờ.
- [x] Bước 3 - Trạng thái (`/status/live`): thành phố mini chỉ xem (không kéo được), trên mỗi mô hình nổi tag avatar những người đang ở đó
  (tag là HTML đặt chồng lên canvas, vị trí tính từ toạ độ 3D mỗi khung hình, `models/StatusScene.tsx`); thanh "Bạn đang ở…" + tình trạng GPS; dải "Ai đang ở đâu"; FAB định vị để cập nhật ngay.
  Theo dõi GPS (`watchPosition`) chạy trong `StatusProvider` khi **đang mở app Trạng thái** (bất kỳ trang nào của app).
  Quy tắc chọn địa điểm ở `data/presence.ts` (`decidePlace`): bỏ lần đo sai số > 60m, cần 2 lần đo liên tiếp mới chuyển,
  địa điểm cũ còn trong 100m thì địa điểm mới phải gần hơn ≥ 15m; bấm FAB định vị thì chuyển ngay. Chỉ ghi Firestore khi địa điểm đổi.
- [ ] Cài đặt của app Trạng thái

Quyết định đã chốt:
- **Cập nhật vị trí theo "cách A"**: chỉ cập nhật khi người dùng **mở app** (PWA trên iPhone không lấy được vị trí khi chạy nền).
  Sau này có thể thêm Phím tắt iPhone (cách B) hoặc đóng gói app iOS bằng Capacitor (cách C) mà không phải làm lại.
- Quy tắc gắn tag: người dùng vào **bán kính 100m** của địa điểm thì tag chuyển sang địa điểm đó và **nằm yên** cho tới khi vào vùng của địa điểm khác.
  Trong 100m có nhiều địa điểm thì **chọn địa điểm gần nhất**. Bỏ qua lần đo GPS kém chính xác để tránh nhảy qua lại.
- Quyền riêng tư: chỉ lưu người dùng đang ở **địa điểm nào**, không lưu tọa độ thật của người dùng.
- 7 mô hình 3D (nhà ở, chợ, công ty, trạm xe điện, trạm xe buýt, siêu thị, bệnh viện) **dựng bằng code** (low-poly) trong
  `src/pages/status/models/PlaceModels.tsx`, dùng three.js + @react-three/fiber. Thư viện 3D chỉ tải khi mở màn hình cần (lazy).

Dữ liệu Firestore (xem `src/pages/status/data/api.ts`), thuộc gia đình đang chọn:
- `families/{familyId}/places/{placeId}`: địa điểm (`type`, `name`, `lat`, `lng`, `note`, `cell` = ô trên bàn cờ hoặc null)
- `families/{familyId}/presence/{uid}`: thành viên đang ở đâu (`name`, `placeId`, `since`), **không có toạ độ**; thành viên xem được, mỗi người chỉ sửa được của mình

### App Chăm con (`/baby`)
Ghi lại hoạt động hằng ngày của bé theo time line.
- [x] Thẻ hoạt động (`/baby/cards`): tên thẻ, màu, icon (bắt buộc có **ăn 🍼, ngủ 😴, chơi 🧸, đi vệ sinh 🚽**, thêm vài icon khác), thời gian mặc định (phút)
- [x] Time line (`/baby/timeline`): chọn ngày; danh sách hoạt động trong ngày theo giờ bắt đầu (cuộn trong bảng);
  khay thẻ bên dưới, chạm 1 thẻ để mở khung nhập. **Giờ bắt đầu mặc định** dựa vào hoạt động cuối cùng trong danh sách (giờ bắt đầu muộn nhất):
  đã kết thúc thì lấy **giờ kết thúc** của nó; **chưa kết thúc thì lấy giờ hiện tại, và khi lưu sẽ tự kết thúc hoạt động cuối bằng giờ bắt đầu của hoạt động mới**
  (cùng 1 batch); chưa có hoạt động nào thì giờ hiện tại / 7:00. Sửa được.
  Ô check **"Đã hoàn thành"**: có check mới nhập số phút / kết thúc; không check = hoạt động **đang diễn ra / sắp bắt đầu** (lưu `minutes` = `end` = null),
  trên time line hiện nhãn "Đang diễn ra" / "Sắp bắt đầu". Thêm mới mặc định là chưa hoàn thành.
  thời gian hoạt động mặc định lấy từ thẻ; **giờ kết thúc tự tính = bắt đầu + thời gian**. **Giờ kết thúc cũng sửa được**: sửa kết thúc thì số phút tự tính lại (kết thúc trước giờ bắt đầu = sang hôm sau), sửa bắt đầu thì giữ số phút và dời kết thúc. Chạm hoạt động đã có để sửa / xoá.
- [x] Thống kê (`/baby/stats`): chọn ngày (thanh chọn ngày dùng chung `DayBar` trong `components.tsx`); 2 ô tổng thời gian / số lần;
  **biểu đồ cột** thời gian theo từng hoạt động (thẻ) trong ngày, xếp giảm dần, màu cột theo màu thẻ, icon thẻ ở trục ngang, chạm cột để xem chi tiết;
  bên dưới là bảng số liệu (số lần, %, thời lượng) chiếm phần còn lại. Cách tính ở `data/stats.ts` (`dayStats`):
  đã hoàn thành = số phút đã ghi; **đang diễn ra = tính tới bây giờ** (ngày đã qua thì tới hết ngày, tự cập nhật mỗi phút); sắp bắt đầu = không tính.
  Mỗi lần hoạt động được tính trọn cho ngày nó bắt đầu.
- [ ] Cài đặt của app Chăm con

Dữ liệu Firestore (xem `src/pages/baby/data/api.ts`), thuộc gia đình đang chọn:
- `families/{familyId}/babyCards/{cardId}`: thẻ hoạt động (`name`, `icon`, `color`, `defaultMinutes`)
- `families/{familyId}/babyEntries/{entryId}`: hoạt động (`cardId`, `start`, `minutes`, `end`, `createdByName`; chưa hoàn thành thì `minutes` / `end` = null) + lưu sẵn `name` / `icon` / `color` của thẻ
  để sửa / xoá thẻ không làm mất lịch sử

## Cấu trúc code
- `src/components/ui/sizes.ts`: kích thước dùng chung giữa giao diện thật và skeleton
- Mỗi app con nằm trong thư mục riêng `src/pages/<app>/`, trang con dùng `AppHeader` (có nút quay lại)
- Dữ liệu của app con nằm trong `src/pages/<app>/data/` (types, api, Context dùng chung cho các trang của app)
- Mỗi trang export cả component thật và `XxxSkeleton` trong cùng file; `App.tsx` hiển thị skeleton khi đang loading
- Cấu hình Firebase đọc từ `.env` (xem `.env.example`)

## Yêu cầu giao diện (bắt buộc)

### 1. Kích thước nút
- Các nút chức năng nằm gần nhau (cùng hàng, cùng nhóm, cùng panel) phải có **chiều rộng và chiều cao bằng nhau**.
- Không để nút co giãn theo độ dài chữ. Dùng grid / `flex-1` / chiều rộng cố định để các nút đồng đều.

### 2. Thẳng hàng theo chiều dọc (ưu tiên cao hơn kích thước nút)
- Các nút phải **thẳng hàng theo phương dọc** với các nút ở hàng trên / hàng dưới.
- Nếu phải chọn giữa "giữ nút nhỏ" và "thẳng hàng", **ưu tiên thẳng hàng**: cứ làm nút to ra để mép nút khớp với nút ở trên.
- Ưu tiên dùng CSS Grid với cùng số cột / cùng template cột giữa các hàng để đảm bảo cột thẳng.

### 3. Skeleton khi loading
- Mọi màn hình / khu vực có tải dữ liệu đều phải hiển thị **khung xương (skeleton)** trong lúc loading, không dùng màn hình trắng hay chỉ có spinner.
- Skeleton phải mô phỏng đúng bố cục thật: cùng số dòng, cùng vị trí panel, nút, ô nhập.

### 4. Skeleton phải khớp chiều cao với giao diện thật
- Khi thay đổi giao diện của một màn hình / component, **phải cập nhật luôn skeleton tương ứng** trong cùng lần sửa.
- Chiều cao của skeleton và giao diện thật phải bằng nhau, để khi loading xong **trang không bị nhảy (layout shift)**.
- Nên dùng chung chiều cao cố định / class kích thước giữa skeleton và component thật (ví dụ đặt hằng số hoặc class dùng chung).

### 5. Phong cách hiện đại: gradient + glass
- Nền dùng **màu gradient**.
- Panel / card theo kiểu **glassmorphism**: nền bán trong suốt, `backdrop-blur`, viền mảnh sáng nhẹ.
- Panel **bo tròn góc** (khoảng `rounded-2xl` trở lên) và có **shadow** để nổi bật so với nền.
- Giữ độ tương phản chữ đủ để dễ đọc trên nền glass.

### 6. Vừa khít màn hình iPhone 11 / iPhone 12, không có thanh cuộn trang
- Mọi màn hình phải hiển thị gọn trong **iPhone 11 (414×896)** và **iPhone 12 (390×844)**, tính cả vùng tai thỏ / thanh home khi cài lên màn hình chính (vùng dùng được trên iPhone 12 khoảng 390×760).
- **Trang không được cuộn, không xuất hiện thanh cuộn.** Khung trang (`PageShell`, `AuthLayout`) cao đúng `100dvh` và `overflow-hidden`.
- Nếu nội dung dài, ưu tiên thu gọn: đặt các ô nhập ngắn cạnh nhau (grid 2 cột), giảm khoảng cách, rút gọn chữ, thay vì để trang dài ra.

### 7. Màn hình có bảng / danh sách dữ liệu
- Bảng (danh sách) chiếm **phần chiều cao còn lại** của màn hình (`ScrollArea`: `flex-1 min-h-0`), chiều cao cố định theo màn hình chứ không theo số dòng.
- **Chỉ nội dung bên trong bảng được cuộn**; tiêu đề, bộ lọc, ô thống kê, nút bấm phía trên đứng yên.
- Thu nhỏ các thành phần khác (bộ lọc, thống kê...) để dành nhiều chỗ nhất cho bảng.
- Skeleton của bảng cũng dùng `ScrollArea` nên luôn cao đúng bằng bảng thật.

### 8. Ô nhập số tiền
- **Mọi ô nhập số tiền phải dùng `MoneyField`** (`src/components/ui/MoneyField.tsx`), không tự viết lại bằng `TextField`.
- Đang nhập (onChange): chỉ giữ chữ số, **không chèn dấu chấm**.
- Nhập xong (onBlur): hiển thị **có dấu chấm** phân cách hàng nghìn (vd `1.500.000`).
- Giá trị tối đa **1 tỷ** (`MAX_MONEY`): nhập vượt quá thì tự đưa về 1 tỷ ngay trong onChange.

### 9. Icon dạng 3D ảnh
- **Mọi icon trong app phải hiển thị dạng 3D ảnh**: dùng component `Icon3D` (`src/components/ui/Icon3D.tsx`) với emoji tương ứng, vd `<Icon3D emoji="💰" className="h-8 w-8" />`. Không hiển thị emoji dạng chữ, không dùng icon SVG phẳng.
- Ảnh lấy từ bộ **Microsoft Fluent Emoji 3D** (giấy phép MIT), **đã tải về `public/icons3d/`** (tên file = mã Unicode, bỏ FE0F). App không tải ảnh từ mạng ngoài.
- **Khi dùng emoji mới**: thêm emoji vào danh sách `EMOJIS` trong `scripts/fetch-icons3d.mjs` rồi chạy `npm run icons3d` để tải ảnh về. Nếu emoji không có bản 3D, script sẽ báo và `Icon3D` tự hiện emoji thường.
- Icon nằm trên nền màu (icon app, icon quỹ, huy hiệu...) thì đặt trong **khối nổi 3D**: `BLOCK_3D` + lớp bóng loáng `GLOSS_3D` (`src/components/ui/style3d.ts`). Ô chọn dạng kính dùng `TILE_3D` / `TILE_3D_SELECTED`.
- Góc nhìn: thẳng từ trên xuống (không nghiêng xéo).
- Ngoại lệ: chữ trong `<option>` của ô chọn gốc (native select) không hiển thị được ảnh, giữ emoji dạng chữ. Các ký hiệu điều khiển nhỏ (mũi tên quay lại ‹, mũi tên ▾ của ô chọn) không tính là icon.
- **Ngoại lệ: icon trên nút nổi (FAB) KHÔNG dùng 3D**, xem mục 10.

### 10. Nút nổi (Floating Action Button - FAB)
- **Ưu tiên dùng FAB cho các chức năng của màn hình** (thêm, lưu, xoá, sửa...). Màn hình có 1 nút chức năng thì nút đó **bắt buộc là FAB**.
- FAB: nút **tròn**, nằm **góc phải dưới**, **chỉ có icon, không có chữ** (chữ để trong `label` cho trình đọc màn hình). Dùng `Fab` / `FabLink` / `FabGroup` trong `src/components/ui/Fab.tsx`.
- **Icon trên FAB là icon nét màu trắng đơn giản** (SVG trong `Fab.tsx`), **không dùng icon 3D**.
  Nút **không có hiệu ứng 3D** (không khối nổi, không lớp bóng loáng), chỉ có **bóng đổ** để nổi lên trên giao diện.
- Icon theo chức năng (`icon=` của `Fab`):
  - Thêm: dấu cộng (`add`)
  - Xoá: thùng rác (`delete`)
  - Lưu: dấu check (`save`), gồm cả các nút gửi form như tạo mới, nạp / rút tiền
  - Chỉnh sửa: cây bút (`edit`)
  - Huỷ: dấu X (`cancel`)
  - Chức năng khác: chọn icon phù hợp, vẽ thêm vào `ICON_PATHS` (vd đăng xuất `logout`)
- Có **2 FAB trở lên thì xếp HÀNG NGANG** (không xếp dọc), mọi FAB cùng kích thước; nút chính (lưu / xác nhận) nằm **bên phải ngoài cùng**, sát góc màn hình.
- Form Tạo / Sửa dùng `SaveDeleteFabs`: tạo mới chỉ có [lưu]; sửa có [xoá] [lưu], bấm xoá thì đổi thành [huỷ] [xoá] và phải bấm xoá lần nữa mới xoá thật.
  Nút lưu nằm ngoài `<form>` nên gắn bằng `form={FORM_ID}`.
- **Không đặt FAB bên trong `GlassPanel`** (backdrop-blur làm `position: fixed` bị lệch); đặt trực tiếp trong `PageShell`.
- Danh sách cuộn có FAB thì thêm `FAB_SPACE` vào cuối danh sách để mục cuối không bị che. Skeleton dùng `FabSkeleton` cùng số nút.
- Ngoại lệ (giữ nút thường): form đăng nhập / đăng ký / quên mật khẩu (nhiều nút điều hướng), nút phụ trợ nằm cạnh ô nhập (vd nút lấy vị trí cạnh ô tọa độ),
  nút theo ngữ cảnh trong thanh thông tin (vd nút Gỡ của mô hình đang chọn ở bản đồ mini).
### 11. Menu / danh sách theo hàng ngang: phân trang, không cuộn
- Menu hoặc danh sách nằm theo **hàng ngang** (khay thẻ, khay địa điểm, dải người dùng...) **không được cuộn ngang**; phải **phân trang**.
- Dùng component `PagedRow` (`src/components/ui/PagedRow.tsx`), skeleton dùng `PagedRowSkeleton`.
- **Mỗi trang phải hiện trọn vẹn thông tin, không cắt xén**: số mục mỗi trang tự tính theo bề rộng màn hình và `itemWidth`
  (bề rộng tối thiểu để 1 mục hiện đủ), nên không có mục nào bị cắt ở mép. Tên dài thì xuống dòng (tối đa 2–3 dòng, chữ nhỏ lại nếu cần) để đọc được trọn vẹn.
- **Bên trái và bên phải có nút hình tam giác** để chuyển trang trước / sau; hết trang thì nút mờ đi.
- Nếu hàng nằm dưới nút nổi (FAB) thì chừa chỗ bên phải (`className="pr-..."`) để nút tam giác không bị FAB che.
- Không áp dụng cho nhóm nút chọn cố định dạng lưới (`Segmented`, lưới chọn icon / màu): các hàng này vừa khít màn hình, không cuộn.
### 12. Ô nhập số phút
- **Mọi ô nhập số phút phải dùng `MinutesField`** (`src/components/ui/MinutesField.tsx`), không tự viết bằng `TextField`.
- Bên phải ô có **2 nút tam giác lên / xuống** (bằng nhau, xếp dọc): bấm lên **tăng 5 phút**, bấm xuống **giảm 5 phút**; vẫn gõ số trực tiếp được.
- Giới hạn bằng `min` / `max` (mặc định 1 phút đến 24 giờ); hết giới hạn thì nút tương ứng mờ đi.