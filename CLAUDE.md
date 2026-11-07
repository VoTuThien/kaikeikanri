# Dự án: Quản lý kế toán (kaikeikanri)

## Tổng quan
- Web app dạng PWA, cài được lên iPhone (Add to Home Screen)
- Công nghệ: React + TypeScript + Vite, vite-plugin-pwa, Tailwind CSS
- Database / backend: Firebase (Firestore, Authentication, Hosting)
- Trả lời người dùng bằng tiếng Việt
- Phải chạy được trên **iPhone cũ (iOS 15.1)**: `vite.config.ts` hạ cú pháp JS (`build.target`) và CSS (`cssTarget`),
  `postcss.config.js` bỏ `@layer`, thêm màu rgb dự phòng cho oklch và bỏ `in oklab` trong gradient

## Chức năng
App là một "hệ thống nhiều app con": sau khi đăng nhập, màn hình chính hiện lưới icon giống màn hình iPhone,
mỗi icon là một app con (Quỹ, sau này thêm các app quản lý khác). Danh sách icon nằm ở `src/apps.ts`.
**Mỗi app con có màn hình Cài đặt riêng của nó** bên trong app, không có màn hình cài đặt chung cho tất cả.

- [x] Đăng nhập / Tạo tài khoản / Quên mật khẩu (Firebase Auth, email + mật khẩu)
- [x] Màn hình chính dạng lưới icon (`/`), đăng xuất ở màn hình này. Hàng lời chào: **[avatar của mình] [Xin chào, tên] [nút cây bút]**
  (nút bút là icon nét `LineIcon edit`, không 3D) → mở **Thông tin cá nhân**
- [x] **Thông tin cá nhân** (`/profile`, `src/pages/ProfilePage.tsx`, giống form thông tin con): **tên, nickname, ngày sinh, giới tính (Nam / Nữ), nghề nghiệp, avatar**.
  Chạm avatar tròn ở đầu form để chọn / đổi ảnh (có "Bỏ ảnh"); ảnh **không dùng Storage**, cắt vuông + thu nhỏ 256px (`fileToSquareDataUrl`) lưu thẳng vào `photo`.
  Lưu ở `profiles/{uid}` (`src/lib/profile.ts`; người đã đăng nhập **get** được theo uid để hiện avatar của thành viên, không liệt kê được; mỗi người chỉ sửa của mình)
  và đổi luôn tên hiển thị của tài khoản (`updateName` trong `AuthContext`). Lưu xong về màn hình chính.
  **Mọi avatar người dùng dùng chung `Avatar`** (`src/components/Avatar.tsx`): có ảnh trong hồ sơ thì hiện ảnh thật trong khung tròn,
  chưa có thì vòng tròn 2 chữ cái như cũ (`useProfile(uid)`: theo dõi realtime, dùng chung giữa mọi chỗ hiện cùng 1 người). Không tự vẽ avatar 2 chữ ở nơi khác.
- [x] **Phím tắt (shortcut)** ở màn hình chính: sau icon các app con là các phím tắt, cuối cùng là ô **"+"** mở `/shortcuts`
  (liệt kê theo nhóm các màn hình **mở trực tiếp từ ô chức năng ở trang chính của app con**, trừ Cài đặt; chạm để thêm). Phím tắt có màu nền của app con + icon nhỏ của app ở góc.
  **Mở màn hình từ phím tắt thì nút quay lại (‹) của màn hình đó về thẳng màn hình chính** (`markShortcutEntry` / `isShortcutEntry` trong `AppHeader`, lưu ở sessionStorage;
  màn hình chính xoá dấu này mỗi khi hiện ra).
  **Nhấn giữ** 1 icon (~0.5 giây, `useLongPress`) thì vào chế độ gỡ giống iPhone: icon rung, phím tắt có nút "−" để gỡ, FAB check để xong;
  lúc này hiện thêm 2 nút "Bên trái" / "Bên phải": chạm để đổi màn hình 2 bên, đã thiết đặt thì có nút "−" ở góc để gỡ ngay (`REMOVE_BADGE`). Nhiều icon thì chỉ lưới icon cuộn (có thanh cuộn).
- [x] **Màn hình 2 bên** của màn hình chính (`src/components/SideSwipe.tsx`, vẽ `AppRoutes` trong `App.tsx`; khi kéo thì vẽ sẵn màn hình bên cạnh ở mép (`<Routes location>`) và cho 2 màn hình đi theo ngón tay, thả tay thì trượt nốt — kéo quá 30% hoặc vuốt nhanh thì chuyển): ở màn hình chính **vuốt sang phải** mở màn hình **bên trái**,
  **vuốt sang trái** mở màn hình **bên phải**. Chưa thiết đặt thì mở `/side/left|right` có dấu **"+"** để chọn (`/shortcuts?side=…`, cùng danh sách `SHORTCUTS`;
  đã thiết đặt thì có FAB xoá để bỏ). Đang ở màn hình được thiết đặt (**vào từ đâu cũng vậy**: menu của app con, phím tắt, vuốt) thì vuốt ngược lại để về màn hình chính.
  Lưu riêng từng tài khoản ở `left` / `right` của `users/{uid}/settings/launcher`.
  **Nhớ người dùng đang ở màn hình giữa / bên trái / bên phải** (localStorage `home-screen:{uid}`, `loadHomeScreen` / `saveHomeScreen`):
  mở lại app ở `/` thì tự chuyển tới màn hình đã lưu; vào các trang khác (app con…) thì giữ nguyên lựa chọn. Vuốt bắt đầu trên canvas 3D, ô nhập, hoặc phần tử có `data-no-swipe` thì bỏ qua
  (vd khay kéo thả của bản đồ mini, chế độ gỡ phím tắt) — **thêm `data-no-swipe` cho vùng kéo ngang mới**.
  **Lịch sử trang khớp với cử chỉ vuốt từ mép của iOS** (quay lại / tiến tới theo lịch sử trình duyệt, không theo code app): màn hình 2 bên mở từ "/"
  (vuốt, hoặc tự mở lại lúc mở app — **push, không replace**) mang `state.fromHome` và nằm ngay sau "/" trong lịch sử; vuốt từ đó về màn hình chính thì
  `navigate(-1)` (lùi về đúng "/"), nên cử chỉ quay lại của iOS cũng về màn hình chính chứ không về trang cũ (vd menu app con). `touchcancel`
  (iOS giành cử chỉ) thì chỉ trả màn hình về chỗ, không chuyển trang.
  **Icon các app con không gỡ được.** Phím tắt là dữ liệu **riêng từng tài khoản** (`users/{uid}/settings/launcher` `{ shortcuts: string[], left, right }`,
  `src/lib/shortcuts.ts`), không ảnh hưởng màn hình chính của người khác. Code: `src/components/HomeIcon.tsx`, `src/pages/ShortcutPickerPage.tsx`.
  - **QUY ƯỚC: thêm màn hình mới vào app con (mở trực tiếp từ ô chức năng ở trang chính của app con) thì phải thêm dữ liệu phím tắt của màn hình đó (icon + tên màn hình) vào `SHORTCUTS` trong `src/shortcuts.ts`**,
    trừ màn hình Cài đặt (mỗi app con đều có). **Không** thêm màn hình con mở từ bên trong (vd Tạo / Sửa địa điểm từ màn hình Địa điểm). Không đổi `id` của dòng đã có.

### Gia đình (bảo mật dữ liệu)
**Dữ liệu Quỹ, Trạng thái, Chăm con, Ghi chú thuộc về từng GIA ĐÌNH, KHÔNG chia sẻ cho mọi người dùng.**
Chỉ thành viên trong cùng gia đình mới xem / sửa được; Security Rules (`firestore.rules`) chặn ở phía server.
- Sau khi đăng nhập: **tạo gia đình mới** (`/family/create`, sinh **mã 6 ký tự**) hoặc **tham gia** bằng mã (`/family/join`, gửi yêu cầu).
  Người xin tham gia chỉ thành thành viên (và xem được dữ liệu) **sau khi chủ gia đình duyệt**.
- **Mỗi người chỉ tạo được 1 gia đình** (Rules chặn bằng dấu `users/{uid}/meta/ownedFamily`), nhưng **tham gia được nhiều gia đình**.
- **Chọn gia đình ngay ở màn hình chính** (ô chọn dưới lời chào, có thêm lựa chọn "Tạo gia đình mới" / "Tham gia gia đình khác"),
  không có màn hình chọn gia đình riêng. Lựa chọn được nhớ theo tài khoản (localStorage).
