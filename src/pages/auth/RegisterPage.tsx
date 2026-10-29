import { useState, type FormEvent } from 'react'
import { AuthLayout, AuthLayoutSkeleton } from '../../components/AuthLayout'
import { Alert } from '../../components/ui/Alert'
import { Button, LinkButton } from '../../components/ui/Button'
import { Skeleton } from '../../components/ui/Skeleton'
import { TextField, TextFieldSkeleton } from '../../components/ui/TextField'
import { SIZE } from '../../components/ui/sizes'
import { useAuth } from '../../contexts/AuthContext'
import { getAuthErrorMessage } from '../../lib/authErrors'

export function RegisterPage() {
  const { register } = useAuth()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (!name.trim()) return setError('Vui lòng nhập họ tên.')
    if (password.length < 6) return setError('Mật khẩu phải có ít nhất 6 ký tự.')
    if (password !== confirm) return setError('Mật khẩu nhập lại không khớp.')

    setSubmitting(true)
    try {
      await register(name.trim(), email.trim(), password)
    } catch (err) {
      setError(getAuthErrorMessage(err))
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout title="Tạo tài khoản" subtitle="Bắt đầu quản lý các nhóm quỹ của bạn">
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <TextField
          id="name"
          label="Họ tên"
          autoComplete="name"
          placeholder="Nguyễn Văn A"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
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
        {/* 2 ô mật khẩu cạnh nhau để màn hình gọn, không phải cuộn */}
        <div className="grid grid-cols-2 gap-3">
          <TextField
            id="password"
            label="Mật khẩu"
            type="password"
            autoComplete="new-password"
            placeholder="≥ 6 ký tự"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <TextField
            id="confirm"
            label="Nhập lại"
            type="password"
            autoComplete="new-password"
            placeholder="••••••"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
          />
        </div>
        {error && <Alert type="error">{error}</Alert>}
        <div className="space-y-3 pt-2">
          <Button type="submit" loading={submitting}>
            Tạo tài khoản
          </Button>
          <LinkButton to="/login">Đã có tài khoản? Đăng nhập</LinkButton>
        </div>
      </form>
    </AuthLayout>
  )
}

export function RegisterPageSkeleton() {
  return (
    <AuthLayoutSkeleton>
      <div className="space-y-4">
        <TextFieldSkeleton />
        <TextFieldSkeleton />
        <div className="grid grid-cols-2 gap-3">
          <TextFieldSkeleton />
          <TextFieldSkeleton />
        </div>
        <div className="space-y-3 pt-2">
          <Skeleton className={`${SIZE.control} w-full`} />
          <Skeleton className={`${SIZE.control} w-full`} />
        </div>
      </div>
    </AuthLayoutSkeleton>
  )
}
