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
- [x] Màn hình chính dạng lưới ô Live Tile kiểu Windows Phone (`/`, xem quy ước mục 5), đăng xuất ở màn hình này. Hàng lời chào: **[avatar của mình] [Xin chào, tên] [nút cây bút]**
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
  **Nhấn giữ** 1 icon (~0.5 giây, `useLongPress`) thì vào chế độ gỡ: icon **đứng yên (không rung)**, phím tắt có nút "−" để gỡ, FAB check để xong;
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
**Dữ liệu Quỹ, Trạng thái, Chăm con, Ghi chú, Vườn mây thuộc về từng GIA ĐÌNH, KHÔNG chia sẻ cho mọi người dùng.**
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
  **Chạm 1 thành viên** trong danh sách (mọi người, kể cả không phải chủ gia đình) → mở **`/profile/:uid`: màn hình Thông tin cá nhân ở chế độ CHỈ XEM**
  (tiêu đề "Thông tin thành viên", ô nhập khoá `readOnly`, `Segmented disabled`, không chọn ảnh, không có FAB lưu; ‹ quay lại Quản lý gia đình). Chạm chính mình thì mở `/profile` (sửa được).
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
  Ảnh được thu nhỏ (cạnh dài ≤ 1800px; đã thử 2400px và phóng to ảnh nhỏ thì đọc KÉM hơn), chuyển xám + kéo giãn tương phản trước khi đọc; rời màn hình thì tắt worker (`stopOcr`).
  **File Tesseract tự host** ở `public/tesseract/` (worker, lõi WASM bản LSTM thường / SIMD, `vie.traineddata.gz` best_int), chép từ `node_modules`
  bằng `scripts/copy-tesseract.mjs` (chạy tự động ở `predev` / `prebuild`, thư mục bị gitignore); **không đưa vào precache** của PWA
  (`globIgnores`), chỉ tải lần đầu mở màn hình (~5MB) rồi lưu bằng runtime cache `CacheFirst`. Thư viện được import động.
  **Không dùng regex lookbehind** trong phần tách dữ liệu (iOS 15.1 lỗi cú pháp). Dấu phân cách hàng nghìn bị đọc nhầm (`55/000`) được sửa ở `fixMoney`.
  **Ô "Loại hoá đơn"** (`RECEIPT_KINDS`, nhớ lựa chọn ở localStorage `receipt-kind`, mặc định **Bách Hoá Xanh**; đổi loại thì tách lại chữ đã đọc, không đọc ảnh lại):
  - **BHX** (`parseBhx`, "PHIẾU THANH TOÁN BÁCH HÓA XANH"): bảng từ dòng tiêu đề "SL / Giá bán / Thành tiền" tới dòng "Phải thanh toán";
    mỗi sản phẩm = dòng tên (có thể nhiều dòng) + dòng số liệu "SL … thành tiền"; **chỉ lấy tên, SL (lẻ được, "0,274") và thành tiền**, bỏ cột giá bán.
    **Số tiền rút = "Phải thanh toán"** (không đọc được thì = tổng thành tiền). Màn hình hiện "n sản phẩm · tổng · khớp / lệch" và "Xem sản phẩm".
  - **KiotViet** (`parseKiotViet`, "Powered by KiotViet"): bảng "Tên hàng / Đ.Giá / SL / Thành tiền" tới dòng tổng; mỗi sản phẩm 1 dòng "tên đơn giá x SL thành tiền" (lấy tên, SL, thành tiền).
    **Số tiền rút = "Tổng Cộng"** (không đọc được thì "Tổng tiền hàng" / tổng thành tiền); ghi chú theo tên cửa hàng ở dòng đầu hoá đơn.
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
  **Ô giờ bắt đầu / kết thúc dùng `TimeField`** (vòng tròn chọn giờ, xem quy ước mục 17), **không dùng `<input type="time">`**
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
- [x] Phát triển (`/baby/growth`, thêm / sửa `/baby/growth/new|:id`, `GrowthPage` / `GrowthFormPage`, dữ liệu `data/growth.ts`): các **thẻ** ghi
  **ngày thực hiện, chiều cao (cm), cân nặng (kg), vắc xin** — **riêng từng con**, chọn con bằng `ChildPicker` trên thanh tiêu đề (giống Time line), thẻ mới thuộc con đang chọn.
  **Ô check "Có tiêm vắc xin"** (không check = hôm đó không tiêm); check thì hiện các khung nhập mũi tiêm (`VaccineFields.tsx`), mỗi mũi gồm
  **Phòng bệnh** (vd Lao, Viêm gan B, 6 in 1; 1 dòng riêng), **Vaccine** (1 dòng riêng) (tên, vd BCG, Hexaxim), **Mũi** (mũi thứ mấy, vd 6 in 1 có 3 mũi), **Nơi tiêm**, **Giá** (`MoneyField`);
  **1 ngày tiêm được NHIỀU mũi** (nút X góc khung để bỏ, "+ Thêm vắc xin"); lưu mảng `vaccines` = `VaccineShot[]` (`cleanShots`: bỏ khung không có phòng bệnh lẫn tên).
  Rời ô Phòng bệnh thì **tự điền mũi thứ mấy** (`nextDose`: đếm mũi cùng bệnh của con trước ngày đó + 1) và tên vaccine / nơi tiêm / giá theo **lần tiêm gần nhất cùng bệnh** (`lastShot`; ô đã có thì giữ).
  Các ô gợi ý những gì cả gia đình đã từng nhập (`datalist`). Thẻ ở danh sách hiện "💉 Lao (BCG) · mũi 1" / "💉 2 mũi: …"; lọc vắc xin thì dòng phụ có tổng số mũi + tổng chi phí; chiều cao / cân nặng để trống = không đo; cần ít nhất 1 trong 3. Số đo gõ được dấu phẩy ("75,5"), cao 20–250 cm, nặng 0,5–200 kg.
  **Tuổi của con vào ngày thực hiện tính theo THÁNG** (`ageAtDate`: "5 ngày tuổi", "8 tháng 12 ngày tuổi", "2 tuổi 3 tháng (27 tháng tuổi)"), hiện trên thẻ và dưới tên con trong form (đổi ngày là tính lại).
  Danh sách mới nhất trước: ngày, số đo, tuổi lúc đó, dòng vắc xin (💉 tên / "💉 n mũi: A, B" / "Không tiêm vắc xin"); dòng phụ đếm số lần ghi + tổng số mũi; chạm thẻ để sửa / xoá (`SaveDeleteFabs`).
  **FAB phễu (`filter`)**: chạm thì **chỉ xem các lần tiêm vắc xin** (nút có viền sáng, dòng phụ "Chỉ xem tiêm vắc xin"),
  chạm lần nữa xem lại toàn bộ. Chưa có con thì hiện nút "Thêm con".
- [x] **Ăn dặm — Thực phẩm** (`/baby/foods`, thêm / sửa `/baby/foods/new|:id`, `FoodsPage` / `FoodFormPage`, dữ liệu `data/foods.ts`): danh sách thực phẩm **đã thử của từng con**
  (chọn con bằng `ChildPicker`): tên, nhóm (`FOOD_GROUPS`), **dễ dị ứng** (tự đánh dấu theo tên có trứng / tôm cua / đậu phộng / sữa / cá… — `looksAllergen`, bỏ được),
  ngày thử lần đầu, **kết quả: Đang thử / Ăn được / Có phản ứng** (+ ghi chú phản ứng; thẻ viền đỏ). **Quy tắc thử món mới 3 ngày** (`TRIAL_DAYS`, `trialInfo`):
  món đang thử hiện "ngày n/3"; còn món trong 3 ngày theo dõi thì khung nhắc trên đầu danh sách "chưa nên cho thử món mới tới hết dd/mm", quá 3 ngày thì nhắc ghi kết quả.
  Xếp: đang thử → có phản ứng → ăn được. Tên trùng (không dấu, không hoa thường `foodKey`) thì báo lỗi.
- [x] **Ăn dặm — chi tiết bữa ăn trên Time line**: thẻ ăn dặm (`isMealCard`: icon 🥣 hoặc tên có "ăn dặm") thì khung nhập có thêm `MealFields` (`MealFields.tsx`):
  **chạm chọn các món** từ danh sách Thực phẩm của con (món có phản ứng viền đỏ, chọn thì cảnh báo đỏ), **gõ món mới + "Thêm"**, **lượng ăn**, **độ thô** (`MEAL_TEXTURES`),
  **con ăn thế nào** (Ăn hết / Ăn được / Ăn ít / Từ chối, chạm lại để bỏ). Thêm món mới khi đang theo dõi món khác thì nhắc quy tắc 3 ngày.
  Lưu vào `meal` của hoạt động (để trống hết = null; kéo / tách thẻ không đụng tới `meal`). Lưu xong, **món mới tự thêm vào danh sách Thực phẩm** (đang thử, thử lần đầu = ngày của bữa ăn, `recordMealFoods`).
  Khung nhập của thẻ ăn dặm cao hơn nên tự cuộn (`max-h-[62vh]`).
- [ ] Cài đặt của app Chăm con

Dữ liệu Firestore (xem `src/pages/baby/data/api.ts`), thuộc gia đình đang chọn:
- `families/{familyId}/babyCards/{cardId}`: thẻ hoạt động (`name`, `icon`, `color`, `defaultMinutes`)
- `families/{familyId}/children/{childId}`: con (`name`, `birthDate` "YYYY-MM-DD", `birthTime` "HH:MM" hoặc null, `gender` male / female, `avatar` emoji, `photo` data URL JPEG hoặc null, `nickname` chuỗi, "" = không có)
- `families/{familyId}/growth/{id}`: thẻ phát triển (`childId`, `date` "YYYY-MM-DD", `height` cm hoặc null, `weight` kg hoặc null, `vaccines` = các mũi tiêm `{ disease, name, dose (số hoặc null), price (VND), place }`, [] = không tiêm, `createdByName`;
  dữ liệu cũ (`vaccines` là mảng tên, hoặc 1 chuỗi `vaccine`) đọc thành mũi chỉ có tên vaccine, sửa lại thì lưu dạng mới)
- `families/{familyId}/babyFoods/{id}`: thực phẩm đã thử (`childId`, `name`, `group`, `allergen`, `firstTried` "YYYY-MM-DD" hoặc null, `status` trying / ok / reaction, `reaction`, `createdByName`)
- `families/{familyId}/babyEntries/{entryId}`: hoạt động (`childId` = của con nào, `meal` = chi tiết bữa ăn dặm `{ foods: string[], amount, texture, rating }` hoặc null, `cardId`, `start`, `minutes`, `end`, `createdByName`; chưa hoàn thành thì `minutes` / `end` = null) + lưu sẵn `name` / `icon` / `color` của thẻ
  để sửa / xoá thẻ không làm mất lịch sử

### App Ghi chú (`/note`)
Gửi ghi chú cho 1 thành viên trong gia đình, cho chính mình, hoặc **cho CẢ GIA ĐÌNH (ghi chú chung)**. **Dữ liệu 2 bậc: ghi chú → các thẻ nội dung**,
vd ghi chú "Đi chợ" gồm "Mua cà chua", "Mua cá"; ghi chú "Việc vặt" gồm "Mua pin", "Đi lấy đồ".
Ghi chú có **tên** và **số thứ tự** (ưu tiên giữa các ghi chú của cùng 1 người nhận, liên tục 1..n); **mọi thẻ đã xong = ghi chú hoàn thành** (`noteDone`).
Code: `src/pages/note/` (`components.tsx`: `NoteLayout`, `MemberPicker`, `EditableList`, `TrashButton`, `doneSummary`; dữ liệu ở `data/`).
**Mọi danh sách của app Ghi chú là THẺ TÁCH RỜI giống thẻ Nhóm quỹ** (mỗi thẻ 1 khối glass bo góc có bóng đổ, cách nhau; `LIST_CARD`, `LIST_CARDS_GAP` trong `listStyle.ts`), không đặt chung trong 1 bảng glass;
  **thông tin chung của màn hình (vd "m/n ghi chú đã hoàn thành") là DÒNG PHỤ của thanh tiêu đề** (`AppHeader subtitle`, giống màn hình xem 1 ghi chú),
  không đặt thành 1 khung riêng giữa thanh tiêu đề và danh sách;
  thẻ đang kéo thả phóng to nhẹ (`LIST_CARD_DRAGGING`), thẻ trượt dùng `radius={LIST_CARD_RADIUS}` (quy ước mục 16).
- **Cả Tạo ghi chú và Xem ghi chú đều 2 bước: danh sách ghi chú → chạm 1 ghi chú mới hiện các thẻ nội dung bên trong.**
  Danh sách ghi chú dùng chung `NoteList` (`components.tsx`): kéo ≡ / sửa số để đổi thứ tự (`reorderNotes`), trượt trái để xoá (`deleteNote`).
- **Ghi chú CHUNG của cả gia đình**: `toUid` = **`ALL_MEMBERS`** (`'__all'`, `toName` "Cả gia đình", hằng số trong `src/lib/notifications.ts`):
  **mọi thành viên cùng xem, sửa, đánh dấu xong, nạp / rút, thêm nội dung, xoá được**. Trong `MemberPicker` là **lựa chọn đầu tiên "Cả gia đình"** (`ALL_MEMBER`,
  avatar tròn icon nhóm người `RecipientAvatar`). Thông báo `note_{id}` có `toUid` = `ALL_MEMBERS` thì **mọi người trừ người tạo** đều thấy ("… tạo ghi chú chung …", mở tab Cả nhà).
  Danh sách / thẻ hiện "Chung cả nhà · người tạo". Số thứ tự đánh riêng trong các ghi chú chung.
- [x] Tạo ghi chú, bước 1 (`/note/sent?to=uid`, `NoteSentPage`): danh sách ghi chú **gửi cho người nhận đang chọn**; chọn người nhận bằng `MemberPicker`
  **trên thanh tiêu đề** (giống chọn con ở Time line: avatar tròn, chạm mở popup), **mặc định là "Cả gia đình"** (vừa mở là ghi chú chung; chọn 1 thành viên để gửi riêng), lưu trên URL `?to=`;
  dòng phụ dưới tiêu đề = **"m/n ghi chú đã hoàn thành"** (`doneSummary`) của người nhận đang chọn. FAB + mở bước 2 để tạo mới.
- [x] Tạo ghi chú, bước 2 (`/note/sent/new?to=uid` tạo mới, `/note/sent/:id` sửa, `NoteFormPage`): nội dung bên trong 1 ghi chú.
  Dưới thanh tiêu đề là **[số thứ tự `NumberField`] [tên ghi chú]** (cùng kiểu hàng thẻ; tạo mới mặc định = số ghi chú của người nhận + 1, đứng cuối; sửa giữ số hiện tại; tên bắt buộc);
  Dòng phụ dưới tiêu đề = "Gửi cho: …" (sửa thì thêm "· m/n thẻ đã xong"). Lưu xong quay về bước 1 (danh sách của người nhận).
  **Thanh tiêu đề có avatar người nhận (`MemberPicker`, giống bước 1), chạm để ĐỔI NGƯỜI NHẬN — cả khi sửa**: bấm FAB lưu thì ghi chú chuyển sang người mới
  (`updateNote` có `oldIds`: ghi `toUid` / `toName` mới, chèn vào danh sách người mới — mặc định đứng cuối, đánh số lại danh sách người cũ; thẻ giữ trạng thái đã xong;
  thông báo `note_{id}` chuyển cho người nhận mới, đổi thành tự ghi cho mình thì xoá thông báo). Tạo từ nội dung chưa xong (`?from=`) thì không đổi người nhận. Sửa thì thẻ cũ **giữ trạng thái đã xong** (`updateNote`), thẻ mới chưa xong.
  Danh sách thẻ `EditableList` (thẻ tách rời, cuộn trong vùng danh sách): mỗi thẻ 1 hàng **[≡ kéo lên / xuống] [số thứ tự `NumberField inline`, xem mục 14] [ô nhập nội dung trực tiếp]**;
  số thứ tự = mức độ ưu tiên (sửa số rồi rời ô thì thẻ chuyển tới vị trí đó); **trượt thẻ sang trái** hiện thùng rác (chạm 2 lần mới xoá, giống Tra cứu).
  FAB [+ thêm thẻ] [gửi / lưu]: thẻ mới thêm vào cuối, **số thứ tự = tổng số thẻ tính cả thẻ mới**. **Đang gõ thì gợi ý** ngay dưới thẻ từ các Thẻ ghi chú
  (chứa chữ đang gõ, không phân biệt dấu / hoa thường `foldKey`, theo thứ tự ưu tiên, tối đa 4; chưa gõ thì gợi ý các thẻ đầu; bỏ thẻ đã có trong ghi chú).
  Gửi / lưu: bỏ thẻ trống / trùng, ghi chú (chèn đúng số thứ tự, đánh số lại các ghi chú khác của người nhận) + **thẻ có nội dung mới được lưu vào Thẻ ghi chú** (thêm cuối danh sách) cùng 1 batch (`createNote` / `updateNote`).
  **Khi sửa, mỗi thẻ hiện trạng thái** (vòng xanh có dấu check = đã xong, nội dung gạch ngang; vòng rỗng = chưa xong; prop `status` của `EditableList`).
  **FAB [nhân bản] "Tạo ghi chú mới từ nội dung chưa hoàn thành"** (chỉ hiện khi ghi chú có cả thẻ đã xong và chưa xong; đang có thay đổi chưa lưu thì báo lưu trước):
  mở `/note/sent/new?from=id`, danh sách điền sẵn các thẻ chưa xong; lưu bằng `moveItemsToNewNote` (1 transaction): các thẻ còn trong form được **chuyển** sang ghi chú mới
  (giữ lịch sử nạp / rút), biến mất khỏi ghi chú cũ; thẻ người dùng gỡ khỏi form thì ở lại ghi chú cũ; ghi chú cũ còn toàn thẻ đã xong nên thông báo thành "Hoàn thành".
  **FAB [upload] "Gộp nội dung chưa xong từ ghi chú khác"** (chỉ khi SỬA; đang có thay đổi chưa lưu / đã đổi người nhận thì báo lưu trước): popup `MergePopup` liệt kê
  các ghi chú khác **của cùng người nhận còn nội dung chưa xong** (tên, "n chưa xong: …"), **chọn được nhiều**, 2 nút bằng nhau **[Đóng] [Chuyển (số nội dung)]**.
  Chuyển = `mergeIntoNote` (1 transaction): thẻ chưa xong của các ghi chú được chọn **chuyển sang cuối ghi chú đang sửa** (giữ id + các lần nạp / rút;
  trùng nội dung với thẻ đã có thì gộp vào thẻ đó và thành chưa xong); ghi chú nguồn chỉ còn thẻ đã xong (thông báo "Hoàn thành"), **hết sạch nội dung thì bị xoá**
  (xoá cả thông báo, đánh số lại danh sách); thông báo của ghi chú đang sửa thành "Chưa xong". Xong thì form vẽ lại từ dữ liệu mới và báo "Đã chuyển n nội dung…".
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
  **Bước 1 có 3 tab** (`Segmented` dưới tiêu đề, lưu trên URL `?tab=all|sent`): **"Gửi cho mình"** (như trên), **"Cả nhà"** = ghi chú chung (`shared` trong `NoteContext`,
  thao tác giống "Gửi cho mình": kéo / xoá / mở ra đánh dấu xong, nạp / rút; FAB + tạo ghi chú chung) và **"Mình đã gửi"** = ghi chú mình gửi cho
  **thành viên khác** (`sent` trong `NoteContext`, `useNotesFrom`: `fromUid` = mình, bỏ ghi chú tự ghi và ghi chú chung; mới nhất trước), danh sách `SentNoteList`
  **chỉ xem** (avatar người nhận, "Gửi cho …", số thẻ đã xong; không kéo / không xoá — sửa / xoá ở Tạo ghi chú). Chạm mở `/note/inbox/:id?tab=sent`:
  màn hình chi tiết ở chế độ **`readOnly`**: thấy thẻ nào đã xong (ai đánh dấu) và các lần nạp / rút quỹ (chạm nội dung để xem danh sách),
  nhưng **không đánh dấu xong / nạp / rút được** (ô vuông khoá, không có FAB). Ghi chú gửi đến mình vẫn xử lý như cũ.
- [x] Cài đặt (`/note/settings`): **quỹ mặc định** khi nạp / rút ở Xem ghi chú, chọn là lưu ngay.

Dữ liệu Firestore (xem `src/pages/note/data/api.ts`), thuộc gia đình đang chọn:
- `families/{familyId}/notes/{noteId}`: ghi chú (`name`, `position` = số thứ tự trong các ghi chú của người nhận, `toUid`, `toName`, `fromUid`, `fromName`, `createdAt`, `items` = mảng thẻ theo thứ tự ưu tiên `{ id, text, done, doneByName, money }`;
  `money` = các lần nạp / rút của riêng thẻ `{ type, amount, fundId, fundName, txId, byName, at }`)
  **`id` của thẻ phải DUY NHẤT trong ghi chú** (là key khi vẽ danh sách, khi xoá / đánh dấu xong / nạp rút): thẻ mới dùng `newItemId()` (ngẫu nhiên);
  ghi chú cũ đánh id "i1", "i2"… nên gộp nội dung có thể trùng → mọi chỗ đọc thẻ (`toNote` và các transaction trong `data/api.ts`) đều qua `uniqueItemIds`
  (đổi id trùng thành "<id>_<vị trí>", ghi lại là sửa luôn dữ liệu); `mergeIntoNote` cấp id mới cho thẻ chuyển sang nếu trùng id thẻ đã có.
- `families/{familyId}/noteCards/{cardId}`: thẻ ghi chú đã từng nhập (`text`, `position` 1..n = thứ tự ưu tiên gợi ý), không trùng nội dung
- `users/{uid}/settings/note`: `{ defaultFundId }`, RIÊNG từng tài khoản

### App Vườn mây (`/garden`) — game trồng cây
Game nông trại **tự thiết kế** (cùng thể loại game trồng trọt, không chép tên / hình / nhân vật của game nào). Vẽ 2D bằng icon nét (`GLYPHS`), không dùng 3D.
**Xu trong game TÁCH RIÊNG hoàn toàn, không liên quan tới app Quỹ.** Luật chơi ở `src/pages/garden/data/crops.ts`, ghi dữ liệu ở `data/api.ts` (mọi thao tác là 1 Firestore transaction `mutate`).
- **Trang 2D cũ `/garden` (trang chính, Vườn của tôi `FarmPage`, Kho, Cẩm nang) ĐÃ BỎ ở GĐ4**: trồng / chăm / thu hoạch làm trên cảnh 3D trong game,
  Kho + Cẩm nang thành popup trong game (xem "GĐ4 đã làm"). Luật chung vẫn ở `crops.ts`: **cây lớn theo thời gian thật** từ `plantedAt` (đóng app vẫn lớn),
  4 giai đoạn hạt / mầm / lớn / chín (`plantState`: mầm từ 20%, đang lớn từ 60%); tưới trước khi chín: +1 nông sản; cây chín không héo.
  Cấp độ: lên cấp L cần tổng `25·L·(L−1)` kinh nghiệm (`levelOf`); 8 loại cây mở dần theo cấp (`CROPS`).
  **Chốt 20/11/2026 (chưa sửa code): cấp tối đa 90; từ cấp 40 rất khó lên** — tới cấp 40 giữ công thức cũ (39.000 kinh nghiệm), mỗi cấp sau 40 cần `50·L·1,06^(L−39)`
  (tổng: cấp 50 ≈ 70 nghìn, 60 ≈ 139 nghìn, 70 ≈ 285 nghìn, 80 ≈ 586 nghìn, 90 ≈ 1,2 triệu; cấp 89 → 90 cần ≈ 82 nghìn). Hệ số 1,06 là hằng số để cân chỉnh.