- **Bong bóng thông báo** (`src/components/NotificationBubble.tsx`, gắn trong `App.tsx`): bong bóng nhỏ (44px) kiểu bong bóng chat, **nổi trên MỌI màn hình**
  sau khi đăng nhập (màn hình chính không còn FAB chuông). Số đếm = yêu cầu xin gia nhập + nhắc nhập lương thực lãnh (app Quỹ), **cập nhật realtime**;
  **chạm vào mở POPUP thông báo ngay trên màn hình đang xem** (không rời màn hình, kiểu bong bóng chat Android): bong bóng bay lên góc trên (cùng phía mép,
  chuông xoay thành dấu X), khung glass bung ra ngay bên dưới với mũi nhọn chỉ vào bong bóng (phóng từ mũi nhọn, hơi nảy), nền phía sau mờ đi,
  các dòng thông báo hiện lần lượt (`animate-notify-item` trong `index.css`). Chạm bong bóng / nền mờ / phím Esc hoặc đổi màn hình thì đóng.
  Trong popup: Duyệt / Từ chối xin gia nhập tại chỗ, chạm dòng nhắc lương để mở màn hình Thực thi (nhập lương thực lãnh).
  Nội dung dùng chung `NotificationList` (`src/pages/family/NotificationList.tsx`) với trang `/notifications` (vẫn mở được bằng URL).
  **Thông báo LƯU LẠI** (`families/{familyId}/notifications/{id}`, `src/lib/notifications.ts`, `useNotices`): **không tự mất, luôn xem lại được trong popup**
  (nhóm "Ghi chú & time line", mới nhất trước; đã xong / đã xem thì mờ đi):
  - **Ghi chú gửi cho THÀNH VIÊN KHÁC** (không phải tự ghi cho mình) → thông báo cho người nhận (id `note_{noteId}`, chỉ người nhận thấy):
    **"Chưa xong" → "Hoàn thành"** khi người nhận làm xong mọi thẻ (`setItemDone` cập nhật trong cùng transaction; sửa ghi chú thì `updateNote` ghi lại);
    chạm → mở ghi chú đó ở Xem ghi chú (`/note/inbox/:id`). Xoá ghi chú thì xoá luôn thông báo của nó.
  - **Time line của 1 con được cập nhật** (thêm / sửa / xoá / kéo hoạt động) → thông báo cho các thành viên khác (id `baby_{childId}`):
    **MỖI CON CHỈ 1 THÔNG BÁO, cập nhật ĐÈ lên** chứ không thêm mới (`setBabyNotice` trong cùng batch với thao tác, `seenBy` = ai đã xem;
    người vừa cập nhật tính là đã xem). **"Mới" → "Đã xem"** khi người đó mở time line của con đó (`markBabySeen`); cập nhật mới lại thành "Mới".
    Chạm → `/baby/timeline?child=id` (Time line chọn đúng con rồi bỏ tham số).
  **Còn thông báo nào khác "Đã xem" / "Hoàn thành"** (ghi chú chưa xong, time line chưa xem, xin gia nhập, nhắc lương) thì tính vào số đếm và **không ẩn được bong bóng**.
  **Kéo được**, thả tay thì dính vào mép trái / phải của khung app (đuôi bong bóng quay về mép đó), không che thanh tiêu đề / vùng FAB; vị trí nhớ theo tài khoản
  (localStorage `notify-bubble:{uid}`). Đang kéo thì hiện **dấu X ở giữa dưới màn hình**: **không có thông báo** thì thả vào X để **ẩn** bong bóng;
  **có thông báo thì không ẩn được** (X mờ + "Còn n thông báo", thả vào thì bật về chỗ cũ), và bong bóng đã ẩn **tự hiện lại (nhảy lên)** khi có thông báo, cho tới khi giải quyết xong.
  **Bong bóng đang ẩn thì màn hình chính có FAB chuông** (bên phải nút thoát, `useBubbleHidden` / `revealBubble`): chạm để hiện lại bong bóng và mở luôn popup thông báo.
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
- [x] Quản lý nhóm quỹ (`/fund/groups`): danh sách thẻ nhóm quỹ có **số thứ tự** (`position`, liên tục 1..n, không trùng; mọi danh sách / ô chọn quỹ xếp theo số này).
  **Chạm thẻ** mở màn hình **Nạp / Rút / Chuyển của quỹ đó** (`/fund/groups/:id/tx`, `FundActionPage`, giống form Tạo lệnh chuyển, quỹ điền sẵn);
  **trượt thẻ sang trái** hiện nút **cây bút** → chạm để sửa nhóm quỹ (`/fund/groups/:id`); **giữ tay cầm ≡ kéo lên / xuống** để đổi thứ tự (`reorderFunds`).
  Form tạo / sửa có ô "Số thứ tự" (`NumberField`, cạnh ô tên); thêm / đổi số / xoá / kéo thả đều đánh số lại mọi quỹ cùng 1 batch. Quỹ cũ chưa có số thì xếp theo lúc tạo.
  Tạo các nhóm quỹ (chi tiêu hàng tháng, quỹ cho con, quỹ du lịch…). Nhóm quỹ có thể có **lãi suất**; khi có lãi suất thì số dư tự tăng theo **lãi kép hàng tháng**.
  Ô check **"Đã chuyển đi"** (`transferred`): tiền của quỹ không còn trong tài khoản nên **không tính vào tổng số dư** ở màn hình app Quỹ (thẻ quỹ hiện số dư gạch ngang)
- [x] **Đọc hoá đơn** (`/fund/receipt`, `ReceiptPage`): chạm khung ảnh để chụp / chọn ảnh hoá đơn → **đọc chữ NGAY TRÊN MÁY bằng Tesseract.js**
  (miễn phí, ảnh không gửi đi đâu; `data/receipt.ts`) → tách dữ liệu (`data/receiptParse.ts`, `parseReceipt`) và **điền sẵn form RÚT QUỸ**: số tiền
  (ưu tiên dòng "tổng cộng / tổng tiền / thanh toán / phải trả / total" hoặc dòng ngay dưới, bỏ "tiền mặt / khách đưa / tiền thừa / giảm giá / VAT", bỏ số trên dòng SĐT / MST),
  ngày (dd/mm/yyyy…, "ngày .. tháng .. năm", không lấy ngày tương lai), ghi chú "Hoá đơn <tên cửa hàng>". Đọc sai thì chạm số khác ở hàng "Số tiền tìm thấy"
  (tối đa 4 số) hoặc sửa tay; "Xem chữ đọc được" mở chữ thô. FAB check rút như màn hình Rút quỹ (`addTransaction`), xong thì dọn form cho hoá đơn tiếp theo.
  Ảnh được thu nhỏ (cạnh dài ≤ 1800px), chuyển xám + kéo giãn tương phản trước khi đọc; rời màn hình thì tắt worker (`stopOcr`).
  **File Tesseract tự host** ở `public/tesseract/` (worker, lõi WASM bản LSTM thường / SIMD, `vie.traineddata.gz` best_int), chép từ `node_modules`
  bằng `scripts/copy-tesseract.mjs` (chạy tự động ở `predev` / `prebuild`, thư mục bị gitignore); **không đưa vào precache** của PWA
  (`globIgnores`), chỉ tải lần đầu mở màn hình (~5MB) rồi lưu bằng runtime cache `CacheFirst`. Thư viện được import động.
  **Không dùng regex lookbehind** trong phần tách dữ liệu (iOS 15.1 lỗi cú pháp).
  **Ô "Loại hoá đơn"** (`RECEIPT_KINDS`, nhớ lựa chọn ở localStorage `receipt-kind`, mặc định **Bách Hoá Xanh**; đổi loại thì tách lại chữ đã đọc, không đọc ảnh lại):
  - **BHX** (`parseBhx`, "PHIẾU THANH TOÁN BÁCH HÓA XANH"): bảng từ dòng tiêu đề "SL / Giá bán / Thành tiền" tới dòng "Phải thanh toán";
    mỗi sản phẩm = dòng tên (có thể nhiều dòng) + dòng số liệu "SL … thành tiền"; **chỉ lấy tên, SL (lẻ được, "0,274") và thành tiền**, bỏ cột giá bán.
    **Số tiền rút = "Phải thanh toán"** (không đọc được thì = tổng thành tiền). Màn hình hiện "n sản phẩm · tổng · khớp / lệch" và "Xem sản phẩm".
  - **Hoá đơn khác**: cách tách chung ở trên (không có danh sách sản phẩm).
  Có danh sách sản phẩm thì **lưu kèm vào giao dịch rút**: `receipt` (loại) + `items` = `[{ name, qty, amount }]` (`addTransaction` tham số `receipt`).
  Thêm loại hoá đơn mới: thêm vào `RECEIPT_KINDS` + hàm tách riêng trong `receiptParse.ts`.
