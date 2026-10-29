import { FirebaseError } from 'firebase/app'

const MESSAGES: Record<string, string> = {
  'auth/invalid-email': 'Email không hợp lệ.',
  'auth/missing-email': 'Vui lòng nhập email.',
  'auth/missing-password': 'Vui lòng nhập mật khẩu.',
  'auth/invalid-credential': 'Email hoặc mật khẩu không đúng.',
  'auth/wrong-password': 'Email hoặc mật khẩu không đúng.',
  'auth/user-not-found': 'Email hoặc mật khẩu không đúng.',
  'auth/user-disabled': 'Tài khoản này đã bị khoá.',
  'auth/email-already-in-use': 'Email này đã được đăng ký.',
  'auth/weak-password': 'Mật khẩu phải có ít nhất 6 ký tự.',
  'auth/too-many-requests': 'Bạn thử quá nhiều lần. Vui lòng đợi một lát rồi thử lại.',
  'auth/network-request-failed': 'Không có kết nối mạng. Vui lòng kiểm tra lại.',
  'auth/operation-not-allowed': 'Phương thức đăng nhập Email/Mật khẩu chưa được bật trong Firebase.',
}

// Chuyển mã lỗi Firebase sang câu thông báo tiếng Việt
export function getAuthErrorMessage(error: unknown): string {
  if (error instanceof FirebaseError) {
    return MESSAGES[error.code] ?? `Đã có lỗi xảy ra (${error.code}).`
  }
  return 'Đã có lỗi xảy ra. Vui lòng thử lại.'
}