- [x] **Cảnh mây 3D** (trước ở Vườn của tôi, nay là nền của game; phần mô tả dưới vẫn đúng cho mây / máy): `Segmented` **[Cảnh mây] [Ô đất]** dưới thanh cấp độ (nhớ ở localStorage `garden-view`, mặc định Cảnh mây).
  Cảnh mây chiếm phần còn lại của trang (`models/CloudScene.tsx`, lazy cùng three.js, vùng có `data-no-swipe`): **1 ngón xoay, 2 ngón phóng to / thu nhỏ**
  (OrbitControls, không dịch chuyển; tự xoay chậm cho tới khi chạm), các tầng mây nhấp nhô lơ lửng. Gieo / tưới / thu hoạch vẫn ở tab Ô đất (chưa đặt cây lên mây).
  **3 máy chế tạo hiện trong cảnh** (`public/models/may-che-tao.glb`, ~1,1MB, ~31 nghìn đỉnh, xuất KÈM vật liệu + thuộc tính `anim` (extras) từ các collection `May_Nhim` / `May_Tho` / `May_Meo`,
  bộ phận nặng giảm đỉnh bằng Decimate lúc xuất): khi tải, mỗi máy được gắn (`attach`) vào tầng mây của nó (`MACHINE_TIER`) nên nhấp nhô theo mây;
  kính "transmission" đổi thành kính trong suốt thường (`lightenMaterials`, cho nhẹ trên iPhone cũ). Máy **đứng yên, chưa có hoạt cảnh**.
  Sửa máy trong Blender thì xuất lại file này (chọn mesh + empty của 3 collection, không chọn camera `CamMay*`, Y-up, có vật liệu, có extras).
  **Hình khối mây dựng bằng Blender**: `design/vuon-may/tang-may.blend` (4 tầng mây + 5 cụm mây nhỏ, trời đêm, trăng; ảnh render `tang-may-dem.png`),
  xuất ra **`public/models/tang-may.glb`** (giảm còn ~2.600 đỉnh / tầng, chỉ lưới, không vật liệu). **Màu mây tô bằng code** theo độ cao cục bộ (`paintClouds`: đáy xanh tím → đỉnh trắng hồng);
  trời gradient, sao nhấp nháy, trăng + quầng sáng, đốm sáng vàng, ánh sáng đều vẽ bằng code. Sửa mây trong Blender thì xuất lại .glb (glTF, chọn các mesh `TangMay_*` / `MayNho_*`, Y-up, không vật liệu).
  File `/models/*` không precache, tải lần đầu rồi lưu bằng runtime cache `CacheFirst` (`vite.config.ts`).
- [ ] **Máy chế tạo hình con vật** (mỗi tầng mây 1 máy, chế tạo sản phẩm từ nông sản). Đã dựng **máy nhím** (tầng 1), **máy thỏ** (tầng 2) và **máy mèo** (tầng 3), xem dưới trong Blender (`design/vuon-may/tang-may.blend`,
  collection `May_Nhim`, ảnh `may-nhim.png`), đứng ở mép phải tầng dưới cùng; **chưa xuất ra app, chưa có chức năng chế tạo**.
  **Mô hình đã chuẩn bị để code điều khiển** (hoạt cảnh làm bằng code three.js theo trạng thái nghỉ / đang chế tạo / xong, KHÔNG dùng keyframe Blender):
  mọi bộ phận ở dáng nghỉ có tỉ lệ 1, góc 0, tâm (origin) đặt đúng điểm xoay; mỗi object có thuộc tính `anim` (xuất sang glTF thành `extras`) mô tả chuyển động. Cây:
  ```
  May_Nhim (Empty, khung: dời / xoay cả máy)
    Nhim_Than      tâm ở đáy thân: thở / nhún = co giãn
      Nhim_MatTrai, Nhim_MatPhai   tâm giữa mắt: chớp mắt = scale Z về ~0.1
      Nhim_BonKinh   bồn kính + vòng vàng
        Nhim_NuocEp  tâm ở đáy nước: sóng sánh = scale Z
      Nhim_OngKhoi   tâm ở chân ống: rung nhẹ
        Nhim_DiemKhoi (Empty) miệng ống: chỗ nhả khói
      Nhim_BanhRang  tâm ở trục: quay quanh trục X cục bộ
    Nhim_Chan, Nhim_Voi  đứng yên
    Nhim_Khay
      Nhim_DiemSanPham (Empty) chỗ sản phẩm hiện ra
  ```
  Các bộ phận con nằm dưới `Nhim_Than` nên đi theo thân khi thân nhún. Sửa mô hình thì giữ nguyên tên / tâm / cây này (code sẽ tìm object theo tên).
  **Máy thỏ (tầng 2)** — lò nướng: collection `May_Tho` (ảnh `may-tho.png`, `hai-may-toan-canh.png`), đứng ở đầu phải tầng 2, cùng quy ước như máy nhím. Cây:
  ```
  May_Tho (Empty)
    Tho_Than       tâm ở đáy thân (gồm cả đầu, mõm, răng, tay, viền cửa lò, que chong chóng)
      Tho_CuaLo    kính cửa lò (vật liệu Tho_LuaLo phát sáng): đổi độ sáng khi đang nướng
        Tho_DiemHoi (Empty) chỗ hơi nóng / lấp lánh
      Tho_MatTrai, Tho_MatPhai   chớp mắt = scale Z
      Tho_Mui      khịt mũi = co giãn nhanh
      Tho_TaiTrai, Tho_TaiPhai   tâm ở gốc tai: cụp / vẫy = xoay quanh trục X cục bộ
      Tho_Duoi     tâm ở gốc đuôi: ngoáy = xoay quanh Z
      Tho_ChongChong  tâm ở trục: quay quanh trục Y cục bộ
    Tho_Chan       đứng yên
    Tho_Khay
      Tho_DiemSanPham (Empty)
  ```
  **Máy mèo (tầng 3)** — nấu mứt / kẹo: collection `May_Meo` (ảnh `may-meo.png`, `ba-may-toan-canh.png`), đứng ở đầu trái tầng 3, cùng quy ước. Cây:
  ```
  May_Meo (Empty)
    Meo_Than       tâm ở đáy thân (gồm đầu, mõm, ria, má, sọc, vòng cổ, tay, nồi đồng)
      Meo_TaiTrai, Meo_TaiPhai   tâm ở gốc tai: vẫy = xoay nhanh quanh trục Y cục bộ
      Meo_MatTrai, Meo_MatPhai   chớp mắt = scale Z
      Meo_Chuong   tâm ở móc treo: đung đưa = xoay quanh X
      Meo_Mut      tâm ở đáy lớp mứt: sôi = scale Z
        Meo_DiemHoi (Empty) hơi nóng trên nồi
      Meo_PhoiDanh tâm ở trục phới: quay quanh Z cục bộ
      Meo_Duoi     tâm ở gốc đuôi: vẫy chậm quanh Y / Z
        Meo_DenDuoi  đèn lồng chóp đuôi (vật liệu Meo_Den phát sáng): đổi độ sáng
    Meo_Chan       đứng yên
    Meo_Khay
      Meo_DiemSanPham (Empty)
  ```
- **Script dựng mô hình Blender: `design/vuon-may/scripts/`** (xem `README.md` trong đó). **Mỗi lần Blender mở lại phải chạy `h2.py` trước**
  (nạp hàm dùng chung `ns["H2"]`, `render_lv`, `render_lv_glow` vào `bpy.app.driver_namespace`); ảnh chậu / icon có quầng sáng ghép bằng `glow_merge.py`;
  bộ chậu mới dựng theo mẫu `ph_base.py` / `ph_levels.py`. Thao tác Blender nặng thì chia nhỏ (vd 2 chậu / lần), không gộp dựng + render trong 1 lần gọi.
- [ ] **Bộ chậu** (thiết kế đã chốt, chưa làm logic):
  - **Số chậu mỗi tầng**: tầng 1: **12**, tầng 2: **6**, tầng 3: **5**, tầng 4: **4** (tầng 1–3 đã trừ chỗ đặt máy).
  - **Mỗi bộ chậu có TỐI ĐA 6 chậu, các chậu trong bộ khác nhau nhưng chung 1 chủ đề** (vd Biển cả); có bộ ít hơn (vd bộ 4 chậu) → tầng 1 đặt được 2 bộ.
  - **6 cấp (lv1 → lv6), nâng TỪNG chậu** bằng **bọ rùa, sâu, đom đóm, nhện + xu**, tới khi cả bộ lên lv6. Cấp càng cao chậu càng đẹp / chi tiết, thể hiện chủ đề rõ hơn.
    Cách làm mô hình: mỗi chậu 1 **dáng gốc**, lên cấp thì **thêm dần lớp chi tiết** (viền, hoa văn, đồ trang trí, phát sáng…) thay vì dựng lại cả chậu.
  - **Bọ rùa / sâu / đom đóm / nhện xuất hiện bay vòng vòng quanh cây**, người chơi chạm để bắt (thay cho cơ chế "sâu làm giảm sản lượng" hiện tại).
  - **Hiệu ứng chỉ áp dụng cho TẦNG đặt bộ chậu đó**, tăng theo cấp chậu và theo **số chậu KHÁC NHAU của bộ có trên tầng**: có **mốc riêng của từng bộ**
    (vd bộ 6 chậu: đủ 2 chậu khác nhau +10%, đủ 4 chậu +20%, đủ cả bộ +30% **+ hiệu ứng thêm khi đủ bộ**; mốc 2 / 4 / 6 là cấu hình của từng bộ, bộ 4 chậu có mốc khác).
  - **Hạng bộ chậu B / A / S** (cố định theo bộ; B tệ nhất, S xịn nhất) quyết định hiệu ứng được dùng và mức trần; **cấp chậu lv1–lv6** (người chơi nâng) làm hiệu ứng mạnh dần trong trần đó.
    | | Hạng B | Hạng A | Hạng S |
    |---|---|---|---|
    | Hiệu ứng chính chọn từ | Hạt rẻ, Thêm kinh nghiệm, Giá tốt, ~~Ít sâu~~ Hút côn trùng (chốt 20/11/2026) | Lớn nhanh, Bội thu, Giữ ẩm, Hút côn trùng | Mùa may (thu gấp đôi), Máy chạy nhanh, Lớn nhanh + Bội thu cùng lúc |
    | Mức ở lv6 theo 3 mốc số chậu | 4 / 8 / 12% | 10 / 20 / 30% | 15 / 30 / 45% |
    | Thưởng đủ bộ | 1 hiệu ứng hạng B, tối đa 5% | 1 hiệu ứng hạng B, tối đa 10% | 1 hiệu ứng hạng A, tối đa 15% + 1 đặc quyền riêng (vd cây chín tự vào kho, tầng không bao giờ bị sâu, côn trùng tự vào lưới) |
    **Theo cấp**: lv1 = 40% mức của lv6, mỗi cấp tăng đều; cấp dùng để tính = **trung bình cấp các chậu được tính vào mốc**.
    **Phần lẻ tính thành cơ hội** (vd +0,3 nông sản = 30% khả năng được thêm 1).
    Danh sách hiệu ứng: Lớn nhanh (giảm thời gian chín), Bội thu (thêm nông sản), Thêm kinh nghiệm, Giá tốt (bán đắt hơn), Hạt rẻ (gieo rẻ hơn), Giữ ẩm (tự tính là đã tưới),
    Ít sâu, Hút côn trùng (gặp bọ rùa / đom đóm / nhện / sâu nhiều hơn), Mùa may (cơ hội thu gấp đôi), Máy chạy nhanh (máy cùng tầng làm nhanh hơn).
  - **Bộ Phượng Hoàng = hạng S, BỘ BANNER CHẬU 1** (bộ thứ 10, ĐÃ LÀM — B3 của kế hoạch chậu S, chăm chút kỹ): thân đỏ thẫm chuyển cam vàng (màu đỉnh `Col`, như Băng Tinh), viền vàng, lông vũ, lửa.
    Hiệu ứng chính **Lớn nhanh + Bội thu** (`growyield`; 2 / 4 / 6 chậu: lv1 6 / 12 / 18%, lv6 15 / 30 / 45%), đủ bộ thưởng **Giữ ẩm** (lv1 6% → lv6 15%)
    + **đặc quyền "Côn trùng tự vào lưới"**. Collection `BoChau_PhuongHoang` (hàng mẫu x 9 → 18, cách 1,8; y −24), file `chau-phuong-hoang.glb` (~1,19MB; thân giảm 0,5, Lv3–4 0,5, Lv5 0,42, Lv6 0,4).
    6 chậu `ChauPH_1…6`: 1 **Bình lông vũ** (5 hàng vảy lông vũ ôm sát thân), 2 **Bát cánh phượng** (2 cánh 2 lớp lông xoè hai bên, khớp vàng ngọc lam), 3 **Chậu tổ lửa** (64 cành vàng đan + than hồng phát sáng),
    4 **Chậu đuôi phượng** (3 lông đuôi cuộn chéo mặt trước, tơ lông 2 bên, "mắt" vàng + ngọc lam + đỏ), 5 **Chậu mặt trời** (mặt trời vàng lõi lửa sáng + 16 tia, đai tia nắng), 6 **Tháp lửa** (6 ô ngọn lửa đổ màu vàng viền vàng).
    Vật liệu `PH_*` (Than (màu đỉnh), Vang, VangDam, DoSon, Long, LongVang, NgocLam, Lua / ThanHong / LongSang / HongNgoc / Sao phát sáng, HaoQuang trong). Dựng bằng `ph_base.py` / `ph_levels.py` (`design/vuon-may/scripts/`; chạy theo nhóm 2 chậu qua `PH_ONLY`, cả 6 một lần dễ làm Blender quá thời gian).
    Cấp: Lv2 đai vàng · Lv3 đai + hạt hồng ngọc + cổ lông vàng quanh miệng · Lv4 + 8 lưỡi lửa PHÁT SÁNG ở chân · Lv5 + chỉ vàng uốn sóng + 10 lưỡi lửa + tàn lửa + huy chương vàng hồng ngọc sáng có lông xoè
    (chậu 4: mắt đuôi sáng, chậu 5: lõi mặt trời sáng) · Lv6 vương miện 10 lông vàng sáng quanh miệng + **2 cánh phượng phát sáng vươn lên sau miệng chậu** + vòng hào quang lửa dưới đáy + tia lấp lánh + huy chương.
    Đã đo 8 cây × 6 chậu (`PLANT_FIT`): hướng dương / bí ngô / dưa hấu thu nhỏ ở vài chậu. Ảnh `bo-chau-phuong-hoang-6-cap.png`.
  - **Bộ Băng Tinh = hạng S, "LỆCH RATE" 2** (bộ thứ 9, ĐÃ LÀM — B2 của kế hoạch chậu S): băng xanh chuyển màu, bạc, tuyết, tinh thể băng phát sáng.
    Hiệu ứng chính **Máy chạy nhanh** (máy chế tạo cùng tầng; 2 / 4 / 6 chậu: lv1 −6 / −12 / −18%, lv6 −15 / −30 / −45%), đủ bộ thưởng **Lớn nhanh** (lv1 −6% → lv6 −15%)
    + **đặc quyền "Tầng không bao giờ bị sâu"**. Collection `BoChau_BangTinh` (hàng mẫu x 9 → 16,5; y −22), file `chau-bang-tinh.glb` (~1,08MB).
    6 chậu `ChauBT_1…6`: 1 **Bình băng** (10 mặt cắt phẳng + gân), 2 **Bát tuyết** (vành tuyết phủ miệng + tuyết chảy xuống), 3 **Chậu tinh thể** (9 tinh thể băng ở chân),
    4 **Chậu bông tuyết** (4 bông tuyết trắng lớn), 5 **Chậu băng xoắn** (rãnh xoắn), 6 **Chậu chân băng** (3 chân tinh thể + vòng đế bạc).
    **Màu thân chuyển xanh băng đậm (đáy) → xanh nhạt (miệng) bằng MÀU ĐỈNH** (thuộc tính `Col`, vật liệu `BT_Bang` dùng nút Color Attribute → glTF `COLOR_0`).
    **LƯU Ý: three.js nhân màu đỉnh với MỌI vật liệu trong cùng mesh có `COLOR_0`** → phần không phải thân băng (bạc, tuyết, tinh thể) phải có màu đỉnh TRẮNG (đã sửa; mặc định là đen → sẽ thành đen trong game).
    Vật liệu `BT_*` (Bang, BangDam, Tuyet, Bac, TinhThe, TinhTheSang / Sang (phát sáng), CotBang (trong), HaoQuang). Dựng bằng file `bt_base.py` / `bt_levels.py` (`design/vuon-may/scripts/`).
    Cấp: Lv2 2 dải bạc · Lv3 + 6 bông tuyết nhỏ · Lv4 + 4 chùm tinh thể băng PHÁT SÁNG ở chân · Lv5 + 16 cột băng rủ từ miệng + chỉ bạc uốn sóng · Lv6 vương miện 12 tinh thể sáng quanh miệng
    + cột băng + chùm tinh thể + 2 vòng hào quang sương giá + 14 hạt tuyết / sao lấp lánh + bông tuyết lớn phát sáng phía trước. Đã đo 8 cây × 6 chậu (`PLANT_FIT`).
  - **Bộ Sứ Lam = hạng S, "LỆCH RATE" 1** (bộ thứ 8, ĐÃ LÀM — B1 của kế hoạch chậu S; rơi khi ra vàng ngoài banner): sứ trắng vẽ lam cobalt + viền vàng kiểu đồ sứ cung đình.
    Hiệu ứng chính **Mùa may** (cơ hội thu gấp đôi; 2 / 4 / 6 chậu: lv1 6 / 12 / 18%, lv6 15 / 30 / 45%), đủ bộ thưởng **Bội thu** (lv1 +6% → lv6 +15%) + **đặc quyền "Cây chín tự vào kho"** (`perk`).
    Collection `BoChau_SuLam` (hàng mẫu x 9 → 16,5; y −20), file `chau-su-lam.glb` (~0,98MB, đã giảm đỉnh: thân 0,5, Lv 0,38–0,6).
    6 chậu `ChauSL_1…6`: 1 **Bình hoa lam** (dáng bình cổ thắt, dải lam, đường sóng, mây cuộn đôi), 2 **Bát sen** (12 cánh sen viền lam + sóng nhỏ), 3 **Chóe tai lân** (2 tai vòng vàng có núm),
    4 **Đôn sứ** (2 hàng đinh, 4 ô hoa 4 cánh), 5 **Chậu bát giác** (8 mặt, mỗi mặt 1 vòng lam), 6 **Chậu chân quỳ** (3 chân vàng uốn cong + vòng đế vàng).
    Vật liệu `SL_*` (SuTrang, Lam, LamNhat, NgocSang (phát sáng), NgocBich, DayDo, HaoQuang (trong, phát sáng), SaoLapLanh). Mặt cắt `sl_specs`; dựng cấp bằng file `sl_levels.py` (`design/vuon-may/scripts/`).
    Cấp: Lv2 2 dải vàng · Lv3 + 6 hoa vàng nhuỵ ngọc sáng · Lv4 + 4 huy chương vàng có ngọc trai PHÁT SÁNG · Lv5 + chỉ vàng uốn sóng ở chân + 2 tua ngọc bích (dây đỏ, nắp vàng, tua đỏ)
    · Lv6 vương miện vàng 10 vòm có ngọc sáng quanh miệng + huy chương to + tua ngọc + **2 vòng hào quang xanh dưới đáy** + 9 sao lấp lánh. Huy chương chậu 4 / 5 lệch góc để không đè hoa văn sẵn có.
    Đã đo 8 cây × 6 chậu (hàm `fit_plants` trong `H2`, chậu bát giác đo theo bán kính đỉnh / cạnh): bí ngô / dưa hấu / hướng dương thu nhỏ ở vài chậu (`PLANT_FIT`).
  - **Bộ Thiên hà = hạng A, BỘ 4 CHẬU, CHỈ ĐẶT Ở TẦNG 4** (bộ thứ 7, ĐÃ LÀM; `tiers: [3]` trong `POT_SETS`, `tierBlock`: ở tầng khác ô chậu mờ + "Chỉ đặt ở tầng 4", `placePot` cũng chặn).
    Mốc theo 2 / 3 / 4 chậu khác nhau: hiệu ứng chính **Lớn nhanh** (lv1 −4 / −8 / −12%, lv6 −10 / −20 / −30%; trùng hiệu ứng với Rừng nấm vì hạng A chỉ có 4 hiệu ứng),
    đủ bộ thưởng **Thêm kinh nghiệm** (lv1 +4% → lv6 +10%). Collection `BoChau_ThienHa`, hàng mẫu ngoài mây (x 9 → 13,8; y −16); file `chau-thien-ha.glb` (~0,38MB).
    4 chậu `ChauTH_1…4`: 1 **Trăng khuyết** (xanh đêm chấm sao, trăng khuyết vàng phát sáng nhẹ nhô lên sau lưng), 2 **Hành tinh** (cam hồng, 2 dải đậm, vành vàng nghiêng),
    3 **Ngôi sao** (xanh đêm, 5 cánh sao vàng xoè quanh miệng), 4 **Tinh vân** (tím, 3 nhánh xoắn xanh / hồng, chấm sáng).
    Vật liệu `TH_*` (DemXanh, Trang (phát sáng nhẹ), HanhTinh, HanhTinhDam, VanhHT, VangSao, TinhVan 1–3, SaoSang / TrangSang phát sáng, ChamTrang). Mặt cắt lưu ở `th_specs`.
    Cấp: Lv2 3 sao vàng trên thân · Lv3 chòm sao sáng nối dây vàng + 2 sao · Lv4 1 quỹ đạo vàng nghiêng + mặt trăng nhỏ · Lv5 2 quỹ đạo + 2 mặt trăng (1 sáng) + chòm sao
    · Lv6 vành vàng + vương miện 5 sao sáng + 2 quỹ đạo trăng sáng + 10 sao lấp lánh + sao chổi. Đã đo 8 cây × 4 chậu: chỉ dưa hấu thu nhỏ nhẹ (0,9–0,95).
  - **Bộ Mật ong = hạng A** (bộ thứ 6, ĐÃ LÀM): hiệu ứng chính **Hút côn trùng** (gặp bọ rùa / đom đóm / nhện / sâu nhiều hơn; 2 / 4 / 6 chậu: lv1 +4 / +8 / +12%, lv6 +10 / +20 / +30%),
    đủ bộ thưởng **Ít sâu** (lv1 −4% → lv6 −10%). Collection `BoChau_MatOng`, hàng mẫu ngoài mây (x 9 → 16,5; y −14); file `chau-mat-ong.glb` (~1MB, đã giảm đỉnh mạnh: thân 0,55, Lv 0,4–0,5).
    6 chậu `ChauMO_1…6`: 1 **Tổ ong rơm** (vòng rơm chồng, cửa tổ), 2 **Hũ mật ong** (hổ phách bóng, khăn đỏ buộc cổ, nhãn hình ong), 3 **Chậu tổ ong** (LỤC GIÁC, ô lục giác nổi trên 6 mặt),
    4 **Hoa cúc** (thân vàng, 18 cánh trắng xoè quanh miệng, lá ở chân), 5 **Cánh bướm** (tím nhạt, 2 cánh bướm xanh / cam hai bên), 6 **Chú ong** (vàng, 2 sọc đen, mắt, má hồng, cánh, râu, kim).
    **Chậu lục giác** dựng bằng mặt cắt xoay với 6 cạnh (bán kính ĐỈNH = bán kính cạnh / cos30°); kiểm tra xuyên thành dùng bán kính đỉnh cho mặt ngoài và bán kính cạnh cho mặt trong (an toàn hơn).
    Vật liệu `MO_*` (Rom, RomDam, HoPhach, Mat, MatSang / PhanHoa phát sáng, VangOng, Den, Canh, TimNhat, Buom1, Buom2, CanhHoa, Nhuy, La, Vai, HoaHong, OTim). Mặt cắt lưu ở `mo_specs`.
    Cấp: Lv2 2 chú ong đậu trên thân · Lv3 2 ong + 3 hoa cúc nhỏ · Lv4 mật chảy từ miệng chậu (7 giọt) + dây hoa lá quanh thân · Lv5 mật chảy + dây hoa hồng + 3 ong bay + 1 bướm
    · Lv6 mật PHÁT SÁNG (9 giọt) + vành vàng + dây hoa + 3 ong bay + 2 bướm + 12 hạt phấn hoa lấp lánh. Đã đo 8 cây × 6 chậu: bí ngô / dưa hấu thu nhỏ ở nhiều chậu (`PLANT_FIT`, thấp nhất 0,65).
  - **Bộ Trung thu = hạng A** (bộ thứ 5, ĐÃ LÀM): hiệu ứng chính **Bội thu** (thêm nông sản; 2 / 4 / 6 chậu: lv1 +4 / +8 / +12%, lv6 +10 / +20 / +30%),
    đủ bộ thưởng **Giá tốt** (lv1 +4% → lv6 +10%). Collection `BoChau_TrungThu`, hàng mẫu ngoài mây (x 9 → 16,5; y −12); file `chau-trung-thu.glb` (~0,75MB).
    6 chậu `ChauTT_1…6`: 1 **Bánh trung thu** (thấp, 8 múi, hoa văn tròn), 2 **Đèn lồng** (đỏ, 12 nan, đai vàng, cổ hẹp), 3 **Mặt trăng** (vàng nhạt, miệng hố),
    4 **Ông sao** (thân đỏ, 5 ngôi sao vàng quanh thân, viền vàng), 5 **Thỏ ngọc** (trắng, 2 tai ở phía sau miệng, mắt / mũi / má hồng, đuôi bông), 6 **Trống lân** (thân đỏ, mặt da trống, 2 hàng đinh vàng).
    Vật liệu `TT_*` (Banh, BanhDam, Do, DoDam, VangNhat, Trang, Hong, Den, Trang2, MiengTrang, DaTrong, Xanh, XanhLa, DenLong / SaoSang phát sáng). Mặt cắt lưu ở `tt_specs` lúc dựng.
    Cấp: Lv2 ruy băng + nơ phía trước · Lv3 ruy băng + 2 đèn lồng đỏ treo vành · Lv4 dây cờ đuôi nheo 4 màu + 3 đèn lồng · Lv5 dây cờ + 3 đèn lồng PHÁT SÁNG + 2 đèn ông sao sáng cắm hai bên
    · Lv6 vành vàng + dây cờ đỏ vàng + đèn lồng sáng + 2 đèn ông sao to + 8 ngôi sao nhỏ bay trên miệng chậu.
    Đã đo 8 cây × 6 chậu: Đèn lồng cổ hẹp nên bí ngô 0,75, dưa hấu 0,65; dưa hấu 0,9 ở 4 chậu khác (`PLANT_FIT`).
  - **Bộ Rừng nấm = hạng A** (bộ thứ 4, ĐÃ LÀM): hiệu ứng chính **Lớn nhanh** (giảm thời gian chín; 2 / 4 / 6 chậu: lv1 −4 / −8 / −12%, lv6 −10 / −20 / −30%),
    đủ bộ thưởng **Hạt rẻ** (lv1 −4% → lv6 −10%). Collection `BoChau_RungNam`, hàng mẫu ngoài mây (x 9 → 16,5; y −10); file `chau-rung-nam.glb` (~0,6MB).
    6 chậu `ChauNam_1…6`: 1 **Nấm mũ đỏ** (thân kem, vành mũ nấm đỏ chấm trắng xoè ra), 2 **Gốc cây** (vỏ sần, vòng gỗ ở miệng, 5 rễ bám đất), 3 **Chậu đá rêu** (đá sần + mảng rêu),
    4 **Nhà nấm** (vành mũ tím, cửa gỗ vòm, cửa sổ tròn sáng đèn), 5 **Chậu lá** (9 lá to ôm thân, chóp cong ra), 6 **Chậu nấm chùm** (bát gỗ + 3 chùm nấm ở chân).
    Vật liệu `Nam_*` (Do, Trang, Than, VoCay, GoVong, Da, Reu, Tim, La, LaNhat, CuaGo, CuaSo / NamSang / DenTien / DomDom phát sáng, NamNau). Mặt cắt lưu ở `nam_specs` lúc dựng.
    Cấp: Lv2 2 nấm nâu ở chân · Lv3 3 nấm đỏ chấm trắng + rêu · Lv4 3 nấm xanh PHÁT SÁNG + 2 lá dương xỉ · Lv5 4 dây đèn tiên quanh thân + nấm sáng + dương xỉ
    · Lv6 vành vàng + đèn tiên + 5 nấm sáng to + 7 đom đóm bay quanh miệng chậu + dương xỉ. Đã đo 8 cây × 6 chậu: bí ngô / dưa hấu thu nhỏ ở vài chậu (`PLANT_FIT`).
  - **Bộ Biển cả = hạng A** (bộ thứ 3, ĐÃ LÀM): hiệu ứng chính **Giữ ẩm** (cơ hội cây tự tính là đã tưới; 2 / 4 / 6 chậu khác nhau: lv1 4 / 8 / 12%, lv6 10 / 20 / 30%),
    đủ bộ thưởng **Thêm kinh nghiệm** (lv1 +4% → lv6 +10%). Collection `BoChau_BienCa`, hàng mẫu ngoài mây (x 9 → 16,5; y −8); file `chau-bien-ca.glb` (~0,97MB).
    6 chậu `ChauBien_1…6`: 1 **Vỏ sò** (thấp rộng, 14 khía + gân, miệng gợn), 2 **Ốc xoắn** (gờ xoắn 3 vòng + gai), 3 **Chậu san hô** (xanh biển sâu, đế cát, 3 bụi san hô đỏ hồng),
    4 **Sóng biển** (xanh ngọc, dải xanh đậm, 2 đường sóng trắng + bọt), 5 **Thùng gỗ đắm** (16 ván, 3 đai sắt, hà bám), 6 **Hũ xà cừ** (đặt trên vỏ hàu, chuỗi ngọc ở cổ).
    Vật liệu `Bien_*` (XanhNgoc, XanhDam, Cat, SoHong, SoHongDam, SanHo, XaCu, NgocTrai, NgocSang (phát sáng), Go, Sat, Bot, Rong, SaoBien). Mặt cắt lưu ở `bien_specs` lúc dựng.
    Cấp: Lv2 3 vỏ sò nhỏ · Lv3 2 sao biển cam + 2 vỏ sò · Lv4 chuỗi ngọc trai quanh miệng + 3 sao biển · Lv5 chuỗi ngọc miệng + 3 dây ngọc rủ + sao biển + 2 bụi san hô + 2 dải rong
    · Lv6 vành vàng + chuỗi / dây ngọc PHÁT SÁNG + 2 sao biển vàng + vỏ sò lớn ôm ngọc trai phát sáng phía trước + 2 bụi san hô.
    Đã đo 8 cây × 6 chậu: chỉ bí ngô / dưa hấu phải thu nhỏ ở vài chậu (`PLANT_FIT`).
  - **Bộ Mây tre = hạng B** (bộ thứ 2, ĐÃ LÀM): hiệu ứng chính **Giá tốt** (bán nông sản đắt hơn; 2 / 4 / 6 chậu khác nhau: lv1 +2 / +3 / +5%, lv6 +4 / +8 / +12%),
    đủ bộ thưởng **Ít sâu** (lv1 −2% → lv6 −5%). Collection `BoChau_MayTre` trong `tang-may.blend`, đặt riêng 1 hàng ngoài mây (x 9 → 16,5; y −6) để làm mẫu;
    6 chậu `ChauTre_1…6`: 1 **Giỏ đan tròn**, 2 **Ống tre** (đốt tre xanh), 3 **Thúng mây** (vòng cuộn), 4 **Gùi tre** (cao, loe miệng), 5 **Bình mây** (bầu, cổ thắt), 6 **Giỏ chân tre** (4 chân tre + đai).
    Đan mây = vỏ xoay mặt cắt + các vòng ngang 2 màu + 18 nan dọc theo mặt cắt. Vật liệu `Tre_May` / `Tre_MayDam` / `Tre_Xanh` / `Tre_Dot` / `Tre_Ruot` / `Tre_Coi` / `Tre_SonDo` / `Tre_DenLong` / `Tre_La`.
    Cấp (lớp riêng, KHÔNG cộng dồn, cùng quy ước `_Lv2…Lv6`): Lv2 1 dây cói · Lv3 2 dây cói + 6 nút buộc · Lv4 vành sơn mài đỏ + dây cói + 2 tua đỏ
    · Lv5 vành sơn đỏ + 2 dải sơn đỏ + 3 nhánh lá tre · Lv6 vành vàng + 2 dải đỏ viền vàng + 3 đèn lồng đỏ nhỏ (phát sáng nhẹ) treo ở vành.
    Mặt cắt (ngoài / trong, dùng để kiểm tra xuyên thành) lưu ở `tre_specs` lúc dựng; đã kiểm tra 8 cây × 6 chậu: chỉ hướng dương / bí ngô / dưa hấu phải thu nhỏ ở vài chậu (`PLANT_FIT`).
  - **Bộ đất nung = hạng B**: hiệu ứng chính **Hạt rẻ** (2 / 4 / 6 chậu khác nhau: lv1 −2 / −3 / −5%, lv6 −4 / −8 / −12% giá hạt gieo ở tầng đó);
    đủ bộ thưởng **+kinh nghiệm** (lv1 +2% → lv6 +5%).
  - **Bộ chậu đất nung cơ bản** (bộ đầu tiên, 6 chậu, chưa có cấp / hiệu ứng): dựng trong Blender, collection `BoChau_DatNung` (ảnh `bo-chau-dat-nung.png`),
    đặt thử 2 hàng ở phần trái / giữa tầng 1; **chưa xuất ra app**. 6 dáng: 1 tròn (cổ điển), 2 bát (thấp rộng), 3 ống cao, 4 vuông, 5 bầu (viền sơn kem ở eo), 6 có đĩa lót.
    Dựng bằng cách xoay mặt cắt quanh trục (thành chậu có độ dày, vành miệng, lớp đất bên trong); vật liệu `Chau_DatNung` / `Chau_DatNhat` / `Chau_DatDam`, đất `Chau_Dat`.
    Cấu trúc mỗi chậu (gốc ở giữa đáy chậu, tỉ lệ 1, góc 0):
    ```
    ChauDat_n (Empty, thuộc tính ten / bo = "dat_nung" / cap = 1)
      ChauDat_n_Than     thân chậu
      ChauDat_n_Dat      lớp đất
      ChauDat_n_DiemCay  (Empty) giữa mặt đất: chỗ trồng cây
      ChauDat_6_Dia, ChauDat_5_Vien   (chỉ chậu 6 / 5) đĩa lót, viền sơn
    ```
    **Cấp 2–6 đã dựng** (ảnh `bo-chau-dat-nung-6-cap.png`, `chau-tron-6-cap.png`): mỗi chậu có 5 object con `ChauDat_n_Lv2` … `ChauDat_n_Lv6` (gốc ở đáy chậu, tỉ lệ 1, góc 0)
    = **lớp trang trí RIÊNG của từng cấp, KHÔNG cộng dồn**: code chỉ bật đúng `_Lv{cấp}` (cấp 1 = tắt hết), dáng gốc + đất luôn hiện. Chủ đề gốm quê → gốm men:
    Lv2 1 viền sơn kem · Lv3 2 viền kem + hàng chấm kem · Lv4 miệng chậu tráng men xanh ngọc (`Chau_MenXanh`) + viền men + chấm kem + 2 quai đất
    · Lv5 men xanh + 2 viền men + dải sóng kem + quai men · Lv6 men xanh + chỉ vàng ở vành (`Chau_Vang`) + 2 viền vàng + sóng vàng + 6 đá hổ phách phát sáng (`Chau_HoPhach`) ở đỉnh sóng + quai vàng.
    Vị trí chi tiết tính theo mặt cắt của từng chậu (chậu vuông theo cạnh vuông). Cả 30 lớp ~59 nghìn đỉnh: khi xuất ra app nên giảm đỉnh hạt chấm / sóng (đang là nhiều quả cầu nhỏ).
