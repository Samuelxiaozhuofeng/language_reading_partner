import type { Session, User } from '@supabase/supabase-js'

export const MIN_PASSWORD_LENGTH = 6

export function normalizeAuthEmail(email: string) {
  return email.trim()
}

export function getSessionUser(session: Session | null): User | null {
  return session?.user ?? null
}

export function validatePasswordAuthInput(
  email: string,
  password: string,
  options?: { requireMinimumLength?: boolean },
) {
  const trimmedEmail = normalizeAuthEmail(email)

  if (!trimmedEmail || !password) {
    return { email: trimmedEmail, error: '请输入邮箱和密码。' }
  }

  if (options?.requireMinimumLength && password.length < MIN_PASSWORD_LENGTH) {
    return { email: trimmedEmail, error: `密码至少需要 ${MIN_PASSWORD_LENGTH} 个字符。` }
  }

  return { email: trimmedEmail, error: '' }
}
