import { useState } from 'react'

type CloudAuthGateProps = {
  authError: string
  authNotice: string
  isAuthConfigured: boolean
  isAuthLoading: boolean
  onSendLoginCode: (email: string) => void | Promise<void>
  onVerifyLoginCode: (email: string, token: string) => void | Promise<void>
  pendingEmail: string
}

function CloudAuthGate({
  authError,
  authNotice,
  isAuthConfigured,
  isAuthLoading,
  onSendLoginCode,
  onVerifyLoginCode,
  pendingEmail,
}: CloudAuthGateProps) {
  const [email, setEmail] = useState(pendingEmail)
  const [token, setToken] = useState('')

  return (
    <main className="auth-gate">
      <section className="panel auth-panel">
        <div className="panel-header">
          <div>
            <p className="section-kicker">Cloud Library</p>
            <h2>登录云端书架</h2>
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
              if (pendingEmail) {
                void onVerifyLoginCode(pendingEmail || email, token)
                return
              }

              void onSendLoginCode(email)
            }}
          >
            <label className="field">
              <span>邮箱</span>
              <input
                autoComplete="email"
                inputMode="email"
                onChange={(event) => setEmail(event.currentTarget.value)}
                placeholder="you@example.com"
                type="email"
                value={email}
              />
            </label>

            {pendingEmail ? (
              <label className="field">
                <span>验证码</span>
                <input
                  autoComplete="one-time-code"
                  inputMode="numeric"
                  onChange={(event) => setToken(event.currentTarget.value)}
                  placeholder="6 位验证码"
                  type="text"
                  value={token}
                />
              </label>
            ) : null}

            {authNotice ? <p className="notice success">{authNotice}</p> : null}
            {authError ? <p className="notice error">{authError}</p> : null}

            <div className="panel-actions">
              <button className="primary-button" type="submit">
                {pendingEmail ? '验证并登录' : '发送验证码'}
              </button>
              {pendingEmail ? (
                <button
                  className="ghost-button"
                  type="button"
                  onClick={() => void onSendLoginCode(email)}
                >
                  重新发送
                </button>
              ) : null}
            </div>
          </form>
        )}
      </section>
    </main>
  )
}

export default CloudAuthGate