- [ ] **Côn trùng nâng cấp chậu** (bay / bò quanh cây, chạm để bắt): đã dựng trong Blender, collection `ConTrung` (5 con: sâu, đom đóm, bọ rùa, nhện, **bươm bướm**) (ảnh `con-trung.png`, `con-trung-trong-vuon.png`),
  đặt thử quanh bộ chậu ở tầng 1; **chưa xuất ra app, chưa có logic bắt**. Cùng quy ước như các máy: bộ phận tỉ lệ 1 / góc 0 ở dáng nghỉ, tâm đúng điểm xoay,
  thuộc tính `anim` mô tả chuyển động; khung gốc (Empty) đang phóng to 1,4 lần cho dễ thấy / dễ chạm trên điện thoại. Mặt các con hướng -Y (Blender).
  ```
  Sau (Empty)               sâu xanh: Sau_Dau (tâm ở cổ: gật đầu) + Sau_Dot1…Dot5 (tâm ở đáy từng đốt: nhấp nhô lệch pha khi bò)
  DomDom (Empty)            đom đóm
    DomDom_Than             đầu + ngực cam + chân + râu: nhấp nhô khi bay
      DomDom_Bung           bụng phát sáng (vật liệu CT_DomDomSang): đổi độ sáng + co giãn nhẹ
      DomDom_CanhTrai/Phai  tâm ở gốc cánh: vỗ cánh = xoay nhanh quanh Y cục bộ
  BoRua (Empty)             bọ rùa
    BoRua_Than              thân đen + đầu + mắt + râu + 6 chân
      BoRua_VoTrai/VoPhai   2 nửa mai đỏ chấm đen, tâm ở mép trước phía trong: mở mai khi bay = xoay quanh X (nâng) + Y (mở ra)
      BoRua_CanhTrai/Phai   cánh mỏng nằm dưới mai, vỗ khi bay
  Nhen (Empty)              tâm mạng nhện
    Nhen_Luoi               mạng nhện thẳng đứng + sợi treo: đứng yên
    Nhen_Than               nhện tím (đầu hướng lên, đậu trước mạng): bò trên mạng = dời trong mặt XZ
      Nhen_ChanT1…T4, Nhen_ChanP1…P4   tâm ở gốc chân: bước = xoay nhẹ lệch pha
  Buom (Empty)              bươm bướm (dựng bằng `design/vuon-may/scripts/buom.py`, ảnh `buom.png`)
    Buom_Than               đầu tròn to + mắt có đốm sáng + má hồng + miệng cười + râu cong đầu vàng, ngực lông, bụng 5 đốt
      Buom_CanhTrai/Phai    tâm ở gốc cánh sát thân; mỗi bên = cánh trên (xanh trời, chóp nhọn) + cánh dưới (hồng tím, có đuôi ngắn),
                            vòng trong nhạt / giữa đậm / viền tím đậm, đốm hoa văn (viền tím + lõi vàng), chấm trắng gần mép;
                            cánh trên cao hơn cánh dưới 6mm (không đè cùng mặt phẳng); vỗ cánh = xoay quanh Y cục bộ
  ```
- [ ] **Cây trồng 3D + công thức chế tạo** (đã dựng 3 cây trong Blender, collection `CayTrong`, ảnh `cay-4-giai-doan.png`, `cay-chin-can-canh.png`; **chưa xuất ra app, chưa có logic chế tạo**).
  3 cây đã có trong `CROPS` và **nối với nhau qua 3 máy**: ngô làm "bột" cho lò thỏ, dâu / cà rốt là "hương vị" dùng ở nhiều máy:
  | Máy | Sản phẩm (nguyên liệu) |
  |---|---|
  | Nhím — nước ép | nước ép cà rốt (cà rốt), nước ép dâu (dâu tây), sữa ngô (ngô) |
  | Thỏ — lò nướng | bánh ngô (ngô), bánh cà rốt (ngô + cà rốt), bánh dâu (ngô + dâu tây) |
  | Mèo — mứt / kẹo | mứt dâu (dâu tây), mứt cà rốt (cà rốt), kẹo bắp (ngô) |
  **Bộ cây thứ 2: cà chua, hướng dương, bí ngô** (cũng có trong `CROPS`; ngô vẫn là "bột" cho lò thỏ nên 2 bộ kết hợp được với nhau):
  | Máy | Sản phẩm (nguyên liệu) |
  |---|---|
  | Nhím — nước ép | nước ép cà chua (cà chua), sữa hạt hướng dương (hướng dương), sinh tố bí ngô (bí ngô) |
  | Thỏ — lò nướng | bánh ngô sốt cà (ngô + cà chua), bánh bí ngô (ngô + bí ngô), bánh hạt hướng dương (ngô + hướng dương) |
  | Mèo — mứt / kẹo | sốt cà chua (cà chua), kẹo hạt hướng dương (hướng dương), mứt bí ngô (bí ngô) |
  **Bộ cây thứ 3: mía, dưa hấu, đậu phộng** (mía là **"đường"**, nối với máy mèo; **mía và đậu phộng CHƯA có trong `CROPS`**, phải thêm khi làm logic):
  | Máy | Sản phẩm (nguyên liệu) |
  |---|---|
  | Nhím — nước ép | nước mía (mía), nước ép dưa hấu (dưa hấu), sữa đậu phộng (đậu phộng) |
  | Thỏ — lò nướng | bánh đậu phộng (ngô + đậu phộng), bánh đường mía (ngô + mía) |
  | Mèo — mứt / kẹo | kẹo đậu phộng (đậu phộng + mía), mứt vỏ dưa (dưa hấu + mía), kẹo mía (mía) |
  **Bộ cây thứ 4 "trà chiều": trà, bạc hà, chanh** (cả 3 **CHƯA có trong `CROPS`**; kết hợp mía = đường, ngô = bột):
  | Máy | Sản phẩm (nguyên liệu) |
  |---|---|
  | Nhím — nước ép | trà xanh (trà), trà chanh (trà + chanh), nước chanh bạc hà (chanh + bạc hà) |
  | Thỏ — lò nướng | bánh trà xanh (ngô + trà), bánh chanh (ngô + chanh + mía) |
  | Mèo — mứt / kẹo | kẹo bạc hà (bạc hà + mía), mứt chanh (chanh + mía), kẹo trà xanh (trà + mía) |
  **Bộ cây thứ 5 "sô-cô-la & cà phê": ca cao, cà phê, vani** (cả 3 **CHƯA có trong `CROPS`**; kết hợp mía = đường, ngô = bột):
  | Máy | Sản phẩm (nguyên liệu) |
  |---|---|
  | Nhím — đồ uống | cà phê (cà phê), ca cao nóng (ca cao + mía), cà phê vani (cà phê + vani) |
  | Thỏ — lò nướng | bánh sô-cô-la (ngô + ca cao + mía), bánh vani (ngô + vani), bánh tiramisu (ngô + cà phê + ca cao) |
  | Mèo — mứt / kẹo | kẹo sô-cô-la (ca cao + mía), kẹo cà phê (cà phê + mía), kẹo vani (vani + mía) |
  **Bộ cây thứ 6 "vườn hoa ngọt": hoa hồng, oải hương, hoa nhài** (cả 3 **CHƯA có trong `CROPS`**; kết hợp trà (bộ 4), chanh, mía, ngô):
  | Máy | Sản phẩm (nguyên liệu) |
  |---|---|
  | Nhím — đồ uống | trà nhài (trà + nhài), trà hoa hồng (trà + hồng), nước chanh oải hương (chanh + oải hương) |
  | Thỏ — lò nướng | bánh oải hương (ngô + oải hương + mía), bánh hoa hồng (ngô + hồng + mía) |
  | Mèo — mứt / kẹo | mứt hoa hồng (hồng + mía), kẹo oải hương (oải hương + mía), kẹo nhài (nhài + mía) |
  **Bộ cây thứ 7 "trái mọng": nho, việt quất, mâm xôi** (cả 3 **CHƯA có trong `CROPS`**; kết hợp dâu tây, chanh, mía, ngô):
  | Máy | Sản phẩm (nguyên liệu) |
  |---|---|
  | Nhím — đồ uống | nước ép nho (nho), sinh tố việt quất (việt quất + dâu tây), nước mâm xôi chanh (mâm xôi + chanh) |
  | Thỏ — lò nướng | bánh việt quất (ngô + việt quất + mía), bánh tart mâm xôi (ngô + mâm xôi), bánh nho khô (ngô + nho) |
  | Mèo — mứt / kẹo | mứt việt quất (việt quất + mía), mứt mâm xôi (mâm xôi + mía), kẹo nho (nho + mía) |
  Mỗi cây 4 giai đoạn **khớp `plotState` (0 hạt, 1 mầm, 2 đang lớn, 3 chín)**, mỗi giai đoạn 1 lớp RIÊNG (code chỉ bật `_GD{giai đoạn}`), gốc ở mặt đất:
  ```
  Cay_CaRot / Cay_Dau / Cay_Ngo (Empty, ten; gắn vào ChauDat_n_DiemCay; đung đưa nhẹ = xoay ở gốc)
    Cay_<Ten>_GD0   hạt vừa gieo + mầm nhú
    Cay_<Ten>_GD1   mầm
    Cay_<Ten>_GD2   đang lớn (dâu có hoa trắng, cà rốt hé vai củ)
    Cay_<Ten>_GD3   chín: cà rốt lá xum xuê + vai củ cam nhô khỏi đất; dâu 5 quả rủ ra ngoài miệng chậu (1 quả còn xanh) + hoa;
                    ngô thân cao, 6 lá, 2 bắp có lá bao hé + râu, cờ trên ngọn
  ```
  Khung gốc đang phóng to cho cân với chậu (cà rốt 1,8, dâu 1,7, ngô 1,4); đặt thử: cà rốt ở chậu tròn, dâu ở chậu bát, ngô ở chậu vuông.
  **Bản sum suê** (giai đoạn 1–3 dựng lại): lá là dải 2 mặt có dáng (đầu nhọn, mép răng cưa, uốn rủ, lòng khum — hàm `leaf` trong lúc dựng), cọng cong 2–3 đoạn.
  Chín: cà rốt 18 cọng lá xẻ lông chim + 3 vai củ; dâu 2 tầng lá (trong đứng, ngoài rủ qua miệng chậu) + 9 quả (2 xanh) + 3 hoa + 2 ngó bò ra ngoài có cây con;
  ngô khóm 3 thân có đốt, lá dài cong rủ, 4 bắp có lá bao + râu, cờ trên ngọn. Giai đoạn chín ~5–10 nghìn đỉnh / cây: khi xuất ra app cần giảm đỉnh.
  **Cà chua / hướng dương / bí ngô** (`Cay_CaChua` / `Cay_HuongDuong` / `Cay_BiNgo`, cùng cấu trúc 4 giai đoạn `_GD0…GD3`; ảnh `sau-cay-4-giai-doan.png`, `ba-cay-moi-can-canh.png`):
  cà chua trong chậu bầu (khung ×1,6): có **cọc tre** + dây buộc, thân chính + 3 nhánh phụ, lá kép răng cưa, 4 chùm quả (đỏ / cam / xanh), hoa vàng;
  hướng dương trong chậu ống cao (×1,3): 13 lá hình tim, 1 bông lớn + 2 bông nhánh (đĩa hạt nâu, 2 vòng cánh vàng) + 1 nụ;
  bí ngô trong chậu có đĩa (×1,6): lá xẻ 3 thuỳ to, tua cuốn, hoa loa kèn vàng, 1 quả bí lớn 8 múi trên mặt đất + **dây bò rủ qua miệng chậu xuống đĩa** có quả bí nhỏ.
  Đang lớn: cà chua có quả non xanh + hoa, hướng dương có nụ, bí ngô có quả non. Chín: cà chua ~16 nghìn đỉnh (nặng nhất), hướng dương ~8 nghìn, bí ngô ~6,6 nghìn.
  **QUY ƯỚC: cây bò / rủ KHÔNG được xuyên qua thành chậu** — dùng giàn thô sơ bằng cành gỗ (`Cay_CanhGo` / `Cay_CanhGoNhat`, buộc dây `Cay_DayBuoc`) đỡ lên:
  bí ngô (đang lớn + chín) có **giàn chóp nón 4 chân** cắm trong chậu, buộc ở đỉnh, 1–2 tầng thanh ngang; dây bí **leo quấn lên giàn**, quả nhỏ treo dưới thanh ngang,
  lá ở gốc thu gọn trong miệng chậu (bỏ dây rủ xuống đĩa); dâu tây (chín) có **vòng đỡ bằng cành uốn tròn trên 4 cọc ngắn**, cao hơn miệng chậu: lá tựa lên vòng,
  cuống quả vắt qua vòng và treo quả ra NGOÀI vòng, cách thành chậu (bỏ 2 ngó bò). Cà chua đã có cọc tre.
  Đã kiểm tra bằng số liệu: mọi đỉnh của 6 cây (giai đoạn 2–3) không nằm trong bề dày thành / mép miệng chậu (so với mặt cắt của từng chậu).
  Thêm cây mới cũng phải kiểm tra như vậy.
  **Mía / dưa hấu / đậu phộng** (`Cay_Mia` / `Cay_DuaHau` / `Cay_DauPhong`, ảnh `bo-cay-3-tang-2.png`) trồng trong **3 chậu đất nung chép thêm ở tầng 2** (`ChauDat_T2_3` ống cao, `ChauDat_T2_2` bát,
  `ChauDat_T2_1` tròn; chép cả lớp cấp `_Lv2…6`, đang ở cấp 1): mía (×1,3) khóm 5 thân tím có đốt sáng, lá dài cong như cỏ ở 1/3 trên;
  dưa hấu (×1,5) dây bò gọn trong lòng chậu bát, lá xẻ 5 thuỳ răng cưa, tua cuốn, hoa vàng, 1 quả lớn + 1 quả nhỏ **sọc dọc = 2 vật liệu chia theo mặt** (`Cay_DuaVoDam` / `Cay_DuaVoNhat`), 1 miếng dưa bổ (vỏ / cùi / ruột đỏ / hạt đen);
  đậu phộng (×1,6) bụi thấp lá kép 4 lá chét tròn, hoa cam, tia đâm xuống đất, 3 củ lạc nhổ lên trên mặt đất (vỏ có gân). Đã kiểm tra: không xuyên thành chậu.
  **Trà / bạc hà / chanh** (`Cay_Tra` / `Cay_BacHa` / `Cay_Chanh`, ảnh `tra-bacha-chanh.png`, `tang-2-6-cay-4-giai-doan.png`) trong 3 chậu chép thêm ở hàng sau tầng 2
  (`ChauDat_T2_4` vuông, `ChauDat_T2_5` bầu, `ChauDat_T2_6` có đĩa — chậu trà nằm sau máy thỏ): chanh (×1,5) cây lùn thân gỗ (`Cay_ThanGo`), tán lá bóng hình vòm,
  10 quả treo (2 quả vàng), hoa trắng, 1 nửa quả bổ đôi trên đất có múi; bạc hà (×1,6) khóm 12 thân VUÔNG, lá đối chéo chữ thập răng cưa, 8 chùm hoa tím trên ngọn;
  trà (×1,45) bụi tỉa tròn 64 đầu cành lá bóng răng cưa, búp "1 tôm 2 lá" xanh non, vài hoa trắng nhuỵ vàng. Chậu vuông kiểm tra theo "bán kính góc" max(|x|,|y|)/cos45.
  Đã kiểm tra: không xuyên thành chậu. Chín: trà ~17 nghìn đỉnh, bạc hà ~11 nghìn, chanh ~10 nghìn (cần giảm khi xuất).
  **Ca cao / cà phê / vani** (`Cay_CaCao` / `Cay_CaPhe` / `Cay_Vani`, ảnh `cacao-caphe-vani.png`) trong 3 chậu chép thêm ở **tầng 3, phía phải máy mèo**
  (`ChauDat_T3_1` tròn trước-trái, `ChauDat_T3_4` vuông trước-phải, `ChauDat_T3_5` bầu phía sau; chậu phải cách nồi đồng của mèo — nồi ở toạ độ tầng ≈ (-0,93; -0,77)):
  ca cao (×1,5) cây nhỏ thân gỗ, 8 cành + cành con, tán lá to dài rủ (vài lá non đỏ đồng), **6 trái mọc thẳng trên thân** có 10 khía (vàng / đỏ / xanh), hoa hồng nhạt li ti trên thân;
  cà phê (×1,5) bụi hình tháp 7 tầng × 3 cành ngang, lá đối bóng, chùm quả ở nách lá (đỏ / vàng / xanh), đang lớn có hoa trắng;
  vani (×1,4) **leo cột gỗ phủ rêu** (giàn đỡ theo quy ước), dây quấn quanh cột, lá dày bầu dục so le, hoa lan vàng kem, 2 chùm quả dài thõng (có quả đã chín nâu).
  Đã kiểm tra: không xuyên thành chậu. Chín: cà phê ~20 nghìn đỉnh (nặng nhất), ca cao ~10,6 nghìn, vani ~2,5 nghìn.
  **Hoa hồng / oải hương / hoa nhài** (`Cay_Hong` / `Cay_OaiHuong` / `Cay_Nhai`, ảnh `hong-oaihuong-nhai.png`, `hoa-hong-can-canh.png`) trong 3 chậu chép thêm ở **tầng 4**
  (chưa có máy; `ChauDat_T4_4` vuông, `ChauDat_T4_2` bát, `ChauDat_T4_6` có đĩa — chậu có đĩa đặt theo điểm cao nhất của mây dưới đĩa để đĩa không bị mây che):
  hồng (×1,5) 8 thân có gai, lá kép 5 lá chét răng cưa, 5 bông nhiều lớp cánh xoáy (hồng / hồng nhạt / đỏ) + 3 nụ (đang lớn: chỉ có nụ);
  oải hương (×1,6) bụi lá kim bạc + 26 cành hoa tím dạng bông đuôi (đang lớn: cành chưa nở); nhài (×1,5) bụi 11 cành lá bóng mọc đối, chùm hoa trắng 7 cánh nhuỵ vàng + nụ hồng nhạt.
  **Lá nhỏ + độ bóng cao dưới ánh trăng bị loá thành trắng** → lá hồng / nhài để `Roughness` 0,65–0,75. Đã kiểm tra: không xuyên thành chậu.
  **Giai đoạn chín đã làm sum suê hơn** (ảnh `hoa-chin-truoc-sau.png`): hồng 14 thân × 6 lá kép to + 10 cành lá ngắn phủ gốc, 9 bông + 5 nụ;
  oải hương 3 vòng chụm lá kim (40 chụm) + 40 cành hoa toả quạt; nhài 18 cành × 7 cặp lá + chùm 3–5 hoa mỗi đầu cành + chùm giữa cành.
  **Nặng**: hồng ~32 nghìn đỉnh, oải hương ~28 nghìn, nhài ~26 nghìn → khi xuất ra app PHẢI giảm (vd bông oải hương thay các hạt cầu bằng 1 lưới bông đuôi, giảm số cánh hồng ở vòng trong).
  Dựng cây nhiều chi tiết thì **dựng từng cây một** (một lần chạy dựng cả 3 cây làm Blender quá thời gian kết nối); hàm gộp dùng chung `finalize_stage` (lúc dựng).
  **Nho / việt quất / mâm xôi** (`Cay_Nho` / `Cay_VietQuat` / `Cay_MamXoi`, ảnh `nho-vietquat-mamxoi.png`): nho (×1,4) trong chậu ống cao `ChauDat_T4_3` ở tầng 4,
  **leo giàn quạt** 3 cây gỗ + 2 thanh ngang, lá chân vịt 5 thuỳ rủ xuống phủ kín 2 phía giàn, tua cuốn, 8 chùm nho tím (đang lớn: chùm xanh);
  việt quất (×1,4) trong chậu bầu `ChauDat_T1_5` ở **phía sau giữa tầng 1**, bụi 14 cành lá nhỏ (vài lá đỏ), chùm quả xanh lam có vương miện (vài quả xanh / hồng);
  mâm xôi (×1,5) trong chậu có đĩa `ChauDat_T3_6` ở mép phải tầng 3, **2 cọc gỗ + 2 dây căng**, 11 cành buộc vào dây, lá kép 5 lá chét, quả đỏ dạng chùm hạt.
  Chín: mâm xôi ~27 nghìn đỉnh, việt quất ~23 nghìn, nho ~21 nghìn (cần giảm khi xuất).
  **QUY ƯỚC: kiểm tra chồng lấn với MỌI vật thể xung quanh**, không chỉ thành chậu của chính cây: đếm đỉnh của vật khác (máy, côn trùng, chậu khác, cây khác)
  nằm BÊN TRONG khối chậu (theo mặt cắt, chậu vuông theo cạnh vuông, chậu có đĩa tính cả đĩa) → phải = 0. Lần rà soát đầu tiên phát hiện và đã sửa:
  khay máy mèo xuyên chậu ca cao, đuôi / thân máy thỏ xuyên chậu trà + bạc hà, gai máy nhím sát chậu việt quất, chân nhện xuyên chậu vuông tầng 1,
  đuôi sâu xuyên chậu bát, chậu chanh chạm vành chậu đậu phộng → đã dời các chậu `ChauDat_T3_1` (≈ (0,13; -1,4) tầng 3), `ChauDat_T2_6` (≈ (0,56; 1,8)),
  `ChauDat_T2_5` (≈ (-0,72; 1,72)), `ChauDat_T2_4` (≈ (-1,09; 0,67)) và dời mạng nhện / con sâu. Ảnh toàn cảnh: `vuon-toan-canh.png`.
