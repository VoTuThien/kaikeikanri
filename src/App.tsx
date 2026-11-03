import type { ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthLayout } from './components/AuthLayout'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { FamilyProvider, useFamily } from './contexts/FamilyContext'
import { FamilyCreatePage, FamilyCreatePageSkeleton } from './pages/family/FamilyCreatePage'
import { FamilyJoinPage, FamilyJoinPageSkeleton } from './pages/family/FamilyJoinPage'
import { FamilyManagePage, FamilyManagePageSkeleton } from './pages/family/FamilyManagePage'
import { NotificationsPage, NotificationsPageSkeleton } from './pages/family/NotificationsPage'
import { isFirebaseConfigured } from './lib/firebase'
import { LauncherPage, LauncherPageSkeleton } from './pages/LauncherPage'
import { ProfilePage, ProfilePageSkeleton } from './pages/ProfilePage'
import { ShortcutPickerPage, ShortcutPickerPageSkeleton } from './pages/ShortcutPickerPage'
import { SidePage, SidePageSkeleton } from './pages/SidePage'
import { SideSwipe } from './components/SideSwipe'
import { RefreshIndicator } from './components/RefreshIndicator'
import { NotificationBubble } from './components/NotificationBubble'
import { BabyHomePage } from './pages/baby/BabyHomePage'
import { CardFormPage } from './pages/baby/CardFormPage'
import { CardListPage } from './pages/baby/CardListPage'
import { ChildFormPage } from './pages/baby/ChildFormPage'
import { ChildListPage } from './pages/baby/ChildListPage'
import { BabyLayout } from './pages/baby/components'
import { StatsPage } from './pages/baby/StatsPage'
import { TimelinePage } from './pages/baby/TimelinePage'
import { FundLayout } from './pages/fund/components'
import { FundFormPage } from './pages/fund/FundFormPage'
import { FundActionPage } from './pages/fund/FundActionPage'
import { FundHomePage } from './pages/fund/FundHomePage'
import { FundListPage } from './pages/fund/FundListPage'
import { FundSettingsPage } from './pages/fund/FundSettingsPage'
import { HistoryPage } from './pages/fund/HistoryPage'
import { TransactionPage } from './pages/fund/TransactionPage'
import { TransferPage } from './pages/fund/TransferPage'
import { OrderListPage } from './pages/fund/OrderListPage'
import { OrderFormPage } from './pages/fund/OrderFormPage'
import { ExecutePage } from './pages/fund/ExecutePage'
import { SalaryPage } from './pages/fund/SalaryPage'
import { StatsPage as FundStatsPage } from './pages/fund/StatsPage'
import { NoteLayout } from './pages/note/components'
import { NoteCardsPage } from './pages/note/NoteCardsPage'
import { NoteFormPage } from './pages/note/NoteFormPage'
import { NoteHomePage } from './pages/note/NoteHomePage'
import { NoteInboxPage } from './pages/note/NoteInboxPage'
import { NoteSentPage } from './pages/note/NoteSentPage'
import { NoteSettingsPage } from './pages/note/NoteSettingsPage'
import { NoteViewPage } from './pages/note/NoteViewPage'
import { StatusLayout } from './pages/status/components'
import { LiveStatusPage } from './pages/status/LiveStatusPage'
import { MiniMapPage } from './pages/status/MiniMapPage'
import { PlaceFormPage } from './pages/status/PlaceFormPage'
import { PlaceListPage } from './pages/status/PlaceListPage'
import { StatusHomePage } from './pages/status/StatusHomePage'
import { ForgotPasswordPage, ForgotPasswordPageSkeleton } from './pages/auth/ForgotPasswordPage'
import { LoginPage, LoginPageSkeleton } from './pages/auth/LoginPage'
import { RegisterPage, RegisterPageSkeleton } from './pages/auth/RegisterPage'

// Trang cần đăng nhập. Trong lúc Firebase khôi phục phiên / tải danh sách gia đình thì hiện skeleton của chính trang đó.
function Protected({ page, skeleton }: { page: ReactNode; skeleton: ReactNode }) {
  const { user, loading } = useAuth()
  const { loading: familyLoading } = useFamily()
  if (loading || familyLoading) return skeleton
  return user ? page : <Navigate to="/login" replace />
}