- [x] Nạp vào quỹ (`/fund/deposit`)
- [x] Rút từ quỹ (`/fund/withdraw`)
- [x] Chuyển quỹ (`/fund/transfer`): chuyển tiền từ quỹ A sang quỹ B (giao diện giống nạp / rút, có 2 ô chọn "Từ quỹ" / "Sang quỹ",
  chọn trùng thì tự đổi chỗ 2 quỹ). Ghi 2 giao dịch `transfer_out` / `transfer_in` (có `peerFundId`) và cập nhật 2 số dư trong cùng 1 batch (`transferFunds`)
- [x] Lương (`/fund/salary`): mỗi thành viên 1 **thẻ**, **chỉ gồm [ngày nhận lương] và [chuyển vào quỹ]** (không nhập lương thực lãnh ở đây).
  Thẻ của mình chỉnh **trực tiếp** trên thẻ (đổi là lưu ngay); thẻ người khác chỉ xem. Ngày nhận lương 1–31 (tháng ngắn hơn thì lấy ngày cuối tháng).
  **Ngày nhận lương để trống ("Không có lương") = người đó không có lương** (mặc định khi chưa đặt; đặt lại về trống được, vd khi thất nghiệp):
  không nhắc, không cần nhập lương thực lãnh.
  **Đến ngày nhận lương mà chưa nhập lương thực lãnh thì bong bóng thông báo có nhắc** (`useSalaryReminders`, xét 3 tháng gần nhất, từ tháng thiết đặt),
  **thông báo còn đó cho tới khi nhập xong**; chạm dòng nhắc ở trang Thông báo thì **mở màn hình Thực thi** đúng tháng đó (`/fund/execute?month=YYYY-MM`).
  **Lương thực lãnh chỉ nhập ở bước 1 của Thực thi**; lưu là **tự nạp vào quỹ nhận lương** (`saveSalary` trong `data/salary.ts`, 1 transaction;
  sửa số tiền thì sửa luôn giao dịch nạp cũ, đổi quỹ thì chuyển giao dịch sang quỹ mới).
- [x] Lệnh chuyển (`/fund/orders`, tạo / sửa `/fund/orders/new|:id`): soạn sẵn các lệnh **chuyển** (từ quỹ A sang quỹ B), **rút** (từ quỹ nào),
  **nạp** (vào quỹ nào) kèm số tiền. Lệnh chỉ được chạy ở bước 3 của màn hình Thực thi. Quỹ trong lệnh bị xoá thì lệnh báo "Quỹ đã bị xoá" và không chạy được.
  **Số thứ tự** (`position`): mỗi lệnh có 1 số, **luôn liên tục 1..n và không trùng**; đổi số của 1 lệnh (ô "Số thứ tự" trong form: ô nhập số hẹp `NumberField`, ô số tiền rộng bên cạnh) hoặc thêm / xoá
  thì **đánh số lại mọi lệnh** cùng 1 batch (vd 7 lệnh, đổi lệnh 4 thành lệnh 2 thì lệnh 2, 3 cũ thành 3, 4). Ở danh sách **kéo tay cầm ≡** bên trái lệnh
  lên / xuống để sắp xếp lại (`reorderOrders`; vùng danh sách có `data-no-swipe`). Lệnh cũ chưa có số thì xếp theo lúc tạo.
  Ô check **"Chuyển / Rút toàn bộ số dư"** (`allBalance`, chỉ cho lệnh chuyển / rút): không cần nhập số tiền, lúc chạy lấy hết số dư của quỹ nguồn
  tại lượt của lệnh đó (quỹ đang 0 đồng thì không ghi giao dịch, vẫn đánh dấu đã chạy).
- [x] Thực thi (`/fund/execute`): chia **theo tháng** (thanh ‹ Tháng › ở trên), gồm 3 bước (chọn bằng `Segmented`, mặc định mở bước đầu tiên chưa xong):
  1. **Lương**: mỗi thành viên nhập **lương thực lãnh** của mình (cả gia đình xem được, Rules chỉ cho sửa lương của mình); lưu là tự nạp vào quỹ nhận lương.
     Người **không có lương** (chưa đặt ngày nhận lương) hiện "Không có lương" và không cần nhập; bước 1 xong khi mọi người có lương đã nhập.
     Đã tổng kết thì không sửa được lương đã nhập.
  2. **Tổng kết**: tổng lương + số người đã nhập; 1 thành viên bấm FAB check để **xác nhận đã tổng kết** (ghi tên + thời điểm).
     **Tổng kết lưu lại số dư của mọi quỹ tại thời điểm đó** (`balances`, `total` trong `fundRuns/{tháng}`, đọc mới từ server) cho màn hình Thống kê.
     Huỷ được nếu chưa chạy lệnh nào (huỷ thì xoá số dư đã lưu).
  3. **Chạy lệnh**: chỉ mở sau khi đã tổng kết. Liệt kê các lệnh chuyển, **mặc định chọn sẵn** mọi lệnh chưa chạy, chạm để bỏ chọn (bỏ qua).
     **Mỗi lệnh chỉ chạy 1 lần mỗi tháng** (đã chạy thì hiện "Đã chạy …" và khoá). Chạy trong 1 Firestore transaction (`executeOrders`),
     **tuần tự theo số thứ tự** (lệnh sau thấy số dư đã đổi bởi lệnh trước): kiểm tra lệnh chưa chạy, tính số dư lần lượt — quỹ không đủ tiền thì báo lỗi và **không lệnh nào được chạy**; ghi giao dịch (có `orderId`, `runId`) + số dư + đánh dấu đã chạy cùng lúc.
- [x] Tra cứu quỹ (`/fund/history`): lịch sử nạp / rút / chuyển / lãi, lọc theo quỹ và loại.
  **Trượt thẻ giao dịch sang TRÁI** hiện nút thùng rác ở bên phải (chạm 1 lần thành "Xoá?", chạm lần nữa mới xoá) để xoá giao dịch nạp / rút / chuyển nhập sai
  (`deleteTransaction` trong `data/api.ts`, 1 transaction): **không xoá hẳn** mà đánh dấu `deleted` và **hoàn lại số dư** các quỹ như trước giao dịch;
  chuyển quỹ thì xoá cả cặp chuyển đi / nhận về (`pairId`, dữ liệu cũ thì tìm theo ngày giờ + số tiền); hoàn lại làm quỹ âm thì báo lỗi.
  Không xoá được tiền lãi và giao dịch nạp lương thực lãnh (sửa ở Thực thi). **Giao dịch đã bị TỔNG KẾT không xoá được nữa**: tháng của giao dịch
  đã tổng kết và giao dịch được ghi (`createdAt`) trước lúc tổng kết (`lockedBySummary`) → thẻ khoá trượt, dòng phụ ghi "Đã tổng kết";
  `deleteTransaction` cũng đọc lại đợt tổng kết trong transaction để chặn. Giao dịch ghi sau lúc tổng kết (vd chạy lệnh ở bước 3) vẫn xoá được. Giao dịch đã xoá vẫn hiện với **nền xám**, không tính vào tổng;
  **trượt thẻ xám sang trái** thì mở màn hình nạp / rút / chuyển với giá trị điền sẵn (`?fund=&to=&amount=&note=&date=`), lưu sẽ tạo **giao dịch mới**.
  **Giao dịch rút theo hoá đơn** (có `items`, từ Đọc hoá đơn) được **đánh dấu**: huy hiệu 🧾 nhỏ ở góc icon + nhãn "n sản phẩm ›" cạnh tên quỹ;
  **chạm thẻ** (không phải trượt) mở khung **`ReceiptItemsPopup`** (`src/pages/fund/ReceiptItems.tsx`, dùng chung với Đọc hoá đơn): tên hoá đơn, ngày · quỹ · người rút,
  từng sản phẩm (STT, tên tối đa 2 dòng, SL, thành tiền) và tổng (lệch số đã rút thì ghi thêm "đã rút …").
- [x] Thống kê (`/fund/stats`): số dư các quỹ **theo tháng**, lấy từ số liệu lưu lúc tổng kết. 2 tab (`Segmented`):
  **Theo tháng** (‹ Tháng ›, tổng số dư + thay đổi so với tháng trước, bảng số dư từng quỹ + chênh lệch) và
  **Biểu đồ năm** (‹ Năm ›, biểu đồ đường 12 tháng `FundLineChart`, SVG tự vẽ). Biểu đồ **chỉ vẽ đường của quỹ được chạm chọn** ở lưới bên dưới
  (có thêm "Tổng số dư"), tối đa 8 đường; màu lấy từ bảng 8 màu `SERIES_COLORS` (đã kiểm tra mù màu trên nền tối), gắn theo quỹ lúc chọn và giữ nguyên khi chọn / bỏ đường khác.
  Tháng chưa tổng kết thì đường bị ngắt. Chạm / kéo trên biểu đồ hiện vạch dọc + khung số liệu của tháng đó (vùng biểu đồ có `data-no-swipe`).