- **Các giai đoạn làm game** (theo thứ tự): **GĐ1 [x]** app Giải trí + màn hình game ngang + màn hình tải + xem từng tầng (xem dưới);
  **GĐ2 [x]** xuất chậu / cây / côn trùng ra app (giảm đỉnh), vị trí chậu cố định, hiện chậu + cây đúng giai đoạn trên tầng 1 (xem "GĐ2 đã làm" dưới);
  **GĐ3 [x]** đặt / dời / cất chậu (danh sách cuộn ngang, xem trước, bảng hiệu ứng; xem "GĐ3 đã làm" dưới); **GĐ4 [x]** trồng / chăm / thu hoạch trên cảnh 3D, Kho + Cẩm nang thành popup, côn trùng xuất hiện + bắt (xem "GĐ4 đã làm" dưới);
  GĐ5 [ ] hiệu ứng bộ chậu (hạng, cấp), nâng cấp chậu bằng côn trùng + xu; GĐ6 [ ] máy chế tạo (công thức, thời gian, sản phẩm, hoạt cảnh);
  GĐ7 [ ] gacha nhận chậu + hạt giống (chờ mô tả); GĐ8 [ ] thêm 14 cây mới vào `CROPS`.
- [x] **Cơ chế hiển thị game — GĐ1 ĐÃ LÀM** (phần đặt chậu bên dưới chưa làm):
  Code: `src/pages/giaitri/GiaiTriHomePage.tsx` (menu), `src/pages/garden/game/` — `constants.ts` (đường dẫn, cấp mở tầng, nhớ tầng, mẹo),
  `LandscapeFrame.tsx` (khung ngang + `toLocal`, biến CSS `--safe-l` / `--safe-r` = vùng an toàn theo chiều ngang của khung), `LoadingScreen.tsx`,
  `GamePage.tsx` (tải + HUD: nút thoát, ▲ ▼ + "Tầng n/4", khung tầng khoá), `TierScene.tsx` (lazy cùng three.js: tải `.glb` có tiến độ `loadGameModels`,
  dựng mây + máy, vật liệu riêng từng tầng để làm mờ, **bộ điều khiển camera tự viết** `CameraRig` — KHÔNG dùng OrbitControls vì khung có thể xoay 90°).
  Route `/giai-tri` (GardenLayout) → index menu, `vuon-may` = game; ô app "Giải trí" (🎮) thay ô "Vườn mây" ở màn hình chính; phím tắt `giaitri-vuonmay`
  (đã bỏ 3 phím tắt `garden-*` cũ; các trang `/garden/...` cũ vẫn còn route nhưng không còn ô mở — sẽ thành popup trong game ở GĐ4).
  Bong bóng thông báo ẩn khi `isGamePath`. Canvas dùng `resize={{ offsetSize: true }}` (đo theo kích thước chưa xoay của khung).
  Camera: tâm = mặt trên tầng; khoảng cách vừa khung `fitRadius` theo tỉ lệ màn hình, zoom 0,4–1,3 lần; độ nghiêng 0,35–1,32 rad; kéo 2 ngón dời tâm ±30% cỡ tầng;
  chạm dịch < 8px không tính là xoay; tầng khác mờ 0,38, tầng che khuất 0,1. Đã thử: dọc (khung xoay) / ngang, xoay, nghiêng, chụm zoom + giới hạn, khoá tầng, nút thoát.
  Chi tiết đã chốt:
  - **App con "Giải trí"** thay cho ô "Vườn mây" ở màn hình chính: bên trong là menu các trò chơi, có ô mở game vườn trên mây
    — **tên game đã chốt: "Vườn mây"** (KHÔNG dùng tên game gốc đã lấy cảm hứng).
  - **Màn hình game riêng, toàn màn hình, LUÔN NẰM NGANG, không thanh tiêu đề**: điện thoại cầm dọc thì **xoay cả khung game 90° bằng CSS**
    (rộng = chiều cao màn hình, cao = chiều rộng), cầm ngang thì hiện bình thường → chạy được cả khi bật "Khoá xoay dọc", không cần màn chặn bắt xoay
    (web trên iPhone không tự khoá hướng màn hình được). Khi khung đang xoay phải **đổi toạ độ chạm** (OrbitControls, kéo thả, nút);
    tránh ô nhập chữ trong game (bàn phím iPhone vẫn bật theo chiều dọc); chừa vùng tai thỏ / thanh home theo chiều ngang.
  - Nội dung game = cảnh 3D các tầng mây. **Kho nông sản, Cẩm nang… là POPUP trong game**, không phải màn hình riêng.
  - **Camera chỉ nhìn 1 tầng mây mỗi lúc** (không cố hiện hết các tầng trong khung ngang). **Nút mũi tên** để chuyển sang tầng khác.
    Đang xem 1 tầng: **xoay vòng quanh tầng** để xem các góc, **phóng to / thu nhỏ** để đưa tầm nhìn lại gần / ra xa tầng đó.
    Chi tiết ĐÃ CHỐT:
    1. **Nút ▲ ▼ xếp dọc ở mép phải** màn hình ngang, giữa 2 nút ghi "Tầng n/4"; ở tầng 1 nút ▼ mờ, ở tầng 4 nút ▲ mờ (không quay vòng).
    2. **Chuyển tầng: camera bay lên / xuống mượt ~0,8 giây**, giữ nguyên góc xoay hiện tại (vẫn nhìn từ cùng một phía).
    3. **Giới hạn camera theo từng tầng**: không cho chui xuống dưới mây (chỉ nhìn từ trên cao tới gần ngang mặt mây); khoảng phóng to / thu nhỏ
       tính theo cỡ tầng (tầng 1 rộng nhất, tầng 4 nhỏ nhất), thu nhỏ tối đa vẫn chỉ vừa khung 1 tầng.
    4. **Các tầng khác vẫn hiện nhưng mờ / trong hơn**; tầng phía trên nếu che tầng đang xem thì tự làm trong suốt.
    5. **Kéo 2 ngón để dịch khung nhìn**, giới hạn trong phạm vi tầng đang xem (tầng 1 rộng); chạm nhanh (thu hoạch, bắt côn trùng, mở máy)
       chỉ tính là xoay khi ngón tay đã kéo đi 1 đoạn; **KHÔNG dùng vuốt để đổi tầng** (lẫn với xoay) — đổi tầng chỉ bằng nút mũi tên.
    6. **Nhớ tầng đang xem** (lưu trong máy): mở lại game về đúng tầng lần trước.
    7. **Tầng mở dần theo cấp độ**: nút mũi tên vẫn đi tới tầng đang khoá, tầng đó hiện **ổ khoá + điều kiện để mở**
       — **cấp mở đã chốt: tầng 1 mở sẵn, tầng 2 ở cấp 5, tầng 3 ở cấp 10, tầng 4 ở cấp 15** (theo `levelOf`: 500 / 2.250 / 5.250 kinh nghiệm).
  - **Nút thoát** trong game → về **menu của app con Giải trí**.
  - **Đặt chậu (đã nêu, CHƯA LÀM)**: ở mỗi tầng mây, **chạm vào 1 vị trí trống** (chỗ đặt được chậu mà chưa có chậu) → hiện **danh sách các chậu có thể đặt**,
    **xếp theo chiều ngang, cuộn ngang được**. Chi tiết ĐÃ CHỐT:
    1. Mỗi chỗ trống ở tầng đang xem hiện **vòng tròn nét đứt phát sáng nhẹ, nhấp nháy chậm**.
    2. **Vị trí chậu CỐ ĐỊNH** theo số chỗ mỗi tầng (12 / 6 / 5 / 4), xếp sẵn không đè máy / chậu khác.
    3. **Game là NGOẠI LỆ của quy ước mục 11** (được cuộn ngang); tự làm phần kéo cuộn có quán tính (khung game có thể đang xoay 90°, không dựa vào cuộn gốc của trình duyệt).
    4. Mỗi ô trong danh sách: ảnh chậu, tên chậu, tên bộ, **hạng bằng MÀU** (B = xanh biển, A = tím, S = vàng cam), cấp, tiến độ bộ trên tầng (vd "Đất nung 2/6");
       chậu giúp đạt mốc hiệu ứng tiếp theo có viền sáng + dòng thay đổi (vd "Hạt rẻ −2% → −3%").
    5. **Đặt thử**: chạm 1 chậu trong danh sách → chậu hiện mờ đúng chỗ để xem trước, bấm ✓ mới đặt, chạm ra ngoài là huỷ; camera tự xoay / dời để chỗ đó không bị che.
       Lúc này hiện thêm **bảng thông tin hiệu ứng của bộ chậu** (mỗi mốc 1 dòng, vd "Đất nung 2/6: …", "Đất nung 4/6: …", …) **nằm ngoài danh sách, phía bên phải**,
       kéo được để đọc. **Bảng thông tin — ĐÃ CHỐT**:
       - Rộng ~240px, nằm **phía trên danh sách** ở bên phải, cao tối đa bằng phần còn lại, **kéo dọc để đọc**; có nút **thu gọn / mở**
         (thu gọn còn 1 dòng, vd "Hạt rẻ −3% ▸"); camera tự dời để chậu đang xem trước nằm ở vùng trống bên trái, không bị bảng / danh sách che.
       - Khi đang đặt chậu **ẩn nút ▲ ▼ chuyển tầng** và các nút phụ; đặt xong / huỷ thì hiện lại.
       - Chạm vào bảng / danh sách thì **chỉ cuộn bảng / danh sách, cảnh 3D đứng yên**; cuộn bảng cũng tự làm (khung game có thể đang xoay 90°).
       - Nội dung: mỗi mốc 1 dòng có trạng thái — ✓ **đã đạt** ("Đất nung 2/6: Hạt rẻ −2%"), ▶ **mốc kế tiếp** ("Đất nung 4/6: Hạt rẻ −3% (còn thiếu 1 chậu)"),
         mờ = chưa đạt; dòng cuối = **thưởng đủ bộ**. Mức % theo **cấp hiện tại** + mức tối đa ở cấp 6 ("−3% · tối đa −8%").
         **Dòng đầu = chậu đang chọn thay đổi gì** ("Đặt chậu này: 3/6 → 4/6, đạt mốc mới!" / "Chậu trùng, không tăng hiệu ứng").
         Chưa chọn chậu nào thì bảng hiện **hiệu ứng hiện tại của cả tầng**.
       - Huy hiệu hạng: màu như mục 4 **kèm 1 chữ nhỏ B / A / S** bên trong (cho người khó phân biệt màu).
    6. **Nguồn chậu và hạt giống: cơ chế GACHA** — người dùng sẽ mô tả sau.
    7. **Đặt được 2 chậu giống nhau**, nhưng chậu trùng **không tăng hiệu ứng** (mốc bộ tính theo số chậu KHÁC nhau).
    8. **Nhấn giữ chậu đã đặt → Dời chỗ / Cất vào kho**; chậu đang có cây **vẫn cất được nhưng MẤT CÂY** → **bấm 2 lần mới cất**
       (lần đầu hiện "Cất chậu? Cây đang trồng sẽ mất").
  - **Màn hình tải** khi vào game: thanh tiến độ % (theo dung lượng mô hình 3D đã tải), con nhím linh vật chạy, mẹo chơi đổi lần lượt;
    **lần mở sau (mô hình đã lưu trong máy) vẫn hiện màn hình tải một chút** cho đồng bộ.
  - **Ẩn bong bóng thông báo** khi đang ở trong game.
- [x] **GĐ2 ĐÃ LÀM — chậu + cây trên tầng mây**:
  - File xuất (nén **meshopt**, `GLTFLoader.setMeshoptDecoder`): `public/models/chau-dat-nung.glb` (~0,5MB, 6 dáng `ChauDat_1…6` đặt ở gốc toạ độ, có `_Than` / `_Dat` / `_DiemCay` + lớp `_Lv2…Lv6`, Lv3–4 giảm đỉnh ×0,6, Lv5–6 ×0,35),
    `public/models/cay-trong.glb` (~1MB, 8 cây đang có trong `CROPS`: `Cay_Cai` / `CaRot` / `Dau` / `Ngo` / `CaChua` / `HuongDuong` / `DuaHau` / `BiNgo`, gốc ở toạ độ 0, GIỮ hệ số phóng của khung gốc;
    giai đoạn giảm đỉnh còn ≤ 400 / 1.500 / 3.000 / 4.500), `public/models/con-trung.glb` (~0,25MB, `Sau` / `DomDom` / `BoRua` / `Nhen`, **chưa tải trong game**, để dành GĐ4).
    Xuất lại: tạm đặt gốc chậu / cây về 0 (cây bỏ cha), thêm Decimate tên `XuatGiam`, xuất `use_selection` + `export_apply` + `export_extras` + meshopt, rồi trả lại vị trí / xoá modifier.
  - **Rau cải** (`Cay_Cai`, ×1,6) dựng thêm cho đủ 8 cây của `CROPS`. **Dâu tây đã dựng lại giai đoạn 2–3 gọn hơn** (vòng đỡ trên 4 cọc sát giữa) để vừa MỌI dáng chậu.
  - Đã kiểm tra 8 cây × 6 dáng chậu (xuyên thành): chỉ bí ngô / dưa hấu phải thu nhỏ ở vài dáng → `PLANT_FIT` trong `game/slots.ts` (bí ngô: ống cao 0,9, bầu 0,85; dưa hấu: ống cao 0,8, vuông 0,9, bầu 0,75, có đĩa 0,9).
  - **Chỗ đặt chậu cố định** `SLOTS` (`game/slots.ts`, toạ độ Blender đổi sang three `(x, z, -y)` = giữa đáy chậu): tầng 1: 12, tầng 2: 6, tầng 3: 5, tầng 4: 4 (đúng số đã chốt), mặt mây phẳng quanh chỗ đặt,
    cách máy / chậu khác (tầng 3 chật nhất vì máy mèo: chỗ thứ 5 ở (4,6; 3,5) Blender, cách chậu kế bên 1,2). Mỗi chỗ có `shape` = dáng chậu đất nung mặc định.
  - (Trước GĐ4) **Tầng 1: chỗ thứ i ↔ ô đất `plots[i]`**: ô đã mở (`i < unlocked`) hiện chậu (cấp 1, tắt lớp `_Lv*`), cây gắn ở `ChauDat_n_DiemCay`, **chỉ bật lớp `_GD{plotState().stage}`**
    (`syncPlants` trong `TierScene.tsx`, tính lại mỗi giây bằng `useNow`, chỉ dựng lại khi đổi cây / giai đoạn; vật liệu cây được thêm vào danh sách làm mờ của tầng). Tầng 2–4 chưa hiện chậu (chờ GĐ3 đặt chậu).