// Trang chỉ dành cho người chưa đăng nhập (đăng nhập, đăng ký, quên mật khẩu)
function GuestOnly({ page, skeleton }: { page: ReactNode; skeleton: ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return skeleton
  return user ? <Navigate to="/" replace /> : page
}

function FirebaseNotConfigured() {
  return (
    <AuthLayout title="Chưa cấu hình" subtitle="Cần thêm thông tin Firebase">
      <p className="text-sm leading-6 text-white/80">
        Hãy sao chép file <code className="rounded bg-white/15 px-1">.env.example</code> thành{' '}
        <code className="rounded bg-white/15 px-1">.env</code>, điền thông tin từ Firebase Console rồi chạy lại{' '}
        <code className="rounded bg-white/15 px-1">npm run dev</code>.
      </p>
    </AuthLayout>
  )
}

// Toàn bộ route của app. `location` dùng để vẽ trước màn hình bên cạnh khi đang vuốt (SideSwipe), không có thì theo URL hiện tại
function AppRoutes({ location }: { location?: string }) {
  return (
    <Routes location={location}>
      <Route path="/" element={<Protected page={<LauncherPage />} skeleton={<LauncherPageSkeleton />} />} />
      {/* Chọn màn hình để tạo phím tắt / thiết đặt màn hình 2 bên của màn hình chính */}
      <Route path="/shortcuts" element={<Protected page={<ShortcutPickerPage />} skeleton={<ShortcutPickerPageSkeleton />} />} />
      {/* Màn hình 2 bên của màn hình chính khi chưa thiết đặt (dấu +) */}
      <Route path="/side/:side" element={<Protected page={<SidePage />} skeleton={<SidePageSkeleton />} />} />
      {/* Gia đình: tạo, tham gia, thông báo xin gia nhập */}
      <Route path="/family/create" element={<Protected page={<FamilyCreatePage />} skeleton={<FamilyCreatePageSkeleton />} />} />
      <Route path="/family/join" element={<Protected page={<FamilyJoinPage />} skeleton={<FamilyJoinPageSkeleton />} />} />
      <Route path="/notifications" element={<Protected page={<NotificationsPage />} skeleton={<NotificationsPageSkeleton />} />} />
      <Route path="/family/manage" element={<Protected page={<FamilyManagePage />} skeleton={<FamilyManagePageSkeleton />} />} />
      {/* Thông tin cá nhân (nút cây bút cạnh lời chào ở màn hình chính) */}
      <Route path="/profile" element={<Protected page={<ProfilePage />} skeleton={<ProfilePageSkeleton />} />} />
      {/* App Quỹ: mỗi trang tự hiện skeleton khi đang đăng nhập / tải dữ liệu */}
      <Route path="/fund" element={<FundLayout />}>
        <Route index element={<FundHomePage />} />
        <Route path="groups" element={<FundListPage />} />
        <Route path="groups/new" element={<FundFormPage />} />
        <Route path="groups/:id" element={<FundFormPage />} />
        <Route path="groups/:id/tx" element={<FundActionPage />} />
        <Route path="deposit" element={<TransactionPage kind="deposit" />} />
        <Route path="withdraw" element={<TransactionPage kind="withdraw" />} />
        <Route path="transfer" element={<TransferPage />} />
        <Route path="salary" element={<SalaryPage />} />
        <Route path="orders" element={<OrderListPage />} />
        <Route path="orders/new" element={<OrderFormPage />} />
        <Route path="orders/:id" element={<OrderFormPage />} />
        <Route path="execute" element={<ExecutePage />} />
        <Route path="history" element={<HistoryPage />} />
        <Route path="stats" element={<FundStatsPage />} />
        <Route path="settings" element={<FundSettingsPage />} />
      </Route>
      {/* App Chăm con */}
      <Route path="/baby" element={<BabyLayout />}>
        <Route index element={<BabyHomePage />} />
        <Route path="children" element={<ChildListPage />} />
        <Route path="children/new" element={<ChildFormPage />} />
        <Route path="children/:id" element={<ChildFormPage />} />
        <Route path="cards" element={<CardListPage />} />
        <Route path="cards/new" element={<CardFormPage />} />
        <Route path="cards/:id" element={<CardFormPage />} />
        <Route path="timeline" element={<TimelinePage />} />
        <Route path="stats" element={<StatsPage />} />
      </Route>
      {/* App Ghi chú */}
      <Route path="/note" element={<NoteLayout />}>
        <Route index element={<NoteHomePage />} />
        <Route path="inbox" element={<NoteInboxPage />} />
        <Route path="inbox/:id" element={<NoteViewPage />} />
        <Route path="sent" element={<NoteSentPage />} />
        <Route path="sent/new" element={<NoteFormPage />} />
        <Route path="sent/:id" element={<NoteFormPage />} />
        <Route path="cards" element={<NoteCardsPage />} />
        <Route path="settings" element={<NoteSettingsPage />} />
      </Route>
      {/* App Trạng thái */}
      <Route path="/status" element={<StatusLayout />}>
        <Route index element={<StatusHomePage />} />
        <Route path="places" element={<PlaceListPage />} />
        <Route path="places/new" element={<PlaceFormPage />} />
        <Route path="places/:id" element={<PlaceFormPage />} />
        <Route path="map" element={<MiniMapPage />} />
        <Route path="live" element={<LiveStatusPage />} />
      </Route>
      <Route path="/login" element={<GuestOnly page={<LoginPage />} skeleton={<LoginPageSkeleton />} />} />
      <Route
        path="/register"
        element={<GuestOnly page={<RegisterPage />} skeleton={<RegisterPageSkeleton />} />}
      />
      <Route
        path="/forgot-password"
        element={<GuestOnly page={<ForgotPasswordPage />} skeleton={<ForgotPasswordPageSkeleton />} />}
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

const renderRoutes = (location?: string) => <AppRoutes location={location} />

export default function App() {
  if (!isFirebaseConfigured) return <FirebaseNotConfigured />

  return (
    <AuthProvider>
      <FamilyProvider>
        <BrowserRouter>
          {/* Vuốt ngang giữa màn hình chính và 2 màn hình 2 bên */}
          <SideSwipe render={renderRoutes} />
          {/* Vòng xoay nhỏ góc trái dưới khi trang đang hiện dữ liệu nhớ tạm và cập nhật lại từ server */}
          <RefreshIndicator />
          {/* Bong bóng thông báo nổi trên mọi màn hình (kéo được, kéo vào X để ẩn khi không có thông báo) */}
          <NotificationBubble />
        </BrowserRouter>
      </FamilyProvider>
    </AuthProvider>
  )
}
