import { useState, type FormEvent } from 'react'
import { AuthLayout, AuthLayoutSkeleton } from '../../components/AuthLayout'
import { Alert } from '../../components/ui/Alert'
import { Button, LinkButton } from '../../components/ui/Button'
import { Skeleton } from '../../components/ui/Skeleton'
import { TextField, TextFieldSkeleton } from '../../components/ui/TextField'
import { SIZE } from '../../components/ui/sizes'
import { useAuth } from '../../contexts/AuthContext'
import { getAuthErrorMessage } from '../../lib/authErrors'

export function LoginPage() {
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await login(email.trim(), password)
    } catch (err) {
      setError(getAuthErrorMessage(err))
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout title="Đăng nhập" subtitle="Chào mừng bạn quay lại quản lý quỹ">
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
        <TextField
          id="password"
          label="Mật khẩu"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {error && <Alert type="error">{error}</Alert>}
        <div className="space-y-3 pt-2">
          <Button type="submit" loading={submitting}>
            Đăng nhập
          </Button>
          <div className="grid grid-cols-2 gap-3">
            <LinkButton to="/forgot-password">Quên mật khẩu</LinkButton>
            <LinkButton to="/register">Tạo tài khoản</LinkButton>
          </div>
        </div>
      </form>
    </AuthLayout>
  )
}

export function LoginPageSkeleton() {
  return (
    <AuthLayoutSkeleton>
      <div className="space-y-4">
        <TextFieldSkeleton />
        <TextFieldSkeleton />
        <div className="space-y-3 pt-2">
          <Skeleton className={`${SIZE.control} w-full`} />
          <div className="grid grid-cols-2 gap-3">
            <Skeleton className={SIZE.control} />
            <Skeleton className={SIZE.control} />
          </div>
        </div>
      </div>
    </AuthLayoutSkeleton>
  )
}