- [x] **GĐ3 ĐÃ LÀM — đặt / dời / cất chậu**:
  - Dữ liệu bộ chậu `src/pages/garden/data/pots.ts`: `POT_SETS` (bộ: tên, hạng, các chậu, hiệu ứng chính + mốc `{ count, lv1, lv6 }`, thưởng đủ bộ), `POT_KINDS` (chậu: tên, `shape` = dáng trong `chau-dat-nung.glb`),
    `setsOnTier` (số chậu khác nhau, cấp trung bình của các chậu được tính — mỗi loại lấy chậu cấp cao nhất —, mốc đã đạt, mức hiệu ứng), `valueAt` (tăng đều lv1 → lv6), `RANK_STYLE`.
    **Thêm bộ chậu mới**: xuất 1 file `.glb` riêng cho bộ (`POT_SETS[].file`, vd `chau-may-tre.glb` ~0,64MB; game tự tải mọi file bộ chậu),
    thêm vào `POT_SETS` + `POT_KINDS` (`model` = tên node gốc, con `<model>_Than` / `_Dat` / `_DiemCay` / `_Lv2…Lv6`) + 36 ảnh `public/game/chau/<kind>_<cấp>.webp`,
    đo 8 cây × chậu mới và ghi `PLANT_FIT` (khoá = id loại chậu). Hiệu ứng mới thêm vào `EFFECTS` (đang có Hạt rẻ, Thêm kinh nghiệm, Giá tốt, Ít sâu, Giữ ẩm, Lớn nhanh, Bội thu, Hút côn trùng; hạng S: Mùa may, Máy chạy nhanh, Lớn nhanh + Bội thu; bộ S có thêm `perk` = đặc quyền đủ bộ).
    **Chưa có gacha: mọi người được sẵn các bộ trong `STARTER_SETS`** (Đất nung + Mây tre + Biển cả + Rừng nấm + Trung thu + Mật ong + Thiên hà + Sứ Lam + Băng Tinh + Phượng Hoàng — tạm để thử, khi làm gacha (GĐ7) thì bỏ bớt; bộ nào chưa có chậu nào thì `withStarterSets` thêm 6 chậu cấp 1, id `g_<loại>`, nằm trong kho).
  - Vườn có thêm `pots` = mọi chậu đang có `{ id, kind, level }` và `placed` = map `"<tầng 0-3>-<chỗ>"` → id chậu (`slotKey`). **Chưa có gacha nên mỗi người được sẵn bộ Đất nung 6 chậu cấp 1**
    (`startPots`): vườn mới đặt sẵn 6 chậu ở 6 chỗ đầu tầng 1; vườn cũ chưa có `pots` thì mỗi ô đất đã mở được 1 chậu đúng dáng mặc định của chỗ (thêm chậu nếu > 6 ô), lưu lại ở lần ghi kế tiếp.
  - Ghi: `placePot` / `movePot` / `storePot` (`data/api.ts`, transaction): chỉ ở tầng đã mở khoá; **dời chỉ trong cùng tầng** (tầng 1: cây đi theo chậu, `plots[from]` → `plots[to]`);
    cất / đặt ở tầng 1 thì ô đất đó thành đất trống (**cất chậu có cây = mất cây**). Từ GĐ4: cây lưu theo chỗ đặt chậu (`plants`), `plots` / `unlocked` cũ bỏ hẳn (còn trong dữ liệu cũ nhưng không đọc).
  - Ảnh chậu cho danh sách: `public/game/chau/dat_nung_<dáng>_<cấp>.webp` (192px, nền trong, 36 ảnh ~190KB), render trong Blender (camera trực giao tạm, nghiêng 22°, 2 đèn mặt trời tạm, chỉ bật `_Lv<cấp>`).
  - Cảnh 3D (`TierScene.tsx`, `syncSlots`): mỗi chỗ đặt là 1 `Group` gắn vào tầng (nhấp nhô theo mây) gồm vòng nét đứt vàng + quầng sáng (nhấp nháy, xoay chậm), khối chạm dẹt, chậu (vật liệu riêng, vào danh sách làm mờ của tầng),
    cây (tầng 1) và chậu xem trước (mờ 55%). **Chạm**: tia từ camera vào hình chậu / cây thật (bỏ lớp đang ẩn) hoặc khối dẹt của chỗ trống. Chạm vòng → chế độ đặt; nhấn giữ chậu 0,5 giây → menu;
    chạm chỗ khác khi đang đặt = huỷ. Đang đặt: camera lại gần (≤ 0,62 khoảng vừa khung) và giữ chỗ đặt ở 1/3 trái, hơi cao (`Cam.focus`); xong / huỷ thì trả lại khoảng cách cũ.
  - Giao diện (`GamePage.tsx`, `PotUi.tsx`, `potInfo.ts`): danh sách chậu trong kho ở đáy (`LIST_H` 132px, ô 104px: ảnh, hạng màu + chữ, cấp, tên, "Đất nung n/6", viền sáng + dòng "Hạt rẻ −2% → −3%" nếu giúp đạt mốc mới);
    bảng hiệu ứng `InfoPanel` (w-60, góc phải trên, thu gọn còn 1 dòng, cuộn dọc); nút [X huỷ] [✓ đặt] tròn ở trái trên danh sách; ẩn nút thoát + ▲ ▼ khi đang đặt / dời.
    Menu chậu (`PotMenu`): [Đóng] [Dời chỗ] [Cất vào kho]; chậu có cây: lần đầu hiện "Cất chậu? Cây đang trồng sẽ mất", nút thành "Cất luôn". Dời chỗ: dải trên cùng "Chạm vào vòng trống…" + [Huỷ].
    Báo kết quả / lỗi bằng dòng nhắc ngắn (2,4 giây).
  - **Cuộn trong game dùng `DragScroll`** (`game/DragScroll.tsx`, trục `x` / `y`, toạ độ qua `toLocal`, quán tính + kéo lại ở 2 đầu, kéo > 8px thì chặn click của mục bên dưới), không dùng cuộn gốc.
- [x] **GĐ4 ĐÃ LÀM — gieo / chăm / thu hoạch / bắt côn trùng trên cảnh 3D** (code: `game/GamePage.tsx`, `TierScene.tsx`, `SeedUi.tsx`, `GardenPopups.tsx`; dữ liệu `data/api.ts`):
  - **Hạng hạt giống B / A / S** (`Crop.rank`, giữ bảng độ hiếm đã duyệt: Thường = B, Hiếm = A, Rất hiếm + Cực hiếm = S → **8 cây hiện có đều là B**).
    Tag hạng **giống chậu** (`RankBadge`: B xanh biển, A tím, S vàng + chữ) trên ô danh sách hạt, tab Hạt giống của Túi đồ, Cẩm nang.
    Gacha: suất "10 hạt giống" chia theo hạng `SEED_RANK_RATE` **B 70% / A 25% / S 5%** (hạng chưa có cây thì chia lại, `seedRankRates`), trong hạng chia đều; bảng tỉ lệ hiện từng hạng.
    **Chỉ hạt B bán ở cửa hàng** (xem "Lông chim + Cửa hàng").
  - Dữ liệu: `plants` = map `"<tầng>-<chỗ>"` → `{ crop, plantedAt, watered, caught }` (chỉ ở chỗ có chậu; dời chậu cây đi theo, cất chậu mất cây). `seeds` trừ 1 hạt / chậu.
    **Hạt tặng lúc bắt đầu**: 10 cải + 10 cà rốt (`START_SEEDS`, cờ `seedGift`, vườn cũ cũng được 1 lần).
    API: `sow(tier, slots[], crop)` (1 transaction cho cả lần kéo túi), `water`, `harvestPlant`, `catchInsect`, `sell`. Đã bỏ `plant` / `tend` / `tendAll` / `harvestAll` / `buyPlot`.
  - **Chạm chậu trống → danh sách hạt** (`SeedList`, dải cuộn ngang ở đáy như danh sách chậu, camera giữ chậu ở vùng trống): ảnh túi `public/game/tui/<id>.webp`, tag hạng, tên, ×số hạt, thời gian lớn;
    cây chưa đủ cấp mờ + "Cần cấp n"; chỉ hiện hạt đang có. Chọn hạt → gieo luôn chậu đó + **túi hạt 3D lơ lửng trên chậu** (tô màu `Crop.bag`, nhãn canvas vẽ icon cây to tràn mép).
    **Nhấn vào túi rồi kéo**: túi đi theo ngón tay (cao hơn 70px), **lướt qua chậu trống nào (trong 60px) là gieo chậu đó** (hiện ngay — `pending`, thả tay mới ghi 1 transaction).
    Chạm chậu trống khác khi đang cầm túi cũng gieo. Thanh dưới "Cà rốt · còn n hạt" + nút X. Túi biến mất khi: hết hạt, chạm chỗ trống / chậu có cây, bấm X, chuyển tầng.
  - **Chạm cây**: chín → thu hoạch (vào kho, +kinh nghiệm, báo lên cấp); chưa tưới → tưới; còn lại → "… chín sau …". **Huy hiệu nổi trên cây** của tầng đang xem: 🧺 (chín, nhảy nhảy), 💧 (cần tưới, từ giai đoạn mầm).
  - **Côn trùng** (`con-trung.glb`, ~0,33MB, xuất KHÔNG UV): ~1/2 số cây (cố định theo `plantedAt`) có 1 con (sâu / bọ rùa / đom đóm / nhện / bướm) từ khi cây lớn 35%; bọ rùa + đom đóm + bướm bay vòng quanh ngọn (vỗ cánh, bướm vỗ chậm và rộng: `INSECT_NODE.flap`),
    sâu + nhện bò trên miệng chậu (nhện bỏ mạng, nằm bò). **Chạm để bắt → túi côn trùng** (`insects`). **Không còn trừ nông sản vì sâu.** Thu hoạch thì con chưa bắt bay mất.
    Kích thước chuẩn hoá theo phần đang hiện (`INSECT_SIZE` 0,42). **Phần bắt côn trùng người dùng sẽ tự thử lại.**
  - HUD: trái = thoát + **cấp + thanh kinh nghiệm**; phải = [📖 Cẩm nang] [🧺 Túi đồ] [gacha]. **Túi đồ** (popup, 3 tab Nông sản (bán từng loại / bán tất cả, đang có n xu) / Hạt giống / Côn trùng), **Cẩm nang** (cách chơi + bảng cây có tag hạng).
- Ghi chú lúc chốt GĐ4 (giữ để tham khảo; phần dưới đã làm, trừ cửa hàng):
  - **Lướt ngón tay qua nhiều chậu = gieo liên tục mọi chậu trống đi qua** (không phải mỗi lần kéo 1 chậu).
  - **Chỉ dùng hạt đang có trong túi** (`seeds`, nhận từ gacha / mua ở cửa hàng); **hết hạt thì bao biến mất, phải đi mua** (KHÔNG tự trừ lông chim khi gieo).
  - Bao hạt biến mất khi: hết hạt, chạm chỗ trống, bấm nút X, chuyển tầng.
  - Danh sách hạt = dải cuộn ngang ở đáy (giống danh sách chậu): bao hạt, tên cây, số hạt đang có; cây chưa đủ cấp thì mờ.
  - **Đổi dữ liệu trồng cây**: bỏ `plots[12]` (chỉ tầng 1), lưu cây theo chỗ đặt chậu `plants["<tầng>-<chỗ>"]` = `{ crop, plantedAt, watered, bugCleared }`;
    Dời chậu thì cây đi theo, cất chậu thì mất cây (như hiện tại). **Người dùng đã đồng ý: dữ liệu `plots` / `unlocked` của bảng 2D cũ KHÔNG quan trọng,
    làm theo cách dễ code nhất cho game 3D** (không cần chuyển dữ liệu cũ; được bỏ trang 2D cũ `/garden/farm` + `plots` / `unlocked` / `buyPlot`).
  - **Mô hình túi hạt giống (ĐÃ LÀM)**: collection `TuiHatGiong` trong `tang-may.blend` (hàng mẫu x 9, y −26), xuất `public/models/tui-hat.glb` (~40KB, meshopt, CÓ UV).
    Ảnh xem thử `design/vuon-may/tui-hat-giong.png` (4 màu + nhãn tạm). Dựng bằng `tui_hat.py` (`design/vuon-may/scripts/`). Cây:
    ```
    TuiHat (Empty, gốc ở GIỮA túi: tiện lơ lửng / kéo thả; túi cao ~0,7, rộng ~0,54)
      TuiHat_Than   túi giấy dạng gối (phồng giữa, đáy bo, hẹp dần lên miệng, nếp nhăn nhẹ) + dải dán miệng răng cưa + chỉ khâu nét đứt 2 mặt
                    vật liệu: TuiHat_Than (sáng màu → code tô màu theo `CROPS[].color`), TuiHat_Mieng (code tô đậm hơn ~0,7), TuiHat_Chi (giữ màu kem)
      TuiHat_Nhan   nhãn mặt trước TO, phủ gần hết mặt túi (rộng ~0,47, cao ~0,51; mặt -Y Blender = +Z three), lưới uốn theo mặt túi, UV 0..1, vật liệu TuiHat_Nhan trắng → code gán `map` = ảnh nhãn
                    (nền kem + viền + icon cây, vẽ bằng canvas từ `public/game/cay/<id>.webp`)
    ```
    **Icon cây (ĐÃ LÀM)**: `public/game/cay/<id>.webp` (id như `CROPS`, 8 cây; 256px nền trong, cắt sát hình) = ảnh giai đoạn chín `_GD3` (không chậu),
    chụp bằng `ns["render_crop"](<Cay_Ten>, path)` trong `h2.py` (trực giao nghiêng 18°, render 384px rồi cắt vuông + thu nhỏ bằng Pillow). Thêm cây mới thì chụp thêm cùng cách.
    **Nhãn: cây vẽ TO, tràn mép (bị cắt cũng được)**: ảnh nhãn vuông, nền kem + 1 viền nâu mảnh, icon vẽ cỡ ~1,18 lần cạnh nhãn, căn giữa.
    Ảnh xem thử 8 túi đã dán nhãn: thân túi màu `from-*` của `CROPS`, miệng ×0,5: `design/vuon-may/tui-hat-8-cay.png`.
  Ghi chú lúc đề xuất (giữ để tham khảo):
  - **Cách gieo (người dùng mô tả)**: chạm 1 chậu chưa gieo → hiện **danh sách hạt giống** → chọn 1 loại → **bao hạt giống** của loại đó hiện **lơ lửng phía trên chậu**
    (gieo luôn vào chậu đó) → người chơi **kéo bao hạt sang các chậu trống khác** để gieo tiếp. Mỗi loại cây có **item "bao hạt giống" riêng**.
  - **Mô hình bao hạt (đề xuất)**: CHỈ 1 mô hình 3D túi hạt (Blender, `public/models/tui-hat.glb`, nhẹ) có 1 mặt nhãn riêng; màu túi tô theo `CROPS[].color`,
    nhãn = ảnh icon cây dán bằng texture trong code → 1 mô hình ra đủ mọi loại bao (thêm cây mới không phải dựng lại).
    Icon cây = ảnh render giai đoạn chín của từng cây (`public/game/cay/<id>.webp`), dùng chung cho danh sách hạt, kho, nhiệm vụ…;
    ảnh bao hạt trong danh sách (2D) = ảnh túi nền + icon cây chồng lên bằng CSS (không phải render từng bao).
  - **Bất cập đã nêu, cần chốt**: (1) kéo bao lẫn với xoay camera 1 ngón → chạm bắt đầu trên bao = kéo bao, chỗ khác = xoay;
    (2) chậu nhỏ / bị che khi thu xa → "hút" vào chậu trống gần ngón tay nhất trong bán kính trên màn hình, chậu nhận được thì sáng viền;
    (3) kéo **lướt qua nhiều chậu gieo liên tục** hay mỗi lần kéo chỉ 1 chậu; (4) **hết hạt giữa chừng**: hạt lấy từ túi (gacha) hay tự mua bằng lông chim mỗi lần gieo;
    (5) mỗi chậu 1 lần ghi Firestore là chậm → gom các chậu đã gieo trong 1 lần kéo rồi ghi 1 transaction lúc thả tay (hiện trước trên màn hình);
    (6) bao hạt biến mất khi nào (chạm chỗ trống / nút X / chuyển tầng); (7) ngón tay che bao → bao nổi lệch lên trên ngón tay;
    (8) dữ liệu hiện chỉ có `plots[12]` cho tầng 1 → đổi sang cây theo chỗ đặt chậu `"<tầng>-<chỗ>"` để gieo được ở tầng 2–4;
    (9) chạm chậu đang có cây: chín = thu hoạch, chưa chín = tưới / bắt sâu (không mở danh sách hạt).
- [x] **Lông chim + Cửa hàng ĐÃ LÀM** (bước 1–2 của phần tiền tệ; bước 3 kinh nghiệm riêng + đá khi lên cấp, bước 4 GĐ5 người dùng sẽ mô tả lại):
  - Vườn có thêm `feathers` (lông chim, vốn **100** `START_FEATHERS`; vườn cũ chưa có cũng được 100). **Bán nông sản (Túi đồ) cộng lông chim** (`sell`), giá giữ `sellPrice` của `CROPS`.
    `coins` (xu cũ) **giữ nguyên, không cộng / trừ nữa**, vẫn hiện ở menu Giải trí (`GardenStats`).
  - **Cửa hàng** (popup `ShopPopup` trong `game/GardenPopups.tsx`, nút 🛒 ở HUD): liệt kê hạt **hạng B** (`CROPS` có `rank === 'B'`), mỗi dòng: ảnh túi, tag hạng, tên,
    giá / hạt (`seedPrice` lông chim), số hạt đang có, 2 nút bằng nhau **[Mua 1] [Mua 10]** (ghi giá); cây chưa đủ cấp mờ + "Cần cấp n", không đủ lông chim thì nút mờ.
    Mua = `buySeeds(actor, crop, n)` (transaction: chỉ hạng B, đủ cấp, đủ lông chim → trừ lông chim, cộng `seeds`).
  - HUD: **giữa = 2 ô bằng nhau [đá vũ trụ] [lông chim]** (`STONE_IMG`, `FEATHER_IMG` trong `GachaUi.tsx`); **phải = [📖 Cẩm nang] [🛒 Cửa hàng] [gacha] [🧺 Túi đồ]** (hòm thư chưa có).
    Số lông chim trong chữ dùng `Feathers` (số + icon lông chim).
- [ ] **Tiền trong game + cục roll (ĐÃ CHỐT phần dưới, phần lông chim + cửa hàng ĐÃ LÀM ở trên, còn lại CHƯA LÀM)**:
  - **Bỏ xu trong game Vườn mây, chỉ còn 2 loại tiền**: **Lông chim** và **Đá vũ trụ**. **Mua hạt và bán nông sản dùng LÔNG CHIM.**
    **Xu + cấp độ cũ đang hiện ở menu app Giải trí (`GardenStats`) GIỮ NGUYÊN, KHÔNG SỬA.** Lông chim, đá vũ trụ và **kinh nghiệm của game làm RIÊNG** và **hiển thị trong game**.
  - **Lông chim**: nâng cấp chậu (**côn trùng + lông chim**, lông chim thay chỗ xu), mua hạt. Kiếm từ: **bán nông sản**, **nhiệm vụ hằng ngày**, **đổi từ đá vũ trụ**.
  - **Đá vũ trụ**: mua cục roll. Kiếm từ: **tặng khi lên cấp**, **bán sản phẩm của máy chế tạo**, **nhiệm vụ hằng ngày**.
  - Nhiệm vụ hằng ngày, vd 1 nhiệm vụ thưởng **20 lông chim + 16 đá vũ trụ**. **Không nạp tiền thật.**
  - **Cục roll** (vật phẩm quay gacha), 2 loại **làm giống hệt nhau, chỉ khác màu**: **"Sao Duyên"** = banner 1, ánh sáng **xanh biển trắng**;
    **"Vọng Tinh"** = banner 2, ánh sáng **vàng trắng**. Hình **khối chữ nhật, bên trong có ngôi sao phát sáng**. **Giá 16 đá vũ trụ / cục, 2 loại bằng giá.** **Cho quay 10 lần 1 lượt.**
  - **Chậu tặng sẵn khi bắt đầu: chỉ bộ Đất nung** (bỏ các bộ khác khỏi `STARTER_SETS` khi làm phần này; các bộ khác lấy qua gacha).
  - **Kinh nghiệm game mới** (riêng, bắt đầu từ 0): **mở tầng theo cấp game mới** (tầng 2 / 3 / 4 ở cấp 5 / 10 / 15), công thức lên cấp giữ như `levelOf`.
  - **Giá hạt / giá bán nông sản**: giữ đúng các con số hiện có trong `CROPS`, chỉ đổi đơn vị xu → **lông chim**.
  - **Vốn ban đầu**: **100 lông chim + 32 đá vũ trụ**, và **tặng 20 Vọng Tinh qua HÒM THƯ** (thư quà chào mừng, bấm nhận).
  - **Đổi đá → lông chim: 1 đá = 5 lông chim**, chỉ 1 chiều.
  - **Đá tặng khi lên cấp: 16 đá / cấp; cấp 5 / 10 / 15 (mốc mở tầng) tặng 160 đá.** → **Đổi (20/11/2026): thưởng lên cấp (đá + lông chim) NHẬN Ở POPUP THÀNH TỰU**, không tự cộng (xem mục "Thành tựu" bên dưới).
  - **Nâng cấp chậu** (côn trùng loại nào cũng được + lông chim), hạng A giá ×1,5, hạng S ×2 — **SẮP BỊ THAY bởi "Nâng cấp chậu có tỉ lệ (GĐ5)" (đề xuất 20/11/2026)**:
    | Lên cấp | Côn trùng | Lông chim |
    |---|---|---|
    | 1→2 | 2 | 50 |
    | 2→3 | 4 | 100 |
    | 3→4 | 6 | 200 |
    | 4→5 | 8 | 400 |
    | 5→6 | 10 | 800 |
  - **Quay 10 lần = 160 đá** (không giảm giá). Tỉ lệ / đảm bảo trong banner: chờ người dùng mô tả gacha.
  - **Nhiệm vụ hằng ngày: mỗi ngày 5 nhiệm vụ NGẪU NHIÊN**, độ khó tăng theo **số tầng đã mở** (đề xuất, xem danh sách dưới).
  - **HUD trong game**: **trái** = nút thoát + **cấp + thanh kinh nghiệm**; **giữa** = **đá vũ trụ + lông chim**;
    **phải** = các nút CHỈ CÓ ICON: **cửa hàng, hòm thư, gacha, túi đồ**. Số Sao Duyên / Vọng Tinh hiện trong màn hình gacha.
    (Chốt 20/11/2026: thêm nút **🏆 Thành tựu**, GIỮ hòm thư (gửi bằng script); các nút gom vào **menu ☰** — xem mục "HUD menu ☰".)
  - **Icon tiền (ĐÃ LÀM, dựng trong Blender, CHỈ xuất ảnh — không đưa mô hình 3D vào game)**: collection `TienTe` (`Tien_LongChim`, `Tien_DaVuTru`; ảnh xem `design/vuon-may/tien-te.png`).
    **Lông chim** = lông vũ cong, phiến trắng ngà chuyển tím nhạt ở đầu lông (màu chuyển theo trục cục bộ bằng ColorRamp), 2 khe tách tơ mỗi bên, cọng vàng nhạt, lông tơ ở gốc, 3 ngôi sao lấp lánh 4 cánh.
    **Đá vũ trụ** = tinh thể 2 chóp nhiều mặt cắt tam giác (vòng 8 cạnh lệch góc), màu tinh vân xanh dương → tím → hồng, trong mờ, lõi sáng + quầng + đốm sao li ti bên trong, 3 ngôi sao lấp lánh.
    Icon `public/game/tien/long_chim.webp` / `da_vu_tru.webp` (128px, cắt sát hình, ~10–13KB), render kiểu ghép 2 lần giữ quầng sáng như cục roll; đã xem thử ở cỡ 24 / 32 / 48px.
  - **Cục roll dựng trong Blender** (collection `CucRoll`), phát sáng nhè nhẹ: khối chữ nhật pha lê trong mờ bo cạnh + khung bạc mảnh; bên trong là **QUẢ CẦU SÁNG TRÒN có các TIA SÁNG** (KHÔNG dùng ngôi sao 5 cánh) + **1 HÀNH TINH NHỎ MÀU ĐEN** lơ lửng bên cạnh.
    **ĐÃ DỰNG** (ảnh `design/vuon-may/cuc-roll.png`): `Roll_SaoDuyen` / `Roll_VongTinh` (Empty, thuộc tính `ten`, `banner` 1 / 2), hàng mẫu ngoài mây (x 9 / 10,2; y −18). Con:
    `_Vo` (**khối LẬP PHƯƠNG thủy tinh trong suốt** cạnh 0,6, bo cạnh 0,05, **KHÔNG có khung viền**; trong Blender độ trong theo góc nhìn (fresnel: giữa 5%, viền 42%), file .glb dùng độ trong cố định 15% — trong game nên làm lại fresnel bằng shader), `_Loi` (quả cầu sáng), `_Quang` + `_Quang2` + `_Quang3` (3 lớp quầng sáng mờ dần ra ngoài — giả hiệu ứng toả sáng, dùng được cả trong game không cần bloom), `_Tia` (16 tia dài / ngắn xen kẽ),
    `_HanhTinh` (cầu đen bóng) + `_VanhHT` (vành mảnh ánh màu), `_Dom` (12 đốm sáng li ti); các bộ phận động có thuộc tính `anim`. Vật liệu `Roll_<Ten>_*` (chỉ khác màu), `Roll_Khung`, `Roll_HanhTinhDen`.
    Xuất `public/models/cuc-roll.glb` (~95KB, meshopt) + icon `public/game/roll/sao_duyen.webp` / `vong_tinh.webp` (256px, render tông màu **Standard** — tông AgX làm màu phát sáng bị bạc).
    **Icon giữ quầng sáng trên nền trong suốt**: cảnh có compositor `NenSang` (Glare kiểu Bloom); render nền trong suốt thì mất phần sáng tràn ra ngoài vật,
    nên render 2 lần (nền trong suốt + nền đen tắt trời) rồi ghép: alpha = max(alpha vật, độ sáng ảnh nền đen), màu = ảnh nền đen chia alpha.
    Trong game muốn sáng như icon thì cần thêm bloom (postprocessing) hoặc dựa vào 3 lớp quầng.
  - **Nhiệm vụ hằng ngày (ĐÃ CHỐT)**: mỗi ngày (làm mới 0 giờ) bốc **5 nhiệm vụ khác loại** từ bảng dưới, cố định theo ngày + người chơi;
    **bậc = số tầng đã mở** (1–4), con số theo bậc 1 / 2 / 3 / 4. Nhiệm vụ cần thứ chưa có (máy chế tạo, nâng cấp chậu…) thì chỉ bốc khi đã có chức năng đó.
    | Nhiệm vụ | Bậc 1 | Bậc 2 | Bậc 3 | Bậc 4 |
    |---|---|---|---|---|
    | Gieo hạt | 3 | 6 | 10 | 15 |
    | Tưới cây | 3 | 6 | 10 | 15 |
    | Thu hoạch nông sản | 5 | 12 | 20 | 32 |
    | Thu hoạch 1 loại cây chỉ định (loại đã mở) | 2 | 4 | 6 | 8 |
    | Bán nông sản | 5 | 12 | 20 | 35 |
    | Kiếm lông chim từ bán nông sản | 40 | 100 | 200 | 350 |
    | Bắt côn trùng | 1 | 3 | 5 | 8 |
    | Bắt 1 loại côn trùng chỉ định | 1 | 2 | 3 | 4 |
    | Thu hoạch ở tầng chỉ định (tầng đã mở) | — | 4 | 8 | 12 |
    | Chế tạo sản phẩm ở máy | 1 | 3 | 5 | 8 |
    | Nâng cấp chậu | — | 1 | 1 | 2 |
    | Thu hoạch cây hạng cao (cây mở ở cấp ≥ 5) | — | 2 | 4 | 6 |
    Thưởng mỗi nhiệm vụ (**×2, chốt 20/11/2026**): bậc 1 **40 lông chim + 32 đá**, bậc 2 50 + 32, bậc 3 60 + 48, bậc 4 80 + 64. **Xong cả 5 nhiệm vụ trong ngày: thưởng thêm 2 Sao Duyên** (×2; chờ người dùng xác nhận có nhân đôi Sao Duyên không).
    Xong nhiệm vụ thì bấm nhận thưởng (không tự cộng), ngày qua thì nhiệm vụ cũ mất.