- Ô **Số thứ tự** (Lệnh chuyển, Nhóm quỹ) là ô nhập số `NumberField` (`src/components/ui/NumberField.tsx`): gõ lớn hơn tổng số mục
  (tính cả mục đang thêm) thì tự đưa về số đó, để trống thì về 1. **Tạo mới mặc định = tổng số mục tính cả mục đang thêm** (đứng cuối);
  sửa thì giữ số hiện tại của mục.
- [x] Cài đặt của app Quỹ (`/fund/settings`)

Dữ liệu Firestore (xem `src/pages/fund/data/api.ts`), thuộc gia đình đang chọn:
- `families/{familyId}/funds/{fundId}`: nhóm quỹ, `balance` là số dư hiện tại (VND, số nguyên), `position` số thứ tự
- `families/{familyId}/transactions/{txId}`: giao dịch `deposit` / `withdraw` / `interest` / `transfer_out` / `transfer_in`, `amount` luôn dương, có `createdByName` (người thực hiện);
  chuyển quỹ có `peerFundId` + `pairId` (id giao dịch còn lại của cặp); đã xoá thì `deleted`, `deletedByName`, `deletedAt`;
  rút theo hoá đơn (Đọc hoá đơn) thì có `receipt` (loại hoá đơn, vd `bhx`) + `items` = các sản phẩm `{ name, qty, amount }`
- `families/{familyId}/fundOrders/{orderId}`: lệnh chuyển (`type` transfer / withdraw / deposit, `fromFundId`, `toFundId`, `amount`, `allBalance`, `position`, `note`), xem `data/orders.ts`
- `families/{familyId}/fundRuns/{YYYY-MM}`: đợt thực thi của tháng (`summarizedBy`, `summarizedByName`, `summarizedAt`, `executed` = map id lệnh -> lúc chạy,
  `balances` = map id quỹ -> { name, icon, balance, transferred } lưu lúc tổng kết, `total` = tổng không tính quỹ đã chuyển đi)
- `families/{familyId}/fundRuns/{YYYY-MM}/salaries/{uid}`: lương thực lãnh (`name`, `amount`, `fundId`, `txId` = giao dịch nạp vào quỹ); cả gia đình đọc, mỗi người chỉ ghi của mình
- `families/{familyId}/salaryInfo/{uid}`: thông tin lương (`payday` 1–31, `fundId` quỹ nhận lương, `createdAt`); cả gia đình đọc, mỗi người chỉ ghi của mình, xem `data/salary.ts`
- `users/{uid}/settings/fund`: cài đặt hiển thị của app Quỹ, RIÊNG từng tài khoản
- Security Rules ở `firestore.rules`

Lãi kép: lãi suất lưu theo %/năm, mỗi tháng cộng `số dư × lãi/12` vào đúng ngày mốc (`interestAnchor` + `interestPeriods` tháng).
Lãi được cộng phía client khi mở app (`applyDueInterest`, chạy trong Firestore transaction để không cộng trùng).

### App Trạng thái (`/status`)
Biết mọi người đang ở đâu: tạo các địa điểm (mỗi địa điểm là 1 mô hình 3D), xếp lên bản đồ mini dạng bàn cờ,
rồi gắn tag người dùng lên mô hình theo vị trí GPS.
- [x] Bước 1 - Địa điểm (`/status/places`): chọn loại (8 mô hình 3D; ô chọn là hàng ngang phân trang `PagedRow` **4 loại / trang, chỉ hiện icon** (tên loại hiện ở khung xem trước), mở sẵn trang chứa loại đang chọn), tên, tọa độ (dán từ Google Maps hoặc lấy vị trí hiện tại), ghi chú
- [x] Bước 2 - Bản đồ mini (`/status/map`): dạng **thành phố mini** (nền cỏ một màu, cây quanh mép, **không** tô màu kiểu bàn cờ),
  camera xoay / phóng to / dịch chuyển được (OrbitControls). Bên dưới chia lưới **16×16 ô** (`BOARD_SIZE`) để đặt mô hình, lưới chỉ hiện mờ khi đang kéo.
  **Kích thước chiếm ô** (`data/layout.ts`): chợ, công ty, siêu thị, bệnh viện chiếm **2×2 ô** và vẽ to gấp đôi (cao hơn);
  nhà ở, trạm xe điện, trạm xe buýt, quán ăn chiếm 1 ô. `cell` là ô góc trên-trái của vùng mô hình chiếm.
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
- 8 mô hình 3D (nhà ở, chợ, công ty, trạm xe điện, trạm xe buýt, siêu thị, bệnh viện, quán ăn) **dựng bằng code** (low-poly) trong
  `src/pages/status/models/PlaceModels.tsx`, dùng three.js + @react-three/fiber. Thư viện 3D chỉ tải khi mở màn hình cần (lazy).

Dữ liệu Firestore (xem `src/pages/status/data/api.ts`), thuộc gia đình đang chọn:
- `families/{familyId}/places/{placeId}`: địa điểm (`type`, `name`, `lat`, `lng`, `note`, `cell` = ô trên bàn cờ hoặc null)
- `families/{familyId}/presence/{uid}`: thành viên đang ở đâu (`name`, `placeId`, `since`), **không có toạ độ**; thành viên xem được, mỗi người chỉ sửa được của mình

### App Chăm con (`/baby`)
Ghi lại hoạt động hằng ngày của bé theo time line. **Mỗi gia đình có nhiều con; time line và thống kê đi theo TỪNG CON.**
- [x] Con (`/baby/children`, thêm / sửa `/baby/children/new|:id`): danh sách các con (avatar, tên, giới tính, tuổi, ngày sinh); thông tin con gồm
  **tên, nickname (không bắt buộc, ô nhập ngay dưới tên; hiện "Tên (nickname)" ở danh sách), ngày sinh, giờ sinh (không bắt buộc), giới tính, avatar**.
  **Avatar luôn hiển thị HÌNH TRÒN** (`ChildAvatar`, xem quy ước mục 13), kể cả ngay sau khi vừa chọn ảnh trong form.
  Form không có lưới chọn avatar: **chạm vào avatar tròn ở đầu form để chọn / đổi ảnh** (thư viện / chụp); **chưa có ảnh thì hiện hình camera**; có nút "Bỏ ảnh".
  **Ảnh không dùng Firebase Storage**: cắt vuông ở giữa + thu nhỏ 256px JPEG ngay trên máy (`fileToSquareDataUrl` trong `src/lib/image.ts`, ~20–40KB)
  rồi lưu thẳng vào trường `photo` (data URL) của con. Con chưa có ảnh thì hiện khối tròn màu theo giới tính + icon 3D (`avatar`, mặc định 👶).
  Xoá con không xoá hoạt động đã ghi (chỉ không còn hiện).
- **Chọn con** ở Time line và Thống kê bằng `ChildPicker` **nằm trên thanh tiêu đề** (`AppHeader right`): chỉ hiện **avatar tròn** của con đang chọn;
  chạm avatar mở **popup** lưới avatar tròn các con (kèm nickname / tên, con đang chọn có viền trắng), **ô cuối là "+"** để thêm con.
  Popup vẽ bằng `createPortal` ra `document.body` (không nằm trong GlassPanel) và có `data-no-swipe`. Gia đình 1 con thì đã chọn sẵn. Con đang chọn nằm trong `BabyContext` (`child`, `selectChild`), nhớ theo gia đình (localStorage `baby-child:{familyId}`).
  `useDayEntries` chỉ trả hoạt động của con đang chọn; **hoạt động cũ chưa gắn con (`childId` = null) tính là của con đầu tiên**
  (sửa lại thì gắn luôn vào con đang chọn). Chưa thêm con nào thì time line vẫn dùng được (hoạt động có `childId` = null).
