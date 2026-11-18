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
- [x] Trang chính (`/garden`): thanh cấp độ + xu (`GardenStats`), tóm tắt vườn (cây chín / cần chăm / ô trống / nông sản trong kho).
- [x] Vườn của tôi (`/garden/farm`, `FarmPage`): lưới **12 ô đất 4×3** (`MAX_PLOTS`), mở sẵn 6 ô, 100 xu lúc bắt đầu (vườn tự tạo lần đầu mở app khi server xác nhận chưa có).
  **Chạm 1 ô làm đúng việc ô đó cần**: đất trống → popup chọn hạt (`SeedPicker`, mua hạt = gieo luôn, cây chưa đủ cấp / không đủ xu thì mờ);
  cây khát nước (huy hiệu 💧) / có sâu (🐛) → tưới + bắt sâu; cây chín → thu hoạch (vào kho, cộng kinh nghiệm, báo lên cấp + cây mới mở khoá);
  ô khoá kế tiếp → chạm 2 lần để mở bằng xu (`plotPrice`: 100, 200, 400…). FAB [💧 chăm cả vườn] [giỏ thu hoạch tất cả].
  **Cây lớn theo thời gian thật** từ `plantedAt` (đóng app vẫn lớn), 4 giai đoạn hạt / mầm / lớn / chín (`plotState`). Tưới trước khi chín: +1 nông sản;
  ~1/3 số lần gieo bị sâu (cố định theo `plantedAt`) khi lớn được nửa chừng, không bắt thì −1 nông sản. Cây chín không héo.
  Cấp độ: lên cấp L cần tổng `25·L·(L−1)` kinh nghiệm (`levelOf`); 8 loại cây mở dần theo cấp (`CROPS`).
- [x] **Cảnh mây 3D** trong Vườn của tôi: `Segmented` **[Cảnh mây] [Ô đất]** dưới thanh cấp độ (nhớ ở localStorage `garden-view`, mặc định Cảnh mây).
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
- [x] Kho nông sản (`/garden/barn`): mỗi loại 1 dòng, nút Bán (bán hết loại đó); FAB đồng xu bán tất cả.
- [x] Cẩm nang (`/garden/guide`): cách chơi + bảng các loại cây (cấp, giá hạt, thời gian, thu được, lãi).
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
    | Hiệu ứng chính chọn từ | Hạt rẻ, Thêm kinh nghiệm, Giá tốt, Ít sâu | Lớn nhanh, Bội thu, Giữ ẩm, Hút côn trùng | Mùa may (thu gấp đôi), Máy chạy nhanh, Lớn nhanh + Bội thu cùng lúc |
    | Mức ở lv6 theo 3 mốc số chậu | 4 / 8 / 12% | 10 / 20 / 30% | 15 / 30 / 45% |
    | Thưởng đủ bộ | 1 hiệu ứng hạng B, tối đa 5% | 1 hiệu ứng hạng B, tối đa 10% | 1 hiệu ứng hạng A, tối đa 15% + 1 đặc quyền riêng (vd cây chín tự vào kho, tầng không bao giờ bị sâu, côn trùng tự vào lưới) |
    **Theo cấp**: lv1 = 40% mức của lv6, mỗi cấp tăng đều; cấp dùng để tính = **trung bình cấp các chậu được tính vào mốc**.
    **Phần lẻ tính thành cơ hội** (vd +0,3 nông sản = 30% khả năng được thêm 1).
    Danh sách hiệu ứng: Lớn nhanh (giảm thời gian chín), Bội thu (thêm nông sản), Thêm kinh nghiệm, Giá tốt (bán đắt hơn), Hạt rẻ (gieo rẻ hơn), Giữ ẩm (tự tính là đã tưới),
    Ít sâu, Hút côn trùng (gặp bọ rùa / đom đóm / nhện / sâu nhiều hơn), Mùa may (cơ hội thu gấp đôi), Máy chạy nhanh (máy cùng tầng làm nhanh hơn).
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
- [ ] **Côn trùng nâng cấp chậu** (bay / bò quanh cây, chạm để bắt): đã dựng trong Blender, collection `ConTrung` (ảnh `con-trung.png`, `con-trung-trong-vuon.png`),
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
  GĐ2 [ ] xuất chậu / cây / côn trùng ra app (giảm đỉnh), dữ liệu chậu theo vị trí cố định, hiện chậu + cây đúng giai đoạn trên tầng;
  GĐ3 [ ] đặt / dời / cất chậu (danh sách cuộn ngang, xem trước, bảng hiệu ứng); GĐ4 [ ] trồng / chăm / thu hoạch trên cảnh 3D, Kho + Cẩm nang thành popup, côn trùng xuất hiện + bắt;
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
- [ ] Ghé vườn người thân (tưới giúp / hái trộm) + thông báo trong bong bóng — làm sau (dữ liệu vườn đã cho cả gia đình đọc).

Dữ liệu Firestore, thuộc gia đình đang chọn:
- `families/{familyId}/gardens/{uid}`: vườn của từng thành viên (`name`, `coins`, `xp`, `unlocked` số ô đã mở, `plots` = mảng 12 ô `{ crop, plantedAt (ms), watered, bugCleared }`,
  `barn` = map id cây -> số nông sản, `harvested`); cả gia đình đọc, mỗi người chỉ ghi vườn của mình

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