- [ ] **Gacha (ĐÃ CHỐT, CHƯA LÀM — làm SAU khi có các bộ chậu hạng S)**:
  - **ĐÃ LÀM (bản đầu — banner CHẬU, dùng Vọng Tinh)**: nút tròn có hình Vọng Tinh ở góc phải trên HUD + ô đá vũ trụ ở giữa trên → `GachaScreen` (`game/GachaUi.tsx`, phủ kín khung game):
    banner (tên bộ S, tháng, 6 chậu cấp 6, số lần còn tới vàng chắc chắn, bảo hiểm), số Vọng Tinh / Sao Duyên / đá, **nhận quà chào mừng 20 Vọng Tinh** (tạm nhận tại đây, chưa có hòm thư),
    **đổi 1 / 10 Vọng Tinh** (16 đá / cục), **Quay ×1 / ×10**, bảng "Tỉ lệ" (quy tắc + tỉ lệ) và "Lịch sử" (100 lần gần nhất). Quay = `pullPots` (`data/api.ts`, 1 transaction: trừ roll, quay, ghi kết quả + lịch sử)
    → **`RollReveal`** (`game/RollReveal.tsx`, hiệu ứng ở trên, tự vỡ không cần chạm) → hiện từng món (chạm để tiếp, "Bỏ qua") → tổng kết 2×5 [Xong] [Quay tiếp].
    Logic ở `data/gacha.ts` (`pullMany`, `goldRate`, `bannerOf`; lịch banner `BANNER_SETS` xoay theo tháng từ 11/2026, hiện chỉ có Phượng Hoàng; vàng lệch lấy từ các bộ S không có trong lịch `OFF_SETS` = Sứ Lam, Băng Tinh).
    Đã mô phỏng 300.000 lần: lâu nhất 74 lần ra vàng, ≤ 9 lần liền không tím, sau lệch không bao giờ lệch tiếp, trung bình ~63 lần / vàng.
    Vườn có thêm `stones` (mặc định 32), `rolls` { sao_duyen, vong_tinh }, `gift`, `seeds` (hạt nhận từ gacha, **chưa dùng để gieo**), `insects` (côn trùng, chưa dùng), `gacha` { sinceGold, sincePurple, insured, total }, `pullLog`.
    **Hạt giống chỉ rơi 8 cây đang có trong `CROPS`** (cây hiếm thêm sau), chia theo hạng B / A / S (xem GĐ4). **`STARTER_SETS` = chỉ Đất nung** (vườn đã lưu 10 bộ tặng thử trước đây vẫn giữ). Chưa có: banner Sao Duyên, hòm thư, cách kiếm thêm đá, lông chim.
    **TẠM để test**: tài khoản trong `TESTER_UIDS` (`data/gacha.ts`) thấy nút "+100 Vọng Tinh (test)" trong màn hình gacha (`grantTestRolls`); gỡ khi làm xong phần tiền tệ.
    Icon nét côn trùng mới trong `GLYPHS`: 🐞 bọ rùa, 🦋 bướm, 🕷 nhện, 🪲 đom đóm (🐛 sâu đã có).
  - **KHÔNG có sổ tay cách trồng** (đã bỏ). **Đủ cấp + có hạt giống là trồng được.** Hạt giống mua bằng **lông chim**;
    **nhiều loại hạt HIẾM chỉ rơi từ gacha, KHÔNG bán ở cửa hàng** (tỉ lệ rơi khác nhau theo độ hiếm, xem bảng dưới).
  - **2 banner, 2 bộ đếm RIÊNG**: **banner 1 = đồ trang trí, dùng Sao Duyên** (hệ thống đồ trang trí + cơ chế mô tả sau); **banner 2 = chậu, dùng Vọng Tinh**.
  - **Banner chậu**: mỗi đợt **1 tháng**, chỉ định **1 bộ chậu hạng S** (cần ≥ 2 bộ S để có "vàng ngoài banner"); lịch ghi sẵn trong code, xoay vòng các bộ S.
    1 lần quay = 1 Vọng Tinh; quay 10 lần 1 lượt tỉ lệ y như 10 lần lẻ.
  - **Tỉ lệ mỗi lần quay**: vàng (chậu S) **0,08%**; tím (**chậu A**) **6%**; chậu B **14%**; **10 hạt giống** **30%**; côn trùng (bọ rùa, sâu, đom đóm, nhện, **bươm bướm**) phần còn lại ≈ 50%, chia đều.
  - **Bảo đảm tím**: 10 lần quay chắc chắn có ≥ 1 tím; **ra vàng cũng tính là ra tím**.
  - **Tăng tỉ lệ vàng (đếm từ lần ra vàng gần nhất)**: lần 1–59: 0,08%; **lần 60–63: 10%**; **lần 64–79 tăng dần** (10% + 6% × (n − 63), tức 16%, 22% … 100% ở lần 79);
    **lần 80 chắc chắn vàng** (thực tế đã đạt 100% ở lần 79 — giữ mốc 80 làm chốt chặn).
  - **Khi ra vàng**: **33%** vàng ngoài banner (lệch), **33%** vàng TRÙNG chậu đã có của bộ được chỉ định (lệch; chưa có chậu nào của bộ thì không tính lệch → thành chậu mới),
    **34%** vàng MỚI của bộ. **Lệch thì có bảo hiểm: lần vàng kế tiếp chắc chắn là chậu mới của bộ.**
    **Đủ bộ thì "reset"**: bắt đầu vòng 2, chậu nào chưa có bản thứ 2 thì KHÔNG tính trùng; tới khi lại gặp bản trùng lần nữa (bản thứ 3…) mới tính trùng (vòng 3, …).
    **Chậu trùng cứ giữ lại** (đặt ở tầng khác để có hiệu ứng cho tầng đó).
  - **Bộ đếm lần quay + bảo hiểm giữ nguyên khi đổi sang banner mới** (mỗi banner 1 / 2 một bộ đếm riêng).
  - **Hiệu ứng lúc vừa bấm quay (ĐÃ CHỐT)** — quay 1 hay 10 lần đều chỉ **1 cục roll** (đúng loại: Vọng Tinh / Sao Duyên), màu báo theo **món hiếm nhất**:
    1. **Màn hình tối, cục roll ĐÃ CÓ SẴN giữa màn hình nhưng CHÌM TRONG BÓNG TỐI** (KHÔNG loé sáng, KHÔNG phóng to cục roll từ nút quay): kính, hành tinh, đèn phụ, phản chiếu môi trường
       (`scene.environmentIntensity`) theo bình phương độ sáng trời (`lit2`), lõi sáng theo `lit³` → trăng mới ló thì cục roll gần như vô hình, trăng vào nhiều mới rõ dần.
    2. **Mặt trăng trôi 1 MẠCH từ ngoài mép phải tới đúng chỗ thẳng hàng, KHÔNG dừng giữa chừng** (đoạn lọt vào màn hình ~2,3 giây đi chậm đều, sau đó tăng tốc mượt rồi chậm dần khi khớp hàng).
       **Quầng sáng quanh trăng có mặt từ đầu và ló vào mép phải TRƯỚC đĩa trăng** (khu vực trăng sắp xuất hiện sáng hơn chỗ khác; trăng vào tới đâu đã có viền sáng tới đó).
       **Bầu trời / sao / bụi sáng dần theo PHẦN DIỆN TÍCH quầng (40%) + đĩa trăng (60%) đã lọt vào màn hình** (`onScreen`, lấy mẫu đĩa tròn); **ánh trăng chiếu lên khối kính**: đèn đặt theo hướng trăng + phản chiếu môi trường
       mạnh dần theo độ sáng trời → mặt kính sáng dần, vệt sáng trượt trên các mặt / cạnh kính khi trăng di chuyển; lõi sáng của cục roll cũng sáng dần.
    3. **Thẳng hàng**: trăng tới sau cục roll, hành tinh đen trong khối trôi ra trước quả cầu sáng → **trăng – quả cầu – hành tinh thẳng hàng** nhìn từ màn hình;
       tia sáng dài dần, cục roll rung nhẹ, kính nứt dần. **Nâng màu bất ngờ**: tia đang xanh có thể chuyển tím giữa chừng.
    4. Thẳng hàng xong thì **khối thủy tinh TỰ VỠ (~0,5 giây sau, KHÔNG cần chạm)** thành mảnh, **ánh sáng bùng lên theo màu**: xanh biển (thường) / tím (chậu A, thêm vòng sóng sáng)
       / **vàng = nhật thực**: hành tinh che kín quả cầu, tối ~0,4s, rồi vành vàng bừng quanh mép hành tinh tràn trắng màn hình (tím có thể nâng thành vàng đúng lúc này).
    5. Bay ra 1 / 10 điểm sáng theo màu từng món → màn hiện từng món (chạm để sang món tiếp) → bảng tổng kết 2×5. Có nút **Bỏ qua**.
    Ánh sáng bằng các lớp quầng + lớp phủ màu toàn màn hình (không bloom). Kết quả quay ghi Firestore TRƯỚC khi phát hiệu ứng.
    **Chiều sâu 3D** (`RollReveal.tsx`): camera bay vòng nhẹ quanh cục roll (`camAt`: từ trái-trên vòng sang phải, lại gần dần) nên trăng / sao / bụi sáng trượt lệch nhau;
    cục roll nghiêng 3/4 (thấy 3 mặt), lật chậm; kính phản chiếu môi trường (`RoomEnvironment`) + viền đục sáng theo góc nhìn (fresnel bằng `onBeforeCompile`); hành tinh đen bóng;
    **mặt trăng là ĐĨA SÁNG đơn giản** (người dùng không muốn trăng 3D), vị trí tính THEO KHUNG NHÌN (trăng ở rất xa, không lệch khi camera bay):
    trôi vào từ ngoài mép phải theo 1 cung mượt lên góc trên bên phải, rồi trôi đều vào đúng sau quả cầu; mảnh kính là lăng trụ có độ dày, vài mảnh bay sượt qua camera; 260 hạt bụi sáng nhiều lớp xa gần.
    Phần phát sáng của cục roll (lõi, quầng, tia, đốm) dùng `MeshBasicMaterial` (không chịu đèn) để giữ đúng màu gợi ý.
  - **Hiệu ứng che màn hình khi ra vàng / tím.** Màn hình banner: xem **quy tắc quay + tỉ lệ rơi từng vật phẩm**, xem **lịch sử đã quay được gì**; số Sao Duyên / Vọng Tinh hiện ở đây.
  - **Độ hiếm hạt giống (ĐÃ DUYỆT)** — mỗi lần rơi "10 hạt giống" là 10 hạt CÙNG 1 loại; trong suất 30% hạt giống chia theo độ hiếm, trong cùng độ hiếm chia đều:
    | Độ hiếm | Cây | Bán ở cửa hàng | Tỉ lệ trong suất hạt | ≈ mỗi lần quay (mỗi loại) |
    |---|---|---|---|---|
    | Thường | cải, cà rốt, cà chua, ngô, dâu, hướng dương, dưa hấu, bí ngô, **mía** | Có | 60% | 2% |
    | Hiếm | đậu phộng, chanh, trà, bạc hà | Không | 28% | 2,1% |
    | Rất hiếm | ca cao, cà phê, vani, nho, việt quất, mâm xôi | Không | 10% | 0,5% |
    | Cực hiếm | hoa hồng, oải hương, hoa nhài | Không | 2% | 0,2% |
    Mía để loại Thường + bán ở cửa hàng vì là "đường" dùng trong rất nhiều công thức ở máy mèo / thỏ (hiếm thì máy gần như không chạy được). Hạt hiếm vẫn cần đủ cấp mới trồng.
  - **Kế hoạch làm chậu hạng S (theo thứ tự)**: B1 bộ S **lệch rate 1**, B2 bộ S **lệch rate 2** (2 bộ "vàng ngoài banner": **chỉ cần đẹp hơn hạng A một chút**);
    B3–B8 **6 bộ chậu banner** (banner chậu 1 → 6, mỗi bộ cấp 1–6): **phải chăm chút kỹ, đẹp, tinh tế, thu hút người chơi quay**.
  - **Bươm bướm** = côn trùng mới (cần dựng mô hình), dùng để nâng cấp chậu như 4 loại kia.
  - **Quay chạy trên điện thoại rồi ghi vào Firestore** (không có máy chủ riêng; chấp nhận được với app gia đình, không nạp tiền thật).
- [x] **Thành tựu — popup kiểu màn hình ước nguyện (ĐÃ CHỐT + ĐÃ LÀM 20/11/2026, trừ tab "Hôm nay" / nhóm Chế tạo; code xem "THỨ TỰ CODE" bước 2)**:
  - **Yêu cầu**: 1 popup giống popup ước nguyện (gacha) hiện các **thành tựu + tiến độ hiện tại**; xong thì **bấm nhận thưởng ở đây** (không tự cộng).
    **Thưởng lên cấp cũng nằm ở đây** (nhóm Thăng tiến). **Nhiệm vụ hằng ngày = tab "Hôm nay" đầu tiên** của popup này (không thêm nút riêng).
  - **Giao diện**: phủ kín khung game như `GachaScreen` (cùng nền trời, kiểu glass). Thanh trên: tiêu đề "Thành tựu", "đã xong n/m", nút **[Nhận tất cả]**, nút X.
    **Cột trái = tab nhóm** (dọc, rộng ~96px, mỗi tab chấm đỏ + số thưởng chờ nhận); **bên phải = danh sách** cuộn dọc bằng `DragScroll` (không dùng cuộn gốc), mỗi dòng cao cố định ~64px.
    **Thành tựu nhiều bậc gộp thành 1 dòng** (vd "Nông dân chăm chỉ III": thanh 87/200, các phần thưởng, nút **[Nhận]**); nhận xong dòng lên bậc kế; hết bậc thì "Hoàn thành ✓" mờ.
    Thứ tự: **có thể nhận → đang làm → đã xong**. Nhận thì số tiền bay lên ô tiền ở HUD. **Nút 🏆 trên HUD có chấm đỏ + số thưởng chờ**; đạt thành tựu lúc đang chơi thì dòng nhắc "Đạt thành tựu: …".
    Thành tựu của chức năng chưa có (máy chế tạo, nâng cấp chậu, cây hạng A / S, đồ trang trí) **ẩn** tới khi có chức năng.
  - **Thưởng theo bậc (= 2 lần đề xuất đầu; roll ở thành tựu lớn = 2 lần đề xuất trước) — chốt 20/11/2026**:
    | Bậc | I | II | III | IV | V | VI | VII |
    |---|---|---|---|---|---|---|---|
    | Lông chim | 40 | 80 | 160 | 300 | 600 | 1.000 | 1.600 |
    | Đá vũ trụ | 16 | 32 | 48 | 64 | 96 | 128 | 160 |
    | Cục roll (thành tựu lớn) | — | — | — | — | +2 Vọng Tinh | +4 Vọng Tinh +2 Sao Duyên | +6 Vọng Tinh +4 Sao Duyên |
    Ước lượng tổng từ thành tựu (không tính Thăng tiến) ≈ 7.200 đá + roll ở bậc V–VII. Người dùng chấp nhận rộng tay: sẽ ra banner / bộ chậu mới liên tục.
  - **Các nhóm (đã chốt)**:
    1. **Thăng tiến** (đổi tên từ "Cấp độ"):
       - "Chào mừng tới Vườn mây": nhận **20 Vọng Tinh** (thay nút nhận quà ở màn hình gacha).
       - **Lên cấp L** (mỗi cấp 1 lần nhận): **16 đá + 10·L lông chim + 10 Vọng Tinh + 5 Sao Duyên**.
       - **Cấp 5 / 10 / 15 (mở tầng)**: **160 đá + 200 lông chim + 30 Vọng Tinh + 20 Sao Duyên**, **THAY CHO** thưởng cấp thường của cấp đó (không cộng).
       - **Sau cấp 15 vẫn thưởng mỗi cấp** như trên, tới **cấp tối đa 90** (Thăng tiến không nhân 2, giữ đúng số người dùng đưa).
    2. **Thu hoạch** (giải thích chi tiết, đã gửi người dùng):
       - **"Nông dân chăm chỉ" (I–VII)**: tổng **số NÔNG SẢN** đã thu (không phải số lần): 50 / 200 / 500 / 1.000 / 2.500 / 5.000 / 10.000.
         Vd thu 1 chậu cà rốt có tưới = 3 + 1 = 4 nông sản; sau này Bội thu / Mùa may làm ra thêm nông sản cũng được tính.
       - **"Bậc thầy <tên cây>" (I–III), mỗi loại cây 1 dòng**: số **LẦN thu hoạch** (số chậu đã hái) loại cây đó: 10 / 50 / 200.
         Chỉ hiện dòng của cây đã đủ cấp trồng (hiện 8 cây, sau GĐ8 thêm 14 cây). Mục đích: khuyến khích trồng nhiều loại thay vì chỉ cây ngắn ngày.
       - **"Vườn đa dạng" (I–IV)**: số **LOẠI cây khác nhau** đã từng thu hoạch: 4 / 8 / 16 / 22 (bậc III–IV chỉ đạt được sau GĐ8).
       - **"Hạt quý" (bậc III) / "Hạt huyền thoại" (bậc V)**: lần đầu thu hoạch 1 cây hạng A / hạng S (ẩn tới GĐ8, vì 8 cây hiện có đều hạng B).
    3. **Thu thập** (chậu; giải thích chi tiết, đã gửi người dùng):
       - **"Nhà sưu tầm chậu" (I–VI)**: số **LOẠI chậu khác nhau** đã sở hữu (2 chậu giống nhau tính 1): **6 / 12 / 24 / 36 / 48 / tất cả loại đang có trong game**
         **Giữ mốc cuối = 60 loại** (người dùng chốt: hiện có 58 loại, sẽ ra banner / bộ mới liên tục nên sau này đạt được). Bậc I đạt ngay lúc bắt đầu (bộ Đất nung tặng sẵn) = quà nhập môn.
       - **"Trọn bộ <tên bộ>"**, mỗi bộ 1 dòng, đủ mọi chậu của bộ (cấp nào cũng được): hạng B = thưởng bậc III, hạng A = bậc V, hạng S = bậc VII (đã gồm cục roll).
         Trọn bộ Đất nung đạt ngay lúc bắt đầu.
       - **"Chậu quý" (III) / "Chậu huyền thoại" (V)**: lần đầu có 1 chậu hạng A / hạng S.
       - **"Vườn kín chỗ" (II)**: lần đầu đặt kín mọi chỗ của 1 tầng (tầng 1 có 12 chỗ, bắt đầu chỉ có 6 chậu → cần thêm chậu từ gacha).
       - **"Hiệu ứng trọn bộ" (IV)**: lần đầu đặt đủ 1 bộ trên CÙNG 1 tầng (kích hoạt thưởng đủ bộ).
       - Sau GĐ5: "Chậu tinh xảo" (1 chậu lên lv6), "Bộ hoàn mỹ" (cả 1 bộ lên lv6).
    4. **Chăm sóc** (gộp Chăm sóc + Côn trùng): gieo hạt 20 / 100 / 500 / 2.000 (I–IV); tưới cây 20 / 100 / 500 / 2.000 (I–IV);
       bắt côn trùng tổng 10 / 50 / 200 / 500 / 1.000 (I–V); mỗi loại (sâu, bọ rùa, đom đóm, nhện, bướm) 10 / 50 / 150 (I–III); "Nhà côn trùng học": đã bắt đủ 5 loại (II).
    5. **Buôn bán**: lông chim kiếm từ bán nông sản 500 / 2.000 / 10.000 / 50.000 (I–IV); số hạt mua ở cửa hàng 50 / 200 / 1.000 (I–III).
    6. **Ước nguyện**: tổng số lần quay 10 / 50 / 100 / 300 / 500 (I–V); ra vàng lần đầu (III).
    7. (Sau) **Chế tạo** (GĐ6), **Hôm nay** = nhiệm vụ hằng ngày + "xong đủ 5 nhiệm vụ: 1 / 7 / 30 / 100 ngày" (I–IV).
  - **Dữ liệu & code**:
    - **MỌI thành tựu đều có BỘ ĐẾM riêng** (người dùng chốt, cho chính xác): vườn thêm **`stats`** = map tích luỹ, KHÔNG BAO GIỜ giảm:
      `harvestItems`, `harvestTimes_<cây>`, `harvestKinds` (mảng id cây đã thu), `sow`, `water`, `catch`, `catch_<loại>`, `soldFeathers`, `boughtSeeds`, `pulls`, `firstGold`,
      `potKinds` (mảng id loại chậu đã từng có), `fullTier` / `fullSetTier` (cờ "đã từng"), `level`… — cộng trong **CÙNG transaction** của `sow` / `water` / `harvestPlant` /
      `catchInsect` / `sell` / `buySeeds` / `pullPots` / `placePot` / `movePot` / nhận thư có chậu. Thành tựu chỉ đọc `stats` (không tính từ số đang có, vì côn trùng / lông chim / hạt bị tiêu).
    - Đã nhận tới đâu: **`claimed`** = map id thành tựu → số bậc đã nhận (Thăng tiến: cấp cao nhất đã nhận). `claimAchievement(id)` / `claimAll()` (transaction: tính lại từ dữ liệu server
      → không nhận trùng giữa 2 máy). Định nghĩa ở `data/achievements.ts` (`{ id, group, name, icon, tiers: [{ goal, reward }], progress(g) }`), thưởng = `{ feathers, stones, rolls }`.
    - **Kinh nghiệm: GIỮ `xp` hiện tại làm kinh nghiệm của game** (bỏ ý "kinh nghiệm riêng từ 0").
    - **Không cần chuyển dữ liệu cũ**: chưa có người chơi thật; sau khi thử nghiệm người dùng sẽ **xoá dữ liệu vườn các tài khoản đang chơi**.
    - Nút "Nhận quà chào mừng" ở `GachaScreen` + cờ `gift` chuyển sang thành tựu "Chào mừng"; nút "+100 Vọng Tinh (test)" thay bằng gửi thư (script).
  - **Đã chốt 20/11/2026**: thưởng mở tầng THAY THẾ thưởng cấp thường; thưởng bậc ×2 (không phải ×6), nhiệm vụ ngày ×2; sau cấp 15 vẫn thưởng mỗi cấp, cấp tối đa 90, từ cấp 40 rất khó lên;
    Sao Duyên cứ tích trữ (banner đồ trang trí chưa có); mốc "Nhà sưu tầm" giữ 60; sẽ có bộ chậu 5 / 4 chậu dành riêng tầng 3 / 4 (như Thiên hà).
  - **Chốt thêm 20/11/2026 (lượt 3, các bất cập a–f đều làm theo đề xuất)**:
    a. **Mốc Thăng tiến sau cấp 15: 20 / 30 / 40 / 50 / 60 / 70 / 80 / 90, thưởng TĂNG DẦN**, thay cho thưởng cấp thường của cấp đó (như mốc mở tầng). Con số (đề xuất, cân chỉnh được):
       | Cấp | 20 | 30 | 40 | 50 | 60 | 70 | 80 | 90 (tối đa) |
       |---|---|---|---|---|---|---|---|---|
       | Đá vũ trụ | 200 | 240 | 280 | 320 | 360 | 400 | 440 | 480 |
       | Lông chim | 400 | 600 | 800 | 1.000 | 1.200 | 1.400 | 1.600 | 2.000 |
       | Vọng Tinh | 35 | 40 | 45 | 50 | 55 | 60 | 65 | 80 |
       | Sao Duyên | 25 | 30 | 35 | 40 | 45 | 50 | 55 | 70 |
    b. **Thêm nguồn kinh nghiệm** (ngoài thu hoạch; con số đề xuất, cân chỉnh được): mỗi nhiệm vụ ngày bậc 1 / 2 / 3 / 4 = **20 / 40 / 80 / 150 kinh nghiệm**; **bắt 1 côn trùng = 2 kinh nghiệm**;
       chế tạo: mỗi sản phẩm ≈ ½ tổng kinh nghiệm thu hoạch của nguyên liệu (định khi làm GĐ6); **14 cây mới (GĐ8) rải cấp mở từ cấp 9 tới ~cấp 40**, cây lớn lâu cho kinh nghiệm cao hơn (cây 24 giờ ≈ 200–300).
    c. **GHI NHỚ khi cân banner**: Thăng tiến rất rộng tay (10 Vọng Tinh + 5 Sao Duyên mỗi cấp + các mốc → tới cấp 90 ≈ 1.300 Vọng Tinh + 800 Sao Duyên). Người dùng cố ý chấp nhận vì sẽ ra banner / bộ chậu mới liên tục.
    d. **"Nhà sưu tầm"**: khi game có > 60 loại chậu thì thêm bậc 80 / 100 / 150…; dòng "Trọn bộ <bộ>" tự sinh từ `POT_SETS` (không phải thêm tay).
    e. **Bộ 5 / 4 chậu (dành riêng tầng 3 / 4)**: mốc hiệu ứng riêng — bộ 5 chậu **2 / 4 / 5**, bộ 4 chậu **2 / 3 / 4** (như Thiên hà); khai báo `tiers` trong `POT_SETS` như Thiên hà.
    f. **Menu ☰**: làm theo đề xuất (xem mục "HUD menu ☰").