- [x] Thẻ hoạt động (`/baby/cards`): tên thẻ, màu, icon (bắt buộc có **ăn 🍼, ngủ 😴, chơi 🧸, đi vệ sinh 🚽**, thêm vài icon khác), thời gian mặc định (phút)
- [x] Time line (`/baby/timeline`): chọn ngày; danh sách **thẻ CAO BẰNG NHAU** (`CARD_PX`, không theo tỉ lệ thời gian, **không có cột giờ**) xếp theo giờ bắt đầu
  (`TimelineView.tsx`, tính toán ở `data/timeline.ts`, `layout`). Thẻ **chồng giờ với thẻ trước thì vẽ ĐÈ lên thẻ đó**, lệch xuống theo tỉ lệ
  (bắt đầu giữa thẻ trước = đè nửa dưới; cùng giờ bắt đầu = đè trọn); không chồng thì nằm dưới, cách `GAP_PX`.
  Thẻ chưa kết thúc: đuôi nét đứt; khi tính chồng nhau thì đang diễn ra tính tới bây giờ, sắp bắt đầu tính tạm 30 phút.
  **Các hoạt động ĐƯỢC CHỒNG THỜI GIAN lên nhau, nhưng chỉ tạo ra bằng 2 cách** (nhập / chèn / sửa giờ trong khung nhập vẫn nối liền như dưới đây):
  1. **Nhấn giữ ~0.5 giây rồi kéo thẻ**: thẻ đi theo ngón tay, **kéo lên hay xuống đều DỜI CẢ THẺ** (giữ số phút; chưa có giờ kết thúc thì vẫn chưa có),
     không đẩy các thẻ khác — **thả đè lên thẻ khác = chồng giờ, kéo ra lại = hết chồng**. Giờ bắt đầu **tính theo chỗ thả so với các thẻ khác** (`timeAt` / `dragTiming`:
     đầu thẻ = giờ bắt đầu, đáy thẻ = giờ kết thúc, nội suy ở giữa; trên thẻ đầu / dưới thẻ cuối thì 1 chiều cao thẻ = 30 phút), bước 5 phút, trong ngày đang xem;
     lưu bằng `updateEntry` không có `linked`. Trong lúc kéo, **bóng giờ (giờ bắt đầu–kết thúc sẽ lưu) hiện trên đầu thẻ**; gần mép trên / dưới thì tự cuộn.
     Nhấn giữ vào **nhãn** để kéo đúng thẻ nằm dưới khi 2 thẻ trùng nhau.
  2. **Trượt thẻ sang TRÁI hiện nút nhân bản** (`LineIcon` `copy`): chạm → chọn thẻ ở khay (có dòng nhắc + nút Huỷ) → khung nhập điền sẵn **cùng giờ bắt đầu / kết thúc**
     với thẻ gốc (sửa được), lưu thì **không đẩy hoạt động liền kề** (`Sheet.overlap`).
  **Phần giao nhau tô màu trộn** của các thẻ (nhân màu như pha màu vẽ: vàng + xanh dương ra xanh lá, 2 màu giống nhau thì đậm hơn; `mixedBackground`,
  bảng mã màu `PALETTE` — thêm màu thẻ mới vào `CARD_COLORS` thì thêm mã RGB vào `PALETTE`). Nhãn (icon, tên, giờ) ở đầu thẻ, các thẻ bắt đầu gần nhau thì chia làn ngang (giờ xuống dòng 2).
  **Chạm vùng chồng nhau** (kể cả chạm vào nhãn) thì **hiện tag các thẻ đang chồng ở phía trên chỗ chạm**, chạm tag để sửa đúng thẻ đó; chạm vùng chỉ có 1 thẻ thì sửa thẻ đó.
  Vùng time line có `data-no-swipe`, chặn cuộn trang (touchmove không passive) khi đang kéo / trượt thẻ.
  **1 ngày của time line là 00:00 → 24:00**: thêm / sửa / kéo hoạt động mà **kết thúc sau 24:00 thì tách thành 2 thẻ** (`splitAtMidnight` trong `data/api.ts`,
  cùng batch với `createEntry` / `updateEntry`): vd ngày 2 nhập 23:00 → 4:00 thành [ngày 2: 23:00 → 0:00] + [ngày 3: 0:00 → 4:00] (khung nhập báo "tách 1 thẻ sang hôm sau").
  **Hoạt động chưa kết thúc của ngày trước** tự kết thúc lúc 24:00 ngày đó khi mở màn hình Time line / mở lại app (`closeStaleEntries`, truy vấn `end == null`).
  khay thẻ bên dưới, chạm 1 thẻ để mở khung nhập. **Giờ bắt đầu mặc định** dựa vào hoạt động cuối cùng trong danh sách (giờ bắt đầu muộn nhất):
  đã kết thúc thì lấy **giờ kết thúc** của nó; **chưa kết thúc thì lấy giờ hiện tại, và khi lưu sẽ tự kết thúc hoạt động cuối bằng giờ bắt đầu của hoạt động mới**
  (cùng 1 batch); chưa có hoạt động nào thì giờ hiện tại / 7:00. Sửa được.
  **Chèn vào giữa bằng cách nhập giờ bắt đầu** (`linkInsert`, ghi cùng 1 batch trong `createEntry`): hoạt động **liền trước** (bắt đầu trước giờ mới)
  kết thúc đúng giờ bắt đầu mới, hoạt động **liền sau** bắt đầu đúng giờ kết thúc mới (giữ giờ kết thúc của nó); không có hoạt động liền trước thì chèn lên đầu.
  **Chèn hoạt động LỌT HẲN vào trong hoạt động liền trước** (có giờ kết thúc, kết thúc trước lúc hoạt động kia kết thúc) thì **tách hoạt động kia làm 2**:
  phần đầu kết thúc lúc hoạt động mới bắt đầu, phần sau (cùng thẻ, cùng con, thêm trong cùng batch qua `extra` của `createEntry`) bắt đầu lúc hoạt động mới kết thúc
  và giữ giờ kết thúc cũ; hoạt động liền sau giữ nguyên (vd chơi 7–9, ngủ 9–…; chèn bú 8–8:30 → chơi 7–8, bú 8–8:30, chơi 8:30–9, ngủ 9–…).
  Chèn vào giữa mà không check "Đã hoàn thành" thì tự kết thúc lúc hoạt động liền sau bắt đầu.
  **Hoàn tác / Làm lại**: 2 FAB [↶] [↷] (`undo` / `redo`, nền `secondary`) **nổi ngay trên khay thẻ** (`FabGroup bottom={raisedAbove(TRAY_PX)}`, không che khay;
  time line chừa `FAB_ROOM` ở cuối), ẩn khi đang mở khung nhập / đang nhân bản; không có bước nào thì nút mờ. Mọi thao tác ghi hoạt động
  (`createEntry` / `updateEntry` / `deleteEntry`, gồm cả kéo thẻ, chèn tách đôi, tách qua nửa đêm) đi qua `tracked`: chụp dữ liệu các hoạt động bị đụng tới
  **trước / sau** khi ghi (hoạt động mới = null trước đó) rồi đẩy vào lịch sử (`data/history.ts`, trong bộ nhớ, riêng từng gia đình, tối đa 30 bước, chỉ ghi khi có mạng).
  `applyHistory` (1 transaction) đưa các hoạt động về đúng ảnh chụp trước (hoàn tác) / sau (làm lại); **hoạt động đã bị thay đổi sau bước đó** (người khác sửa,
  tự kết thúc lúc 24:00…) thì báo lỗi, không ghi gì và bỏ bước đó. Hoàn tác / làm lại cũng cập nhật thông báo time line của con.
  **Ô giờ bắt đầu / kết thúc dùng `TimeField`** (`src/components/ui/TimeField.tsx`: 2 `<select>` trong suốt phủ nửa giờ / nửa phút), **không dùng `<input type="time">`**
  (trên iOS 15.1 ô giờ gốc có lúc focus mà không bật popup chọn giờ). Kết thúc trùm qua hết hoạt động liền sau thì báo lỗi;
  khi nhập trong khung nhập thì time line nối liền, không tự tạo chồng lên nhau.
  Ô check **"Đã hoàn thành"**: có check mới nhập số phút / kết thúc; không check = hoạt động **đang diễn ra / sắp bắt đầu** (lưu `minutes` = `end` = null),
  trên time line hiện nhãn "Đang diễn ra" / "Sắp bắt đầu". Thêm mới mặc định là chưa hoàn thành.
  thời gian hoạt động mặc định lấy từ thẻ; **giờ kết thúc tự tính = bắt đầu + thời gian**. **Giờ kết thúc cũng sửa được**: sửa kết thúc thì số phút tự tính lại (kết thúc trước giờ bắt đầu = sang hôm sau), sửa bắt đầu thì giữ số phút và dời kết thúc. Chạm hoạt động đã có để sửa / xoá.
  **Sửa hoạt động thì các hoạt động liền kề đổi theo cho time line nối liền, không chồng lên nhau** (`linkNeighbors`, cùng 1 batch trong `updateEntry`):
  đổi giờ bắt đầu thì hoạt động **liền trước** kết thúc đúng giờ bắt đầu mới; đổi giờ kết thúc thì hoạt động **liền sau** bắt đầu đúng giờ kết thúc mới
  (giữ giờ kết thúc của nó, số phút tính lại). Khung sửa báo trước dòng "… kết thúc lúc / bắt đầu lúc …"; dời quá giờ bắt đầu của hoạt động trước
  hoặc quá giờ kết thúc của hoạt động sau thì báo lỗi.
