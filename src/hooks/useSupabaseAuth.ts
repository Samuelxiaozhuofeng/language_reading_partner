import { useCallback, useEffect, useState } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { isSupabaseConfigured, supabase } from '../lib/supabase/client'

export function useSupabaseAuth() {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [isAuthLoading, setIsAuthLoading] = useState(isSupabaseConfigured)
  const [authError, setAuthError] = useState('')
  const [authNotice, setAuthNotice] = useState('')
  const [pendingEmail, setPendingEmail] = useState('')

  useEffect(() => {
    if (!supabase) {
      return
    }
    const client = supabase

    let isCancelled = false

    async function restoreSession() {
      const { data, error } = await client.auth.getSession()
      if (isCancelled) {
        return
      }

      if (error) {
        setAuthError(error.message)
      }

      setSession(data.session)
      setUser(data.session?.user ?? null)
      setIsAuthLoading(false)
    }

    void restoreSession()

    const { data } = client.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setUser(nextSession?.user ?? null)
      if (nextSession?.user) {
        setAuthError('')
      }
    })

    return () => {
      isCancelled = true
      data.subscription.unsubscribe()
    }
  }, [])

  const sendLoginCode = useCallback(async (email: string) => {
    const trimmedEmail = email.trim()
    if (!supabase) {
      setAuthError('缺少 Supabase 配置，暂时无法登录。')
      return
    }

    if (!trimmedEmail) {
      setAuthError('请输入邮箱地址。')
      return
    }

    setAuthError('')
    setAuthNotice('')
    const { error } = await supabase.auth.signInWithOtp({
      email: trimmedEmail,
      options: {
        shouldCreateUser: true,
      },
    })

    if (error) {
      setAuthError(error.message)
      return
    }

    setPendingEmail(trimmedEmail)
    setAuthNotice('验证码已发送，请检查邮箱。')
  }, [])

  const verifyLoginCode = useCallback(async (email: string, token: string) => {
    const trimmedEmail = email.trim()
    const trimmedToken = token.trim()
    if (!supabase) {
      setAuthError('缺少 Supabase 配置，暂时无法登录。')
      return
    }

    if (!trimmedEmail || !trimmedToken) {
      setAuthError('请输入邮箱和验证码。')
      return
    }

    setAuthError('')
    setAuthNotice('')
    const { data, error } = await supabase.auth.verifyOtp({
      email: trimmedEmail,
      token: trimmedToken,
      type: 'email',
    })

    if (error) {
      setAuthError(error.message)
      return
    }

    setSession(data.session)
    setUser(data.user)
    setPendingEmail('')
    setAuthNotice('已登录，正在载入云端书架。')
  }, [])

  const signOut = useCallback(async () => {
    if (!supabase) {
      return
    }

    const { error } = await supabase.auth.signOut()
    if (error) {
      setAuthError(error.message)
      return
    }

    setSession(null)
    setUser(null)
    setAuthNotice('已退出登录。')
  }, [])

  return {
    authError,
    authNotice,
    isAuthConfigured: isSupabaseConfigured,
    isAuthLoading,
    pendingEmail,
    sendLoginCode,
    session,
    signOut,
    user,
    verifyLoginCode,
  }
}