- [ ] **HUD menu ☰ (CHỐT 20/11/2026, CHƯA LÀM)**: các nút phải của HUD (Cẩm nang, Cửa hàng, 🏆 Thành tựu, Gacha, Túi đồ, ✉ Hòm thư) gom vào **1 nút chung ☰ (3 gạch)** ở góc phải trên.
  Bấm ☰ → **mở hết các nút, xếp lưới 2 nút / hàng** (3 hàng, nút bằng nhau) ngay dưới ☰; bấm lần nữa → chỉ còn ☰ (☰ đổi thành X khi đang mở).
  ĐÃ CHỐT: **chấm đỏ trên ☰** = tổng các chấm đỏ bên trong (thư, thành tựu, quà) để lúc đóng vẫn biết; **nhớ trạng thái đóng / mở** (localStorage);
  khi mở thì **lưới nằm bên TRÁI cột ▲ ▼** để không đè nút chuyển tầng (nếu vẫn chật trên iPhone 12 ngang thì dời ▲ ▼ xuống góc phải dưới); mở 1 popup thì tự đóng menu.
- [ ] **Hòm thư — gửi thư kèm quà bằng SCRIPT (ĐÃ CHỐT 20/11/2026, CHƯA LÀM)**: người dùng (quản trị) chạy script trên máy để gửi thư; người chơi mở hòm thư trong game, **bấm nhận quà**.
  - **Dữ liệu**: thư riêng `families/{familyId}/gardens/{uid}/mail/{mailId}` = `{ title, body, rewards: { feathers, stones, rolls: { vong_tinh, sao_duyen }, seeds: { id: n }, insects: { id: n }, pots: [kind] },
    from ("Vườn mây"), createdAt, expiresAt (null = không hết hạn), claimedAt (null = chưa nhận) }`.
    **Thư gửi tất cả** (kể cả người chơi mới sau này nếu muốn): `gardenBroadcasts/{id}` (cùng trường + `newPlayers: bool`), người chơi đọc được; đã nhận lưu ở `mailClaimed` (mảng id) của vườn.
  - **Firestore Rules**: người chơi chỉ **đọc** thư của mình + `gardenBroadcasts`, chỉ **sửa `claimedAt`** thư của mình; **không ai tạo thư từ app** (chỉ script dùng Admin SDK, bỏ qua Rules).
  - **Nhận quà** = `claimMail(id)` / `claimAllMail()` (transaction: kiểm tra chưa nhận + chưa hết hạn → cộng quà vào vườn (chậu: thêm `pots`, cộng `stats.potKinds`) → ghi `claimedAt`).
  - **Giao diện**: nút ✉ trên HUD (chấm đỏ + số thư chưa nhận) → popup kiểu Thành tựu: trái = danh sách thư (mới nhất trước, chưa nhận đậm, hết hạn mờ, "còn n ngày"), phải = nội dung + các ô quà + nút [Nhận];
    [Nhận tất cả]. Thư đã nhận giữ 30 ngày rồi ẩn.
  - **Script** `scripts/send-mail.mjs` (Node + `firebase-admin`): `node scripts/send-mail.mjs --to all|<email>|<uid> [--family <id>] --title "…" --body "…" --feathers 500 --stones 160 --vong 10 --sao 5 --seed carot:10 --pot su_lam_1 --expires 7d [--dry-run]`.
    Tìm người theo email bằng Admin Auth; `--to all` = thư riêng cho mọi vườn hiện có (collectionGroup `gardens`) hoặc `--broadcast` = 1 thư chung. In danh sách người nhận + hỏi xác nhận trước khi ghi.
    **Khoá service account** (JSON tải ở Firebase Console) để NGOÀI repo hoặc trong file đã gitignore (vd `scripts/.service-account.json`), đường dẫn qua biến `GOOGLE_APPLICATION_CREDENTIALS`; **tuyệt đối không commit**.
- [ ] **Hiệu ứng "Ít sâu" BỎ, đổi thành "tăng tỉ lệ côn trùng xuất hiện" (ĐÃ CHỐT 20/11/2026, CHƯA SỬA CODE)**:
  - Hiệu ứng này **chính là "Hút côn trùng"** đã có (`insect`) → bỏ `bug` khỏi `EFFECTS` (`data/pots.ts`), danh sách hiệu ứng hạng B đổi thành **Hạt rẻ, Thêm kinh nghiệm, Giá tốt, Hút côn trùng**.
  - **Mây tre**: thưởng đủ bộ `bug` → **Hút côn trùng** (lv1 +2% → lv6 +5%).
  - **Mật ong**: thưởng đủ bộ đổi thành **Giá tốt** (lv1 +4% → lv6 +10%) — ĐÃ CHỐT.
  - **Băng Tinh**: đặc quyền đổi thành **"Cây trên tầng không bao giờ khát nước"** — ĐÃ CHỐT.
  - Tỉ lệ côn trùng hiện ~1/2 số cây; Hút côn trùng cộng vào tỉ lệ này, trần 100%.
- [ ] **Nâng cấp chậu có tỉ lệ ("đập chậu", GĐ5) — NGƯỜI DÙNG MÔ TẢ + ĐÃ CHỐT 20/11/2026 (mọi con số + mục 1–9 theo đề xuất, kể cả Bùa giữ cấp), CHƯA LÀM** (thay bảng giá cố định "côn trùng loại nào cũng được" ở mục Tiền trong game):
  - **Người dùng mô tả**: mỗi lần nâng cần **côn trùng (đúng loại, đủ số) + lông chim** (vd 3 sâu + 3 nhện + 30 lông chim). **Nâng có tỉ lệ thành công**, chậu A thấp hơn B, S thấp nhất.
    **Thất bại** chia tiếp: **10% về lv1, 70% giữ nguyên cấp, 20% tuột ngẫu nhiên 1 / 2 / 3 / 4 cấp**. Được bỏ thêm **tối đa 5 chậu khác** (chưa nâng / đã nâng đều được) để tăng tỉ lệ,
    và **tối đa 3 item tăng tỉ lệ** (3 loại B / A / S; icon dựng bằng Blender — làm sau). **Tỉ lệ thành công hiện trên màn hình** để người chơi điều chỉnh. Chậu đang trồng cây vẫn nâng được.
  - **Tỉ lệ thành công gốc (đề xuất)**:
    | Lên cấp | 1→2 | 2→3 | 3→4 | 4→5 | 5→6 |
    |---|---|---|---|---|---|
    | Chậu B | 90% | 75% | 60% | 45% | 30% |
    | Chậu A | 80% | 65% | 50% | 35% | 20% |
    | Chậu S | 70% | 55% | 40% | 25% | 12% |
  - **Chi phí mỗi LẦN THỬ (đề xuất; mất cả khi thất bại)**: mỗi bộ chậu quy định **2 loại côn trùng** (theo chủ đề, vd Mật ong = bướm + bọ rùa, Rừng nấm = sâu + đom đóm), mỗi loại:
    1→2: 2 con + 30 lông chim · 2→3: 3 + 60 · 3→4: 4 + 120 · 4→5: 5 + 200 · 5→6: 6 + 300; **hạng A ×1,5, hạng S ×2** (làm tròn lên) cả côn trùng lẫn lông chim.
  - **Chậu bỏ vào (tối đa 5, bị MẤT dù thành công hay thất bại)**, % cộng thêm mỗi chậu (đề xuất); **chậu CÙNG LOẠI với chậu đang nâng ×1,5** (chậu trùng từ gacha có chỗ dùng):
    | Chậu bỏ vào | lv1 | lv2 | lv3 | lv4 | lv5 | lv6 |
    |---|---|---|---|---|---|---|
    | Hạng B | +2% | +3% | +4% | +6% | +8% | +10% |
    | Hạng A | +4% | +6% | +8% | +12% | +16% | +20% |
    | Hạng S | +8% | +12% | +16% | +24% | +32% | +40% |
  - **Item "Bùa may mắn" (tối đa 3, trộn hạng được)**: **B +5%, A +12%, S +25%**. **Trần tỉ lệ**: chậu B / A tối đa 100%, **chậu S tối đa 95%** (luôn còn rủi ro).
    Vd chậu S 5→6 (12%) + 5 chậu B lv1 cùng loại (+15%) + 3 bùa B (+15%) = 42%.
  - **Trả lời câu hỏi của người dùng**: hiện tại **CHỈ có hiệu ứng CẢ BỘ** (theo số chậu khác nhau trên tầng + **cấp trung bình** các chậu được tính, `setsOnTier` trong `data/pots.ts`), **không có hiệu ứng riêng từng chậu**.
    → 1 chậu lên / tuột cấp làm thay đổi cấp trung bình → mức hiệu ứng của bộ trên tầng đó.
  - **Bất cập & giải pháp (ĐÃ CHỐT 20/11/2026)**:
    1. **Nâng chậu đang trồng cây, thất bại chỉ ảnh hưởng từ lần gieo sau — KHÔNG SAO, và nên làm vậy cho MỌI hiệu ứng gắn với cây**: lúc gieo **chụp mức hiệu ứng của tầng vào cây** (`plant.buff`: lớn nhanh, bội thu, mùa may, giữ ẩm, côn trùng…),
       cây dùng đúng số đó tới khi thu hoạch → nâng / tuột cấp / dời / đặt thêm chậu giữa chừng không đổi cây đang trồng (cũng chặn mẹo đặt chậu ngay trước khi thu hoạch). Màn hình nâng cấp ghi rõ "Áp dụng từ lần gieo sau".
    2. **"Hạt rẻ" và "Giá tốt" không còn gắn với tầng** (hạt mua ở cửa hàng chung, nông sản bán ở Túi đồ chung) → đổi: **Hạt rẻ = cơ hội KHÔNG TỐN HẠT khi gieo ở tầng đó**,
       **Giá tốt = thu hoạch ở tầng đó được thêm lông chim = x% giá bán** số nông sản thu được (cũng chụp lúc gieo). Máy chạy nhanh vẫn tính theo hiện tại.
    3. **Chậu bỏ vào chỉ lấy từ KHO** (chậu đang đặt phải cất trước), không được chọn chính chậu đang nâng; bỏ **chậu hạng S, chậu ≥ lv3 hoặc bản cuối cùng của 1 loại** thì bấm 2 lần xác nhận.
       Thành tựu Thu thập đếm "đã từng có" (`stats.potKinds`) nên không bị trừ; nhưng mất bản cuối thì "Trọn bộ" trên tầng mất hiệu ứng.
    4. **Tuột cấp ở cấp thấp trùng kết quả**: số cấp tuột ngẫu nhiên trong 1..min(4, cấp − 1); lv1 thất bại = giữ nguyên; lv2 thất bại "về lv1" và "tuột" giống nhau — chấp nhận.
    5. **Chậu S 5→6 rất khắc nghiệt** (12% gốc, thất bại 8,8% / lần về lv1) → **THÊM item "Bùa giữ cấp" ngay trong GĐ5 (người dùng chốt)**: nâng thất bại thì **luôn giữ nguyên cấp** (không về lv1, không tuột);
       chậu bỏ vào, bùa may mắn, côn trùng, lông chim vẫn mất; không tăng tỉ lệ. ĐÃ CHỐT: **1 ô riêng, tối đa 1 bùa / lần**, không chiếm 3 ô bùa may mắn;
       nguồn như bùa A / S (gacha, thư, đổi ở cửa hàng bằng 2 item mới); gacha **0,5%** lấy từ suất côn trùng (côn trùng 44% → 43,5%). Icon dựng Blender (làm sau, cùng 3 bùa may mắn).
    6. **Nguồn Bùa may mắn (ĐÃ CHỐT)**: **Bùa B = mua ở cửa hàng (đề xuất 100 lông chim) + thư**. **Bùa A, S = rơi từ gacha + thư + đổi ở cửa hàng bằng 2 LOẠI ITEM MỚI**
       (= **Mảnh vỡ sao sáng / Mảnh vỡ sao**, xem mục riêng). Tỉ lệ gacha: suất côn trùng (~50%) chia thành **côn trùng 43,5% + bùa B 5% + bùa A 0,9% + bùa S 0,1% + bùa giữ cấp 0,5%** (bùa B vẫn rơi ở gacha theo tỉ lệ này).
       Không thưởng bùa ở thành tựu / nhiệm vụ ngày / Thăng tiến (khác đề xuất đầu).
    7. **Bảng giá cũ** (2 / 4 / 6 / 8 / 10 côn trùng loại nào cũng được + 50 → 800 lông chim) **bị thay** bởi chi phí mỗi lần thử ở trên; côn trùng giờ có giá trị theo loại (nhiệm vụ "bắt loại chỉ định" có ý nghĩa hơn).
    8. **Chỗ nâng cấp**: thêm [Nâng cấp] vào menu chậu (nhấn giữ chậu đã đặt) + tab **"Chậu"** trong Túi đồ (nâng chậu trong kho). Popup kiểu gacha: giữa = chậu (ảnh cấp hiện tại → cấp kế), 5 ô chậu bỏ vào, 3 ô bùa,
       chi phí (côn trùng / lông chim đang có, thiếu thì đỏ), **tỉ lệ thành công lớn ở giữa** (ghi "gốc 45% + chậu 12% + bùa 10%") + dòng nhỏ khả năng thất bại (về lv1 / giữ / tuột), nút [Nâng cấp].
       Kết quả: hiệu ứng sáng (thành công) / nứt (thất bại) rồi báo cấp mới. Chọn chậu bỏ vào = danh sách cuộn `DragScroll`. Có thêm ô **Bùa giữ cấp** (xem mục 5).
       **Nút ? (góc trên popup) mở bảng giải thích cách đập chậu** (người dùng yêu cầu): tỉ lệ gốc theo hạng + cấp; chi phí mỗi lần thử (2 loại côn trùng của bộ + lông chim, A ×1,5 / S ×2);
       thất bại → 10% về lv1 / 70% giữ nguyên / 20% tuột 1–4 cấp; bảng % cộng của chậu bỏ vào (cùng loại ×1,5, chậu bỏ vào luôn mất); bùa may mắn B / A / S (+5 / +12 / +25%, tối đa 3);
       bùa giữ cấp; trần tỉ lệ (B / A 100%, S 95%); "cấp mới áp dụng cho cây từ lần gieo sau"; hiệu ứng tính theo cấp trung bình của bộ trên tầng. Bảng cuộn dọc bằng `DragScroll`.
    9. **Ghi dữ liệu**: `upgradePot(potId, fodderIds[], charms{B,A,S}, keepCharm: boolean)` 1 transaction (kiểm tra đủ đồ, tính tỉ lệ lại từ dữ liệu server, quay ngẫu nhiên, trừ đồ, xoá chậu bỏ vào khỏi `pots` + `placed`, đổi cấp, cộng `stats` `upgradeTry` / `upgradeOk` / `maxPotLevel`).
       Ngẫu nhiên chạy trên điện thoại như gacha (chấp nhận với app gia đình).
- [ ] **Mảnh vỡ sao sáng / Mảnh vỡ sao — tiền đổi đồ đặc biệt ở cửa hàng (NGƯỜI DÙNG MÔ TẢ + ĐÃ CHỐT 20/11/2026: mọi bảng + mục 1–8 theo đề xuất, riêng mục 3 CHO ĐỔI NGƯỢC ra lông chim; CHƯA LÀM)**:
  - **Người dùng mô tả**: 2 loại tiền mới, **Mảnh vỡ sao sáng** (quý hơn) và **Mảnh vỡ sao**; dùng **đổi vật phẩm đặc biệt trong cửa hàng** (gồm bùa A / S, bùa giữ cấp — xem "Đập chậu").
    **Nguồn: gacha, nhưng KHÔNG phải 1 món rơi riêng** — là **thưởng ĐI KÈM** khi rơi vật phẩm hiếm: **vật phẩm hạng S → kèm Mảnh vỡ sao sáng**, **hạng A → kèm Mảnh vỡ sao**.
    **Icon dựng bằng Blender** (làm sau).
  - **Số lượng đi kèm (đề xuất; theo độ hiếm THẬT của món, vì "hạng S / A" có ở nhiều loại món với tần suất rất khác nhau)**:
    | Món rơi ra | Tần suất / lần quay | Thưởng kèm |
    |---|---|---|
    | Chậu S (vàng) | ~1/63 | **10 sao sáng** (chậu S đã có loại đó = trùng: **15**) |
    | Bùa S | 0,1% | 3 sao sáng |
    | 10 hạt hạng S | ~1,5% | 1 sao sáng |
    | Chậu A (tím) | 6% | **5 mảnh sao** (trùng: 8) |
    | Bùa A | 0,9% | 2 mảnh sao |
    | 10 hạt hạng A | ~7,5% | 1 mảnh sao |
    Trung bình ≈ **3,7 mảnh sao + 0,2 sao sáng / 10 lần quay**; 1 chậu vàng ≈ 10–15 sao sáng. Bùa giữ cấp không kèm mảnh. Banner 1 (Sao Duyên, đồ trang trí) sau này dùng cùng quy tắc.
  - **Đổi ở cửa hàng — tab "Đổi sao" (đề xuất; giới hạn số lần mỗi THÁNG, làm mới cùng lúc đổi banner)**:
    | Đổi bằng | Món | Giá | Giới hạn / tháng |
    |---|---|---|---|
    | Sao sáng | Bùa S | 10 | 2 |
    | Sao sáng | Bùa giữ cấp | 8 | 2 |
    | Sao sáng | 10 hạt hạng S (chọn loại, khi đã có cây S) | 5 | 2 |
    | Sao sáng | 1 Vọng Tinh | 5 | 5 |
    | Sao sáng | **Chọn 1 chậu S của bộ KHÔNG đang chạy banner** (bộ lệch / banner đã qua) | 120 | 1 |
    | Mảnh sao | Bùa A | 20 | 5 |
    | Mảnh sao | 1 Vọng Tinh | 15 | 5 |
    | Mảnh sao | 1 Sao Duyên | 15 | 5 |
    | Mảnh sao | 10 hạt hạng A (chọn loại, khi đã có cây A) | 30 | 3 |
    | Mảnh sao | Chọn 1 chậu A (bộ A bất kỳ) | 80 | 1 |
    | Mảnh sao | 5 côn trùng (chọn loại) | 10 | 5 |
  - **Bất cập & giải pháp (ĐÃ CHỐT)**:
    1. **"Hạng S / A" có ở chậu, bùa, hạt với tần suất rất khác** (hạt S ~1,5% / lần, nhiều hơn chậu S) → nếu cùng số lượng thì hạt S thành nguồn sao sáng chính → **số lượng theo độ hiếm thật** (bảng trên).
    2. **Chậu S trùng / lệch banner gây hụt hẫng** → chậu trùng kèm nhiều mảnh hơn (15 / 8) để bù (chậu trùng vẫn giữ lại như đã chốt).
    3. **Đổi được quá nhiều thì gacha mất ý nghĩa** → giới hạn số lần mỗi tháng; không đổi mảnh → đá, không đổi Vọng Tinh → mảnh.
       **Người dùng chốt: CHO ĐỔI NGƯỢC mảnh → lông chim** (1 chiều, không giới hạn): đề xuất **1 mảnh sao = 4 lông chim, 1 sao sáng = 15 lông chim**
       (thấp hơn giá trị qua Vọng Tinh ≈ 5 / 16 để mảnh vẫn nên dùng đổi đồ), dòng cuối tab "Đổi sao", nhập số bằng nút −/+ (không ô nhập chữ).
    4. **Chậu S đổi bằng sao sáng KHÔNG cho chọn chậu của banner đang chạy** (giữ giá trị banner); 120 sao sáng ≈ 8–12 chậu vàng.
    5. **Hiển thị**: thẻ kết quả gacha ghi "+10 ✦" dưới món; bảng tổng kết + lịch sử quay ghi số mảnh; bảng "Tỉ lệ" ghi quy tắc thưởng kèm.
       Số mảnh hiện ở **tab "Đổi sao" của cửa hàng + Túi đồ** (không thêm lên HUD cho đỡ chật).
    6. **Cửa hàng chia tab**: [Hạt giống] [Bùa] (bùa B mua bằng lông chim) [Đổi sao].
    7. **Dữ liệu**: vườn thêm `shards: { sao_sang, sao }` + `shopLimit: { thang: "YYYY-MM", bought: { id: n } }`; cộng mảnh trong CÙNG transaction `pullPots`; đổi = `exchange(id, n)` (transaction, kiểm tra giới hạn tháng).
       Thư (script) thêm được `shards` vào quà; bộ đếm `stats` thêm `shardsEarned`.
    8. **Icon Blender phải phân biệt bằng HÌNH, không chỉ màu** (đã có đá vũ trụ xanh-tím-hồng, Vọng Tinh vàng trắng, Sao Duyên xanh biển trắng): đề xuất **sao sáng = mảnh sao 5 cánh vỡ vàng kim, lõi trắng phát sáng + quầng**;
       **mảnh sao = vài mảnh vỡ nhọn nhỏ màu bạc ánh hồng**, sáng nhẹ. Xuất ảnh như icon tiền (`public/game/tien/`, 128px, ghép 2 lần giữ quầng sáng).