- [x] Thống kê (`/baby/stats`): chọn ngày (thanh chọn ngày dùng chung `DayBar` trong `components.tsx`); 2 ô tổng thời gian / số lần;
  **biểu đồ cột** thời gian theo từng hoạt động (thẻ) trong ngày, xếp giảm dần, màu cột theo màu thẻ, icon thẻ ở trục ngang, chạm cột để xem chi tiết;
  bên dưới là bảng số liệu (số lần, %, thời lượng) chiếm phần còn lại. Cách tính ở `data/stats.ts` (`dayStats`):
  đã hoàn thành = số phút đã ghi; **đang diễn ra = tính tới bây giờ** (ngày đã qua thì tới hết ngày, tự cập nhật mỗi phút); sắp bắt đầu = không tính.
  Mỗi lần hoạt động được tính trọn cho ngày nó bắt đầu.
- [ ] Cài đặt của app Chăm con

Dữ liệu Firestore (xem `src/pages/baby/data/api.ts`), thuộc gia đình đang chọn:
- `families/{familyId}/babyCards/{cardId}`: thẻ hoạt động (`name`, `icon`, `color`, `defaultMinutes`)
- `families/{familyId}/children/{childId}`: con (`name`, `birthDate` "YYYY-MM-DD", `birthTime` "HH:MM" hoặc null, `gender` male / female, `avatar` emoji, `photo` data URL JPEG hoặc null, `nickname` chuỗi, "" = không có)
- `families/{familyId}/babyEntries/{entryId}`: hoạt động (`childId` = của con nào, `cardId`, `start`, `minutes`, `end`, `createdByName`; chưa hoàn thành thì `minutes` / `end` = null) + lưu sẵn `name` / `icon` / `color` của thẻ
  để sửa / xoá thẻ không làm mất lịch sử

### App Ghi chú (`/note`)
Gửi ghi chú cho 1 thành viên trong gia đình hoặc cho chính mình. **Dữ liệu 2 bậc: ghi chú → các thẻ nội dung**,
vd ghi chú "Đi chợ" gồm "Mua cà chua", "Mua cá"; ghi chú "Việc vặt" gồm "Mua pin", "Đi lấy đồ".
Ghi chú có **tên** và **số thứ tự** (ưu tiên giữa các ghi chú của cùng 1 người nhận, liên tục 1..n); **mọi thẻ đã xong = ghi chú hoàn thành** (`noteDone`).
Code: `src/pages/note/` (`components.tsx`: `NoteLayout`, `MemberPicker`, `EditableList`, `TrashButton`, `doneSummary`; dữ liệu ở `data/`).
**Mọi danh sách của app Ghi chú là THẺ TÁCH RỜI giống thẻ Nhóm quỹ** (mỗi thẻ 1 khối glass bo góc có bóng đổ, cách nhau; `LIST_CARD`, `LIST_CARDS_GAP` trong `listStyle.ts`), không đặt chung trong 1 bảng glass;
  **thông tin chung của màn hình (vd "m/n ghi chú đã hoàn thành") là DÒNG PHỤ của thanh tiêu đề** (`AppHeader subtitle`, giống màn hình xem 1 ghi chú),
  không đặt thành 1 khung riêng giữa thanh tiêu đề và danh sách;
  thẻ đang kéo thả phóng to nhẹ (`LIST_CARD_DRAGGING`), thẻ trượt dùng `radius={LIST_CARD_RADIUS}` (quy ước mục 16).
- **Cả Tạo ghi chú và Xem ghi chú đều 2 bước: danh sách ghi chú → chạm 1 ghi chú mới hiện các thẻ nội dung bên trong.**
  Danh sách ghi chú dùng chung `NoteList` (`components.tsx`): kéo ≡ / sửa số để đổi thứ tự (`reorderNotes`), trượt trái để xoá (`deleteNote`).
- [x] Tạo ghi chú, bước 1 (`/note/sent?to=uid`, `NoteSentPage`): danh sách ghi chú **gửi cho người nhận đang chọn**; chọn người nhận bằng `MemberPicker`
  **trên thanh tiêu đề** (giống chọn con ở Time line: avatar tròn, chạm mở popup), **mặc định là bản thân**, lưu trên URL `?to=`;
  dòng phụ dưới tiêu đề = **"m/n ghi chú đã hoàn thành"** (`doneSummary`) của người nhận đang chọn. FAB + mở bước 2 để tạo mới.
- [x] Tạo ghi chú, bước 2 (`/note/sent/new?to=uid` tạo mới, `/note/sent/:id` sửa, `NoteFormPage`): nội dung bên trong 1 ghi chú.
  Dưới thanh tiêu đề là **[số thứ tự `NumberField`] [tên ghi chú]** (cùng kiểu hàng thẻ; tạo mới mặc định = số ghi chú của người nhận + 1, đứng cuối; sửa giữ số hiện tại; tên bắt buộc);
  Dòng phụ dưới tiêu đề = "Gửi cho: …" (sửa thì thêm "· m/n thẻ đã xong"). Lưu xong quay về bước 1. Sửa thì thẻ cũ **giữ trạng thái đã xong** (`updateNote`), thẻ mới chưa xong.
  Danh sách thẻ `EditableList` (thẻ tách rời, cuộn trong vùng danh sách): mỗi thẻ 1 hàng **[≡ kéo lên / xuống] [số thứ tự `NumberField inline`, xem mục 14] [ô nhập nội dung trực tiếp]**;
  số thứ tự = mức độ ưu tiên (sửa số rồi rời ô thì thẻ chuyển tới vị trí đó); **trượt thẻ sang trái** hiện thùng rác (chạm 2 lần mới xoá, giống Tra cứu).
  FAB [+ thêm thẻ] [gửi / lưu]: thẻ mới thêm vào cuối, **số thứ tự = tổng số thẻ tính cả thẻ mới**. **Đang gõ thì gợi ý** ngay dưới thẻ từ các Thẻ ghi chú
  (chứa chữ đang gõ, không phân biệt dấu / hoa thường `foldKey`, theo thứ tự ưu tiên, tối đa 4; chưa gõ thì gợi ý các thẻ đầu; bỏ thẻ đã có trong ghi chú).
  Gửi / lưu: bỏ thẻ trống / trùng, ghi chú (chèn đúng số thứ tự, đánh số lại các ghi chú khác của người nhận) + **thẻ có nội dung mới được lưu vào Thẻ ghi chú** (thêm cuối danh sách) cùng 1 batch (`createNote` / `updateNote`).
- [x] Thẻ ghi chú (`/note/cards`): quản lý thẻ đã từng nhập, **giao diện giống Tạo ghi chú** (`EditableList`); sửa nội dung trực tiếp, **rời ô là lưu**;
  thêm / kéo thả / sửa số / xoá đều đánh số lại cả danh sách. **Không lưu thẻ trùng nội dung** (`sameKey`: bỏ khoảng trắng thừa, không phân biệt hoa thường).
  **Thứ tự ở đây = thứ tự ưu tiên trong danh sách gợi ý** ở Tạo ghi chú.
