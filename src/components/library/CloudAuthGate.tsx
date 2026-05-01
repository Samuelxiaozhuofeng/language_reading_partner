import { useState } from 'react'
import { MIN_PASSWORD_LENGTH } from '../../lib/supabase/auth'

type AuthMode = 'sign-in' | 'sign-up'

type CloudAuthGateProps = {
  authError: string
  authNotice: string
  isAuthConfigured: boolean
  isAuthLoading: boolean
  isAuthSubmitting: boolean
  onSignIn: (email: string, password: string) => void | Promise<void>
  onResendConfirmation: (email: string) => void | Promise<void>
  onSignUp: (email: string, password: string) => void | Promise<void>
  pendingConfirmationEmail?: string | null
}

function CloudAuthGate({
  authError,
  authNotice,
  isAuthConfigured,
  isAuthLoading,
  isAuthSubmitting,
  onResendConfirmation,
  onSignIn,
  onSignUp,
  pendingConfirmationEmail,
}: CloudAuthGateProps) {
  const [authMode, setAuthMode] = useState<AuthMode>('sign-in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmedPassword, setConfirmedPassword] = useState('')
  const isSignUp = authMode === 'sign-up'
  const passwordMismatch = isSignUp && confirmedPassword.length > 0 && password !== confirmedPassword
  const isSubmitDisabled = isAuthSubmitting || (isSignUp && password !== confirmedPassword)
  const confirmationEmail = pendingConfirmationEmail ?? email

  return (
    <main className="auth-gate">
      <section className="panel auth-panel">
        <div className="panel-header auth-panel-header">
          <div>
            <p className="section-kicker">Cloud Library</p>
            <h2>{isSignUp ? '注册云端书架' : '登录云端书架'}</h2>
          </div>
          <div className="settings-tabs auth-tabs" role="tablist" aria-label="登录方式">
            <button
              className={`settings-tab ${authMode === 'sign-in' ? 'is-active' : ''}`}
              type="button"
              role="tab"
              aria-selected={authMode === 'sign-in'}
              onClick={() => setAuthMode('sign-in')}
            >
              登录
            </button>
            <button
              className={`settings-tab ${authMode === 'sign-up' ? 'is-active' : ''}`}
              type="button"
              role="tab"
              aria-selected={authMode === 'sign-up'}
              onClick={() => setAuthMode('sign-up')}
            >
              注册
            </button>
          </div>
        </div>

        {isAuthLoading ? (
          <p className="notice">正在恢复登录状态...</p>
        ) : !isAuthConfigured ? (
          <p className="notice error">
            缺少 Supabase 环境变量。请在 Vercel 配置 VITE_SUPABASE_URL 和
            VITE_SUPABASE_PUBLISHABLE_KEY。
          </p>
        ) : (
          <form
            className="auth-form"
            onSubmit={(event) => {
              event.preventDefault()
              if (isSignUp) {
                if (password !== confirmedPassword) {
                  return
                }

                void onSignUp(email, password)
                return
              }

              void onSignIn(email, password)
            }}
          >
            <label className="field">
              <span>邮箱</span>
              <input
                autoComplete="email"
                inputMode="email"
                onChange={(event) => setEmail(event.currentTarget.value)}
                placeholder="you@example.com"
                required
                type="email"
                value={email}
              />
            </label>

            <label className="field">
              <span>密码</span>
              <input
                autoComplete={isSignUp ? 'new-password' : 'current-password'}
                minLength={MIN_PASSWORD_LENGTH}
                onChange={(event) => setPassword(event.currentTarget.value)}
                placeholder={`至少 ${MIN_PASSWORD_LENGTH} 个字符`}
                required
                type="password"
                value={password}
              />
            </label>

            {isSignUp ? (
              <label className="field">
                <span>确认密码</span>
                <input
                  autoComplete="new-password"
                  minLength={MIN_PASSWORD_LENGTH}
                  onChange={(event) => setConfirmedPassword(event.currentTarget.value)}
                  placeholder="再次输入密码"
                  required
                  type="password"
                  value={confirmedPassword}
                />
              </label>
            ) : null}

            {passwordMismatch ? <p className="notice error">两次输入的密码不一致。</p> : null}
            {authNotice ? <p className="notice success">{authNotice}</p> : null}
            {pendingConfirmationEmail ? (
              <div className="auth-confirmation-actions">
                <p className="panel-meta">没有收到邮件时，可以重新发送到 {pendingConfirmationEmail}。</p>
                <button
                  className="ghost-button"
                  disabled={isAuthSubmitting}
                  type="button"
                  onClick={() => void onResendConfirmation(confirmationEmail)}
                >
                  重新发送确认邮件
                </button>
              </div>
            ) : null}
            {authError ? <p className="notice error">{authError}</p> : null}

            <div className="panel-actions">
              <button
                className="primary-button"
                disabled={isSubmitDisabled}
                type="submit"
              >
                {isAuthSubmitting ? '处理中...' : isSignUp ? '注册账号' : '登录'}
              </button>
              <button
                className="ghost-button"
                disabled={isAuthSubmitting}
                type="button"
                onClick={() => setAuthMode(isSignUp ? 'sign-in' : 'sign-up')}
              >
                {isSignUp ? '已有账号，去登录' : '没有账号，去注册'}
              </button>
            </div>
          </form>
        )}
      </section>
    </main>
  )
}

export default CloudAuthGate