- **THỨ TỰ CODE ĐỀ XUẤT (20/11/2026) — các phần ĐÃ ĐẶC TẢ, KHÔNG cần Blender** (icon chưa có thì dùng tạm icon nét `GLYPHS`, có Blender thì thay ảnh):
  1. **[x] ĐÃ LÀM (20/11/2026)**: kinh nghiệm cấp tối đa 90 + đường cong sau cấp 40 (`MAX_LEVEL`, `XP_TABLE` trong `data/crops.ts`, `levelProgress().max`); bắt côn trùng +`CATCH_XP` (2);
     bộ đếm `stats` (`data/api.ts`: `bump`, `markPots`, `markTier`; khoá ghi trong chú thích `Stats`) cộng trong sow / water / catchInsect / harvestPlant / sell / buySeeds / placePot / movePot / pullPots,
     `pot_<loại>` + `fullTier` / `fullSetTier` cũng được ghi lại mỗi lần đọc vườn; menu ☰ (`GamePage.tsx`: `menuItems`, `RedDot`, `loadMenuOpen` / `saveMenuOpen` localStorage `vuon-may-menu:{uid}`, icon `menu` trong `ICON_PATHS`;
     chấm đỏ hiện có: quà chào mừng chưa nhận ở nút gacha). Chưa thử trên iPhone (máy làm không có `.env`).
  2. **[x] ĐÃ LÀM (20/11/2026)**: popup Thành tựu — định nghĩa + tiến độ + thưởng ở `data/achievements.ts` (`ACHIEVEMENTS`, `achState`, `readyTotal`, `levelReward`, `TIER_REWARD`; thêm bậc mới CHỈ thêm vào cuối `goals`),
     nhận thưởng `claimAchievement` / `claimAllAchievements` (`data/api.ts`, vườn có `claimed` = id → số bậc đã nhận), giao diện `game/AchievementsUi.tsx` (`AchievementsScreen`), nút 🏆 trong menu ☰ (chấm đỏ khi có bậc chờ nhận; icon nét 🏆 mới trong `GLYPHS`).
     Quà chào mừng 20 Vọng Tinh chuyển sang thành tựu "Chào mừng" (đã bỏ nút ở màn hình gacha và `claimGift`; `gift` vẫn được bật khi nhận để tương thích). Thành tựu cây hạng A / S, chế tạo, nhiệm vụ ngày tự ẩn tới khi có.
  3. Hòm thư + `scripts/send-mail.mjs` + Firestore Rules; gỡ nút "+100 Vọng Tinh (test)".
  4. Hiệu ứng bộ chậu chạy thật: chụp `plant.buff` lúc gieo, bỏ Ít sâu, Hạt rẻ / Giá tốt kiểu mới, Mật ong Giá tốt, Băng Tinh không khát nước.
  5. Đập chậu (tỉ lệ, chậu bỏ vào, bùa may mắn B / A / S, bùa giữ cấp, nút ?) — icon bùa tạm.
  6. Mảnh vỡ sao sáng / sao (kèm khi quay, tỉ lệ gacha mới có bùa), cửa hàng 3 tab [Hạt giống] [Bùa] [Đổi sao], đổi mảnh → lông chim, đổi đá → lông chim (1 : 5).
  7. Nhiệm vụ hằng ngày (tab "Hôm nay" trong Thành tựu).
  CẦN Blender (làm riêng): icon 4 bùa + 2 mảnh sao, hoạt cảnh / xuất máy chế tạo, xuất 14 cây mới, bộ chậu banner mới. CHƯA đặc tả: máy chế tạo (GĐ6), số liệu 14 cây (GĐ8), banner Sao Duyên.
- **Các phần Vườn mây CÒN CẦN NGƯỜI DÙNG ĐẶC TẢ** (rà ngày 20/11/2026; session hiện tại chủ yếu đặc tả trước, code sau):
  1. GĐ5 hiệu ứng bộ chậu + nâng cấp chậu (cơ chế nâng có tỉ lệ đã mô tả + đề xuất số, chờ duyệt; "Ít sâu" đã chốt bỏ → Hút côn trùng; Mật ong thưởng Giá tốt, Băng Tinh không khát nước).
  2. Banner 1 Sao Duyên = đồ trang trí (chưa có gì). 3. Chủ đề + hiệu ứng 5 bộ banner S còn lại (B4–B8).
  4. Máy chế tạo GĐ6: số nguyên liệu, thời gian, số mẻ, **giá bán sản phẩm bằng đá**, tầng 4 có máy không.
  5. Kinh nghiệm game (đã chốt giữ `xp`; còn: nguồn kinh nghiệm ngoài thu hoạch, cấp tối đa). 6. Hòm thư: ĐÃ CHỐT gửi bằng script (xem mục Hòm thư).
  7. Nhiệm vụ hằng ngày: đã chốt là tab "Hôm nay" trong popup Thành tựu. 8. Đổi đá → lông chim: đổi ở đâu, theo gói hay nhập số.
  9. 14 cây mới (GĐ8): cấp mở, thời gian, sản lượng, giá bán, kinh nghiệm; giá hạt mía. 10. Côn trùng: 5 loại có giá trị khác nhau khi nâng cấp không.
  Để sau: ghé vườn người thân, âm thanh / nhạc nền, gỡ nút "+100 Vọng Tinh (test)".
- [ ] Ghé vườn người thân (tưới giúp / hái trộm) + thông báo trong bong bóng — làm sau (dữ liệu vườn đã cho cả gia đình đọc).

Dữ liệu Firestore, thuộc gia đình đang chọn:
- `families/{familyId}/gardens/{uid}`: vườn của từng thành viên (`name`, `coins` (xu cũ, không dùng trong game), `feathers` (lông chim), `xp`, `plants` = map chỗ đặt `"<tầng>-<chỗ>"` → `{ crop, plantedAt (ms), watered, caught }`, `seeds`, `seedGift`, `insects`, `pots`, `placed`, gacha…; `unlocked` / `plots` của bản 2D cũ không còn dùng;
  `barn` = map id cây -> số nông sản, `harvested`, `stats` = bộ đếm tích luỹ cho thành tựu (chỉ tăng), `claimed` = thành tựu đã nhận tới bậc nào); cả gia đình đọc, mỗi người chỉ ghi vườn của mình

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

### 5. Phong cách: gradient + glass, KHÔNG bo góc, bố cục ô kiểu Live Tile (Windows Phone)
- Nền dùng **màu gradient** (`body` trong `index.css`).
- **Bầu trời sao dưới nền** (`src/components/StarField.tsx`, CSS `.sky-*` trong `index.css`, gắn 1 lần trong `Shell` của `App.tsx`, đặt TRƯỚC các màn hình nên nằm dưới chúng):
  ~36 điểm sao mờ **thỉnh thoảng sáng lên rồi tắt** (mỗi sao 1 nhịp riêng) + 3 **sao băng** chu kỳ dài (13 / 19 / 29 giây, chỉ xẹt qua ~1 giây) chéo xuống bên trái.
  Chỉ dùng CSS animation (opacity / transform), vị trí sao cố định (số ngẫu nhiên có hạt giống); bật "Giảm chuyển động" thì sao đứng yên, không có sao băng.
  Lớp này `position: fixed`, `pointer-events: none`, có `data-round` (sao tròn). Màn hình không được có nền đặc che mất bầu trời sao.
- Panel / card theo kiểu **glassmorphism**: nền bán trong suốt, `backdrop-blur`, viền mảnh sáng nhẹ, **luôn có shadow** để nổi bật so với nền.
- **KHÔNG BO GÓC Ở BẤT KỲ ĐÂU** (nút, ô nhập, panel, thẻ, popup…): `index.css` có quy tắc chung ép `border-radius: 0 !important` cho mọi phần tử.
  **Chỉ vùng có `data-round` giữ hình tròn**: **avatar người dùng / con** (`Avatar`, `ChildAvatar`, ô chọn avatar, popup chọn người / con), **nút nổi FAB**, **bong bóng thông báo (chuông)**
  và dấu X để ẩn nó, mặt đồng hồ của `TimeField`, khung bánh xe của `Select`, vòng xoay tải (`RefreshIndicator`). Skeleton tròn dùng `<Skeleton round />`; ô chọn ảnh tròn dùng `<ImagePicker round>`.
  Thêm hình tròn mang chức năng mới thì gắn `data-round`; không thêm class `rounded-*` mới.
- **Ô kiểu Live Tile**: màn hình chính (`HomeIcon.tsx`) là lưới 4 cột khe hẹp; **app con = ô vừa 2×2**, phím tắt / ô "+" = ô nhỏ 1×1; ô vuông nền gradient của app (`APPS.gradient`)
  + viền mảnh + bóng đổ, icon ở giữa, **tên nằm trong ô ở góc trái dưới**, phím tắt có icon app nhỏ ở góc phải trên.
  Ô chức năng trong app con (`FeatureTile`) là ô kính gradient có bóng đổ, icon góc trái trên, tên + dòng phụ góc trái dưới.
- **Tiêu đề trang** (`AppHeader`): chữ thường (`lowercase`), to, nét mảnh (`font-light`).
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

### 9. Icon: bộ icon NÉT ĐƠN SẮC riêng của app
- **Mọi icon trong app dùng bộ icon nét đơn sắc tự vẽ** (`src/components/ui/Glyph.tsx`, bảng `GLYPHS`): khung 24×24, nét tròn đầu / tròn góc dày 1.8,
  **không tô màu**, màu = `currentColor` (trắng) nên luôn hợp nền. Linh vật của app là **con nhím** (🦔, cũng là icon của 👶 / app Chăm con).
- Vẫn gọi qua `Icon3D` (`src/components/ui/Icon3D.tsx`) với emoji, vd `<Icon3D emoji="💰" className="h-8 w-8" />`: emoji (dữ liệu cũ giữ nguyên) được tra sang icon nét;
  **emoji chưa có trong `GLYPHS` mới hiện ảnh 3D cũ** (Fluent Emoji 3D ở `public/icons3d/`, chỉ còn là dự phòng). Không hiển thị emoji dạng chữ.
- **Khi dùng emoji mới: vẽ thêm icon nét vào `GLYPHS`** cùng phong cách (đơn giản, ít chi tiết, nhìn rõ ở 16–44px), mở xem trên nền app trước khi dùng.
- Icon nằm trên nền màu (icon app, icon quỹ, huy hiệu...) thì đặt trong **khối màu PHẲNG có bóng đổ** `BLOCK_3D` (`src/components/ui/style3d.ts`; tên cũ, đã bỏ hiệu ứng nổi 3D; `GLOSS_3D` để trống). Ô chọn icon dùng `TILE_3D` / `TILE_3D_SELECTED` (phẳng, vuông).
- Ngoại lệ: chữ trong `<option>` và chữ trên ô `Select` (lúc chưa mở) giữ emoji dạng chữ. Các ký hiệu điều khiển nhỏ (mũi tên quay lại ‹, mũi tên ▾ của ô chọn) không tính là icon.
- Icon trên nút nổi (FAB) dùng bộ `ICON_PATHS` riêng trong `Fab.tsx`, xem mục 10.
- **Icon trong sự kiện TRƯỢT THẺ** (nút hiện ra khi trượt thẻ trong danh sách, vd thùng rác / nhập lại ở Tra cứu):
  dùng icon nét trắng đơn giản giống FAB (`LineIcon` trong `src/components/ui/Fab.tsx`, cùng bộ `ICON_PATHS`; thiếu icon thì vẽ thêm vào `ICON_PATHS`).

### 10. Nút nổi (Floating Action Button - FAB)
- **Ưu tiên dùng FAB cho các chức năng của màn hình** (thêm, lưu, xoá, sửa...). Màn hình có 1 nút chức năng thì nút đó **bắt buộc là FAB**.
- FAB: nút **tròn** (có `data-round`, xem mục 5), nằm **góc phải dưới**, **chỉ có icon, không có chữ** (chữ để trong `label` cho trình đọc màn hình). Dùng `Fab` / `FabLink` / `FabGroup` trong `src/components/ui/Fab.tsx`.
- **Icon trên FAB là icon nét màu trắng đơn giản** (SVG trong `Fab.tsx`), **không dùng icon 3D**.
  Nút **không có hiệu ứng 3D** (không khối nổi, không lớp bóng loáng), có **bóng đổ** để nổi lên trên giao diện.
- **Mọi FAB phải có màu GRADIENT và hiệu ứng GLASS** (nền gradient bán trong suốt, `backdrop-blur`, viền mảnh sáng; đã có sẵn trong `Fab` / `FabLink`, không tự viết lại).
  **Hạn chế màu xám cho các nút chức năng; ưu tiên tím và xanh dương** (hợp với màu nền): `primary` tím cho chức năng chính, `secondary` xanh dương cho chức năng phụ, `danger` đỏ cho xoá.
  **Màu xám (`gray`) chỉ dùng cho nút đăng xuất.**
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
- **Mọi avatar trong app đều hiển thị trong KHUNG TRÒN** (`rounded-full` + **`data-round`**, vì toàn app không bo góc — mục 5), ở mọi nơi: danh sách, form, thanh tiêu đề, popup chọn.
- Ảnh thật: khung `block` / `flex` (**không để `span` inline**, vì inline bỏ qua `h-*` / `w-*`) + `overflow-hidden rounded-full`; thẻ `<img>` thêm `block h-full w-full rounded-full object-cover`.
- Chưa có ảnh: khối tròn màu có bóng đổ (`BLOCK_3D`) với icon bên trong; ô "chọn ảnh" / "thêm" cũng là hình tròn (viền nét đứt).
- Skeleton của avatar là `<Skeleton round />`, cùng kích thước với avatar thật.
- Dùng lại component có sẵn (vd `ChildAvatar` trong `src/pages/baby/components.tsx`, `Avatar`) thay vì tự viết lại.

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

### 17. Ô nhập giờ
- **Mọi ô nhập giờ phải dùng `TimeField`** (`src/components/ui/TimeField.tsx`), **không dùng `<input type="time">`** (iOS 15.1 có lúc không bật popup chọn giờ).
  Giá trị vào / ra "HH:MM" ("" = chưa chọn), giống `<input type="time">`.
- Ô hiển thị như ô nhập thường ("HH:MM" ở giữa, cao bằng `TextField` nên skeleton dùng `TextFieldSkeleton`); **chạm vào mở popup VÒNG TRÒN** to nhất có thể
  (gần hết bề ngang, không cao quá màn hình): **vòng TRONG 12 số giờ của nửa ngày đang xem** (như mặt đồng hồ, 12 / 24 ở trên cùng),
  **vòng NGOÀI 60 điểm = 60 phút** (00 ở trên cùng, theo chiều kim đồng hồ).
  **Nút ☀️ / 🌙 ở giữa đổi nửa ngày**: đang hiện 13–24 giờ thì nút là ☀️ (chạm -> 1–12 giờ, nút thành 🌙); đang hiện 1–12 giờ thì nút là 🌙
  (chạm -> 13–24 giờ, nút thành ☀️); dưới icon ghi nửa ngày sẽ đổi sang. Đổi nửa ngày thì giờ đang chọn giữ vị trí (3 <-> 15, 12 <-> 24).
  **Nửa ngày lúc mở theo giờ ban đầu**: 1–12 giờ -> 1–12; 0 giờ (hiện là 24) và 13–23 giờ -> 13–24. 24 giờ lưu là "00".
  Chạm / kéo vùng vòng trong để chọn giờ, vùng vòng ngoài để chọn phút (bắt đầu ở vòng nào thì cả lần kéo chỉnh vòng đó); giữa tâm có kim + nút kéo hiện số,
  góc trên hiện giờ đang chọn. **Giữ / kéo ở vòng giờ quá ~0,18 giây (`ZOOM_DELAY`) thì vòng giờ PHÓNG TO** (`ZOOM_SCALE` 1,55, gần kín vòng tròn,
  animation hơi nảy `ZOOM_MS`), vòng phút mờ đi; nhả tay thì thu về. **Chạm nhanh rồi nhả = chọn luôn, không phóng to.** Nút **Huỷ / Xong** (bằng nhau, 1 hàng); ô không bắt buộc truyền **`clearable`** để có thêm **"Bỏ giờ"**. Chưa có giờ thì mở ở giờ hiện tại.
- Popup vẽ bằng `createPortal` ra `document.body`, có `data-no-swipe`, SVG `touch-none` + pointer capture để kéo không cuộn trang.
- **Giao diện popup theo theme "Space Glass"** (`src/components/ui/timeDial.css`, import trong `index.css` với `layer(components)` — import riêng ở component
  sẽ bị CSS reset của Tailwind đè vì plugin cascade-layers tăng độ ưu tiên các lớp Tailwind): nền là bầu trời trong khung popup, các vòng (phút, giờ, nút giữa)
  là kính mờ HTML (`.td-glass`) nằm dưới SVG. **Đang hiện 1–12 giờ (nút 🌙) = chế độ SÁNG** (nền sáng + ngôi sao khổng lồ ở mép phải),
  **13–24 giờ (nút ☀️) = chế độ TỐI** (trời sao, tinh vân, sao băng). Đổi nửa ngày: `.td-day` trượt khung trời 2,4s, `.td-light` đổi màu giữa chừng
  (sang sáng sau 1,4s, sang tối sau 0,8s). Màu chữ / số lấy từ biến `--td-*`.
- Đang dùng: Time line (Bắt đầu / Kết thúc), form thông tin con (Giờ sinh, `clearable`).

### 19. Chọn / chụp ảnh
- **Mọi chỗ chọn ảnh dùng `ImagePicker`** (`src/components/ui/ImagePicker.tsx`): ô chọn tệp gốc trong suốt phủ lên nội dung để ngón tay chạm thẳng vào. **Không dùng `<input className="hidden">` + `input.click()`** (iOS 15.1 có lúc không bật bảng Thư viện ảnh / Chụp ảnh / Chọn tệp).

### 18. Ô chọn (Select)
- **Mọi ô chọn dùng `Select`** (`src/components/ui/Select.tsx`), không dùng `<select>` gốc. Cách dùng như `<select>`: `<option>` trong children, đọc `e.target.value` trong `onChange`; skeleton dùng `TextFieldSkeleton`.
- Ô hiển thị như ô chọn thường; **chạm vào mở popup BÁNH XE HÌNH QUẠT**: lựa chọn xếp quanh hình tròn có tâm ở mép TRÁI popup, popup là khung nhìn nên chỉ lộ 1 phần (đuôi quạt bên trái, cho ngón cái tay phải).
  **Lựa chọn đang hiện trên quạt thì CHẠM để chọn** (bánh xe quay tới đó rồi đóng popup); **chưa hiện thì KÉO để xoay quạt** (chỉ xoay, không chọn; quán tính tối đa 3 lựa chọn, 2 đầu nặng tay) rồi chạm. Giá trị hiện tại là **cung quạt lồi ra khỏi mép quạt và nổi lên bằng bóng đổ** (`SelectedSector`), xoay cùng quạt; **Huỷ** / chạm nền mờ / Esc để bỏ. Chữ bắt đầu bằng emoji thì hiện icon 3D trong popup.
- Lúc kéo chỉ đổi style trực tiếp (`paint`), không render lại React. Popup vẽ bằng `createPortal`, có `data-no-swipe`.

### 20. Thông tin chưa lưu (màn hình sửa có nút lưu)
- Mọi màn hình **phải bấm nút lưu mới lưu** phải dùng `useUnsavedChanges(dirty, save)` (`src/components/UnsavedGuard.tsx`):
  `dirty` = đang có thay đổi chưa lưu (form Tạo / Sửa: `useChanged({ ...các giá trị form })` so với lúc mở; màn hình lưu xong ở lại và dọn form (nạp / rút / chuyển, Đọc hoá đơn): đã nhập số tiền),
  `save` = bấm nút lưu (form: `() => submitForm(FORM_ID)` — iOS 15.1 chưa có `requestSubmit`).
  Truyền `dirty && !saving` (và `!deleting`) để lúc đang lưu không hỏi.
- **Nút lưu có chấm đỏ ở góc phải trên** khi có thông tin chưa lưu: `<Fab dirty={dirty}>` / `<SaveDeleteFabs dirty={dirty}>`.
- **Rời màn hình khi còn thông tin chưa lưu** (nút ‹, link, vuốt từ mép iOS / quay lại của trình duyệt) thì `UnsavedGuard` (gắn 1 lần trong `App.tsx`, dùng `useBlocker`
  nên app chạy bằng **data router** `createBrowserRouter` + `RouterProvider`, các route vẫn khai báo bằng `<Routes>`) hiện **hộp thoại "Có thông tin chưa lưu"**
  với 2 nút bằng nhau **[Trở lại]** (bỏ thay đổi, rời đi) / **[Lưu]** (bấm nút lưu của màn hình); chạm nền mờ / Esc = ở lại. Đang có thông tin chưa lưu thì **tắt vuốt sang màn hình 2 bên**.
- **Lưu / xoá xong mà chuyển trang thì dùng hàm `leave(to)` do hook trả về** (không dùng `navigate`), nếu không sẽ bị hỏi lại.
- Đang áp dụng: form Tạo / Sửa (con, thẻ hoạt động, phát triển, nhóm quỹ, lệnh chuyển, địa điểm, ghi chú), Thông tin cá nhân, Tạo / Quản lý gia đình (tên),
  Nạp / Rút / Chuyển quỹ, Nạp / Rút / Chuyển của 1 quỹ, Đọc hoá đơn, Cài đặt Quỹ (lãi suất), Thực thi bước 1 (lương), Xem ghi chú (thêm nội dung / nạp rút của thẻ),
  khung nhập hoạt động ở Time line (thêm mới luôn tính là chưa lưu).
  **Thêm màn hình sửa mới có nút lưu thì phải gắn hook này.**