- [x] Xem ghi chú (bước 1 `/note/inbox`, bước 2 `/note/inbox/:id`): danh sách ghi chú **gửi đến mình theo số thứ tự** (`NoteList`), dòng phụ dưới tiêu đề = **"m/n ghi chú đã hoàn thành"** (`doneSummary`, giống Tạo ghi chú); **thao tác giống thẻ nội dung**:
  kéo ≡ / sửa số để đổi thứ tự, trượt trái hiện thùng rác để xoá (đánh số lại); mỗi dòng hiện tên, các thẻ, số thẻ đã xong / tổng
  hoặc "Xong" (gạch ngang tên) khi ghi chú hoàn thành. Ghi chú cũ chưa có tên thì hiện nội dung các thẻ, chưa có số thì xếp sau.
  Chi tiết: thanh tiêu đề = tên ghi chú, **dòng phụ ngay dưới tiêu đề** (`AppHeader subtitle`) = người gửi / "Bạn tự ghi" · giờ ngày · số thẻ đã xong (hoặc "Đã hoàn thành").
  Các thẻ theo thứ tự ưu tiên; **chạm ô vuông bên phải để đánh dấu đã làm xong** / bỏ đánh dấu (`setItemDone`, transaction, lưu tên người đánh dấu).
  **Nạp / rút quỹ gắn với TỪNG THẺ, không phải cả ghi chú**: chạm phần nội dung của thẻ để mở ô nạp / rút ngay dưới thẻ đó (mỗi lần 1 thẻ;
  `Segmented` Rút / Nạp, chọn quỹ, `MoneyField`, FAB check lưu — FAB chỉ hiện khi có thẻ đang mở); **quỹ chọn sẵn = quỹ mặc định trong Cài đặt**,
  **ghi chú của giao dịch = "Tên ghi chú: nội dung thẻ"** (`itemMemo`, vd "Đi chợ: Mua cà chua"). `addItemMoney` (1 transaction): ghi giao dịch ở app Quỹ
  (có `noteId`, `noteItemId`), cập nhật số dư (rút quá số dư thì báo lỗi), thêm lần nạp / rút vào `money` của thẻ. Dòng phụ của thẻ hiện tổng đã nạp / rút,
  ô đang mở liệt kê từng lần. Danh sách quỹ dùng `useFundList` (chung nhớ tạm với app Quỹ).
  **Người nhận thêm được nội dung mới** ngay ở đây (vd phát sinh khoản nạp / rút chưa có trong ghi chú): FAB [+] (có thẻ đang mở nạp / rút thì
  FAB là [+] [lưu]) → thẻ nhập mới ở cuối danh sách, FAB thành [huỷ] [lưu]; lưu bằng `addNoteItem` (transaction: thêm cuối `items`, trùng nội dung thì báo lỗi,
  cập nhật thông báo "Hoàn thành" → "Chưa xong", nội dung mới lưu vào Thẻ ghi chú) rồi **mở luôn ô nạp / rút của thẻ vừa thêm**.
  **Bước 1 có 2 tab** (`Segmented` dưới tiêu đề, lưu trên URL `?tab=sent`): **"Gửi cho mình"** (như trên) và **"Mình đã gửi"** = ghi chú mình gửi cho
  **thành viên khác** (`sent` trong `NoteContext`, `useNotesFrom`: `fromUid` = mình, bỏ ghi chú tự ghi; mới nhất trước), danh sách `SentNoteList`
  **chỉ xem** (avatar người nhận, "Gửi cho …", số thẻ đã xong; không kéo / không xoá — sửa / xoá ở Tạo ghi chú). Chạm mở `/note/inbox/:id?tab=sent`:
  màn hình chi tiết ở chế độ **`readOnly`**: thấy thẻ nào đã xong (ai đánh dấu) và các lần nạp / rút quỹ (chạm nội dung để xem danh sách),
  nhưng **không đánh dấu xong / nạp / rút được** (ô vuông khoá, không có FAB). Ghi chú gửi đến mình vẫn xử lý như cũ.
- [x] Cài đặt (`/note/settings`): **quỹ mặc định** khi nạp / rút ở Xem ghi chú, chọn là lưu ngay.

Dữ liệu Firestore (xem `src/pages/note/data/api.ts`), thuộc gia đình đang chọn:
- `families/{familyId}/notes/{noteId}`: ghi chú (`name`, `position` = số thứ tự trong các ghi chú của người nhận, `toUid`, `toName`, `fromUid`, `fromName`, `createdAt`, `items` = mảng thẻ theo thứ tự ưu tiên `{ id, text, done, doneByName, money }`;
  `money` = các lần nạp / rút của riêng thẻ `{ type, amount, fundId, fundName, txId, byName, at }`)
- `families/{familyId}/noteCards/{cardId}`: thẻ ghi chú đã từng nhập (`text`, `position` 1..n = thứ tự ưu tiên gợi ý), không trùng nội dung
- `users/{uid}/settings/note`: `{ defaultFundId }`, RIÊNG từng tài khoản

## Cấu trúc code
- `src/components/ui/sizes.ts`: kích thước dùng chung giữa giao diện thật và skeleton
- Mỗi app con nằm trong thư mục riêng `src/pages/<app>/`, trang con dùng `AppHeader` (có nút quay lại; `subtitle` = dòng phụ nhỏ dưới tiêu đề, không làm thanh cao thêm)
- Thêm màn hình mới mở trực tiếp từ trang chính của app con (không phải Cài đặt) thì thêm 1 dòng vào `SHORTCUTS` (`src/shortcuts.ts`) để tạo được phím tắt ở màn hình chính
- Dữ liệu của app con nằm trong `src/pages/<app>/data/` (types, api, Context dùng chung cho các trang của app)
- Mỗi trang export cả component thật và `XxxSkeleton` trong cùng file; `App.tsx` hiển thị skeleton khi đang loading
- Thao tác dùng chung: **kéo thả sắp xếp** danh sách dọc bằng tay cầm ≡ → `useDragReorder` (`src/components/useDragReorder.ts`);
  **trượt thẻ sang trái hiện nút** → `SwipeActions` (`src/components/ui/SwipeActions.tsx`, icon trên nút dùng `LineIcon`, không dùng 3D).
  Thẻ glass thì nền nút **lấn sang phía thẻ, nằm dưới thẻ** (`overlap`, xem quy ước mục 16); **thẻ bo góc** (vd thẻ Nhóm quỹ `rounded-2xl`)
  thì truyền thêm `radius` = độ bo góc (px, vd 16) để khung ngoài bo tròn khớp thẻ và 2 góc bo bên phải cũng có màu nút (không bị hở góc).
  Khi thả tay, **nền nút đổi bề rộng CÙNG chuyển động với thẻ** (`MOTION` trong `SwipeActions.tsx`: cùng thời gian + đường cong), vùng nút luôn có mặt (rộng 0 khi đóng)
  để kéo mạnh rồi thả / đóng lại không hở mép nền nút; nội dung nút vẽ lại mỗi lần mở (trạng thái "Xoá?" không bị giữ lại). Sửa chuyển động của thẻ thì sửa cả vùng nút.
  Vùng có các thao tác này phải gắn `data-no-swipe` để không bị nhầm thành vuốt sang màn hình 2 bên.
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

- **Chỉ hiện skeleton khi trang CHƯA CÓ dữ liệu.** Dữ liệu realtime phải đọc qua `useLiveQuery` (`src/lib/liveQuery.ts`, khoá theo gia đình `familyKey(...)`):
  dữ liệu được nhớ tạm trong lúc mở app, nên mở lại màn hình / vuốt qua lại giữa màn hình chính và màn hình 2 bên thì hiện ngay dữ liệu cũ,
  **không chớp skeleton**; trong lúc chờ dữ liệu mới từ server thì hiện **vòng xoay nhỏ ở góc trái dưới** (`RefreshIndicator`, gắn sẵn trong `App.tsx`).
  Thêm truy vấn realtime mới thì dùng `useLiveQuery` thay vì tự `useState` + `onSnapshot`.

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
- **Trang không được cuộn, không xuất hiện thanh cuộn.** Khung trang (`PageShell`, `AuthLayout`) cao đúng màn hình (`h-full`, theo `html`/`body`/`#root` 100%) và `overflow-hidden`.
  **Không dùng đơn vị `dvh` / `svh` / `lvh`** (iOS 15.1 chưa hỗ trợ: khung mất chiều cao, danh sách không cuộn được); cần theo màn hình thì dùng `h-full` hoặc `vh`.
  **Mở từ màn hình chính iPhone (standalone)**: iOS 17–18 tính `100%` thiếu đúng bằng vùng tai thỏ (dải đen ở đáy) → `index.css` dùng
  `@media (display-mode: standalone) { height: max(100%, 100vh) }` cho `html`/`body`/`#root`, `html` có nền tím; JS cần chiều cao màn hình thì lấy
  `Math.max(innerHeight, documentElement.clientHeight)` (vd `viewH` trong `NotificationBubble.tsx`), không dùng riêng `innerHeight`.
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
- Giá trị tối đa **99 tỷ** (`MAX_MONEY`): nhập vượt quá thì tự đưa về 99 tỷ ngay trong onChange.
- **Bên dưới ô luôn hiện số tiền bằng chữ** (`moneyToWords` trong `src/lib/format.ts`, vd "Một triệu năm trăm nghìn đồng"), dòng cao cố định 2 dòng.
  Skeleton của ô tiền phải dùng **`MoneyFieldSkeleton`** (không dùng `TextFieldSkeleton`) để cao bằng ô thật.

