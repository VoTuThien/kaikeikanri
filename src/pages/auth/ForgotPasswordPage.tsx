import { useState, type FormEvent } from 'react'
import { AuthLayout, AuthLayoutSkeleton } from '../../components/AuthLayout'
import { Alert } from '../../components/ui/Alert'
import { Button, LinkButton } from '../../components/ui/Button'
import { Skeleton } from '../../components/ui/Skeleton'
import { TextField, TextFieldSkeleton } from '../../components/ui/TextField'
import { SIZE } from '../../components/ui/sizes'
import { useAuth } from '../../contexts/AuthContext'
import { getAuthErrorMessage } from '../../lib/authErrors'

export function ForgotPasswordPage() {
  const { resetPassword } = useAuth()
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setSent(false)
    setSubmitting(true)
    try {
      await resetPassword(email.trim())
      setSent(true)
    } catch (err) {
      setError(getAuthErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout title="Quên mật khẩu" subtitle="Nhập email để nhận link đặt lại mật khẩu">
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <TextField
          id="email"
          label="Email"
          type="email"
          autoComplete="email"
          inputMode="email"
          placeholder="ban@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        {error && <Alert type="error">{error}</Alert>}
        {sent && (
          <Alert type="success">
            Nếu email này đã đăng ký, bạn sẽ nhận được link đặt lại mật khẩu. Hãy kiểm tra cả hộp thư Spam nhé.
          </Alert>
        )}
        <div className="space-y-3 pt-2">
          <Button type="submit" loading={submitting}>
            Gửi link đặt lại mật khẩu
          </Button>
          <LinkButton to="/login">Quay lại đăng nhập</LinkButton>
        </div>
      </form>
    </AuthLayout>
  )
}

export function ForgotPasswordPageSkeleton() {
  return (
    <AuthLayoutSkeleton>
      <div className="space-y-4">
        <TextFieldSkeleton />
        <div className="space-y-3 pt-2">
          <Skeleton className={`${SIZE.control} w-full`} />
          <Skeleton className={`${SIZE.control} w-full`} />
        </div>
      </div>
    </AuthLayoutSkeleton>
  )
}