### 9. Icon dạng 3D ảnh
- **Mọi icon trong app phải hiển thị dạng 3D ảnh**: dùng component `Icon3D` (`src/components/ui/Icon3D.tsx`) với emoji tương ứng, vd `<Icon3D emoji="💰" className="h-8 w-8" />`. Không hiển thị emoji dạng chữ, không dùng icon SVG phẳng.
- Ảnh lấy từ bộ **Microsoft Fluent Emoji 3D** (giấy phép MIT), **đã tải về `public/icons3d/`** (tên file = mã Unicode, bỏ FE0F). App không tải ảnh từ mạng ngoài.
- **Khi dùng emoji mới**: thêm emoji vào danh sách `EMOJIS` trong `scripts/fetch-icons3d.mjs` rồi chạy `npm run icons3d` để tải ảnh về. Nếu emoji không có bản 3D, script sẽ báo và `Icon3D` tự hiện emoji thường.
- Icon nằm trên nền màu (icon app, icon quỹ, huy hiệu...) thì đặt trong **khối nổi 3D**: `BLOCK_3D` + lớp bóng loáng `GLOSS_3D` (`src/components/ui/style3d.ts`). Ô chọn dạng kính dùng `TILE_3D` / `TILE_3D_SELECTED`.
- Góc nhìn: thẳng từ trên xuống (không nghiêng xéo).
- Ngoại lệ: chữ trong `<option>` của ô chọn gốc (native select) không hiển thị được ảnh, giữ emoji dạng chữ. Các ký hiệu điều khiển nhỏ (mũi tên quay lại ‹, mũi tên ▾ của ô chọn) không tính là icon.
- **Ngoại lệ: icon trên nút nổi (FAB) KHÔNG dùng 3D**, xem mục 10.
- **Ngoại lệ: icon trong sự kiện TRƯỢT THẺ** (nút hiện ra khi trượt thẻ trong danh sách, vd thùng rác / nhập lại ở Tra cứu) **KHÔNG dùng 3D**:
  dùng icon nét trắng đơn giản giống FAB (`LineIcon` trong `src/components/ui/Fab.tsx`, cùng bộ `ICON_PATHS`; thiếu icon thì vẽ thêm vào `ICON_PATHS`).

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
  Cần cố định số mục mỗi trang thì truyền `perPage` (vd chọn loại địa điểm 4 mục / trang); `startIndex` để mở sẵn trang chứa mục đang chọn.
- **Mỗi trang phải hiện trọn vẹn thông tin, không cắt xén**: số mục mỗi trang tự tính theo bề rộng màn hình và `itemWidth`
  (bề rộng tối thiểu để 1 mục hiện đủ), nên không có mục nào bị cắt ở mép. Tên dài thì xuống dòng (tối đa 2–3 dòng, chữ nhỏ lại nếu cần) để đọc được trọn vẹn.
- **Bên trái và bên phải có nút hình tam giác** để chuyển trang trước / sau; hết trang thì nút mờ đi.
- Nếu hàng nằm dưới nút nổi (FAB) thì chừa chỗ bên phải (`className="pr-..."`) để nút tam giác không bị FAB che.
- Không áp dụng cho nhóm nút chọn cố định dạng lưới (`Segmented`, lưới chọn icon / màu): các hàng này vừa khít màn hình, không cuộn.
### 12. Ô nhập số phút
- **Mọi ô nhập số phút phải dùng `MinutesField`** (`src/components/ui/MinutesField.tsx`), không tự viết bằng `TextField`.
- Bên phải ô có **2 nút tam giác lên / xuống** (bằng nhau, xếp dọc): bấm lên **tăng 5 phút**, bấm xuống **giảm 5 phút**; vẫn gõ số trực tiếp được.
- Giới hạn bằng `min` / `max` (mặc định 1 phút đến 24 giờ); hết giới hạn thì nút tương ứng mờ đi.### 13. Avatar (người, con...)
- **Mọi avatar trong app đều hiển thị trong KHUNG TRÒN** (`rounded-full`), ở mọi nơi: danh sách, form, thanh tiêu đề, popup chọn, kể cả ngay sau khi vừa chọn ảnh. Không bao giờ hiện nguyên ảnh vuông.
- Ảnh thật: khung `block` / `flex` (**không để `span` inline**, vì inline bỏ qua `h-*` / `w-*` làm ảnh hiện nguyên hình vuông) + `overflow-hidden rounded-full`;
  thẻ `<img>` thêm `block h-full w-full rounded-full object-cover` để cắt tròn chắc chắn cả trên iOS cũ.
- Chưa có ảnh: khối tròn màu nổi 3D (`BLOCK_3D` + `GLOSS_3D` có `rounded-full`) với icon 3D bên trong; ô "chọn ảnh" / "thêm" cũng là hình tròn (viền nét đứt).
- Skeleton của avatar cũng là `rounded-full`, cùng kích thước với avatar thật.
- Dùng lại component có sẵn (vd `ChildAvatar` trong `src/pages/baby/components.tsx`) thay vì tự viết lại.

### 14. Ô số (số thứ tự…) nằm trên thẻ nhập trực tiếp
- Thẻ / hàng trong danh sách cho **nhập dữ liệu trực tiếp** mà có ô số (vd số thứ tự của thẻ nội dung, của ghi chú ở app Ghi chú):
  **chưa nhấn vào thì hiển thị như 1 con số bình thường trên thẻ** (không khung viền, không nền ô nhập, chữ đậm ở giữa);
  **nhấn vào để nhập thì mới hiện khung viền / nền** của ô nhập.
- Dùng `NumberField` với **`inline`** (`INLINE_FIELD` trong `src/components/ui/NumberField.tsx`: `not-focus:border-transparent not-focus:bg-transparent`),
  không tự viết lại. Skeleton của ô này là 1 con số nhỏ (khối nhỏ ở giữa), không phải khối ô nhập.
- Không áp dụng cho ô số trong form Tạo / Sửa (vd "Số thứ tự" ở form Lệnh chuyển, Nhóm quỹ, tên + số của ghi chú): các ô đó vẫn hiện khung như ô nhập thường.

### 15. Màu nền trong bảng / danh sách: kiểu glass gradient, không dùng màu đặc
- **Header của bảng** (tiêu đề dính trên đầu bảng khi cuộn) và **thẻ / hàng trong bảng** dùng nền **glass gradient giống các thẻ nổi khác**,
  **không dùng nền màu đặc** (vd `bg-[#2a2766]`, `bg-indigo-950/70`).
- Dùng các class dùng chung trong `src/components/ui/listStyle.ts`, không tự viết lại:
  - `LIST_HEADER`: header dính (`bg-white/10` + `backdrop-blur-xl`, nội dung cuộn bên dưới bị làm mờ; thêm `px-*` theo lề của bảng). Skeleton của header cũng có `bg-white/10`.
  - `LIST_ROW_BG`: thẻ / hàng trong suốt để hiện nền glass của bảng. Thẻ có trượt (`SwipeActions`) cũng dùng nền này
    (`SwipeActions` chỉ vẽ vùng nút đúng bằng phần thẻ đã trượt ra nên không cần nền đặc để che nút phía sau).
  - `LIST_DRAGGING`: hàng đang kéo thả (`useDragReorder`), nền glass sáng hơn + viền mảnh + bóng đổ để nổi lên.
- **Ngoại lệ: màn hình Tra cứu của app Quỹ** (`/fund/history`): dòng giao dịch có 2 màu nền (thường / đã xoá màu xám) nên giữ nền đặc như hiện tại.

### 16. Thẻ glass trượt sang trái: nền nút lấn sang phía thẻ, nằm dưới thẻ
- Danh sách có **thẻ nền gradient glass** mà thẻ **trượt sang trái để hiện nút chức năng** (`SwipeActions`): **nền của nút phải lấn sang phía thẻ 1 chút
  và nằm DƯỚI thẻ** (thẻ vẽ đè lên), không để nền nút bắt đầu đúng ở mép phải thẻ.
- Cách làm: truyền **`overlap={SWIPE_OVERLAP}`** (16px, `src/components/ui/listStyle.ts`) cho `SwipeActions`; nút trong `actions` thêm lề trái
  **`SWIPE_OVERLAP_PAD`** (`pl-4`) để icon / chữ nằm giữa phần lộ ra. Thẻ **bo góc** thì truyền `radius` = độ bo góc
  (`overlap` mặc định bằng `radius`, khung ngoài bo tròn khớp thẻ) để 2 góc bo bên phải của thẻ cũng có màu nút.
- Đang áp dụng: Nhóm quỹ (`radius={16}`), các danh sách thẻ của app Ghi chú (`EditableList`, `NoteList`, `radius={LIST_CARD_RADIUS}`).
- Không áp dụng cho thẻ nền đặc (vd Tra cứu của app Quỹ, ngoại lệ ở mục 15).
