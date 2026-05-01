import { useCallback, useEffect, useState } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { isSupabaseConfigured, supabase } from '../lib/supabase/client'

export function useSupabaseAuth() {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [isAuthLoading, setIsAuthLoading] = useState(isSupabaseConfigured)
  const [authError, setAuthError] = useState('')
  const [authNotice, setAuthNotice] = useState('')

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

  const signInWithPassword = useCallback(async (email: string, password: string) => {
    const trimmedEmail = email.trim()
    const trimmedPassword = password.trim()
    if (!supabase) {
      setAuthError('缺少 Supabase 配置，暂时无法登录。')
      return
    }

    if (!trimmedEmail || !trimmedPassword) {
      setAuthError('请输入邮箱和密码。')
      return
    }

    setAuthError('')
    setAuthNotice('')
    const { data, error } = await supabase.auth.signInWithPassword({
      email: trimmedEmail,
      password: trimmedPassword,
    })

    if (error) {
      setAuthError(error.message)
      return
    }

    setSession(data.session)
    setUser(data.user)
    setAuthNotice('已登录，正在载入云端书架。')
  }, [])

  const signUpWithPassword = useCallback(async (email: string, password: string) => {
    const trimmedEmail = email.trim()
    const trimmedPassword = password.trim()
    if (!supabase) {
      setAuthError('缺少 Supabase 配置，暂时无法注册。')
      return
    }

    if (!trimmedEmail || !trimmedPassword) {
      setAuthError('请输入邮箱和密码。')
      return
    }

    if (trimmedPassword.length < 6) {
      setAuthError('密码至少需要 6 个字符。')
      return
    }

    setAuthError('')
    setAuthNotice('')
    const { data, error } = await supabase.auth.signUp({
      email: trimmedEmail,
      password: trimmedPassword,
    })

    if (error) {
      setAuthError(error.message)
      return
    }

    setSession(data.session)
    setUser(data.user)
    setAuthNotice(
      data.session
        ? '注册成功，正在载入云端书架。'
        : '注册成功，请先按 Supabase 邮件完成邮箱确认，然后回到这里登录。',
    )
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
    session,
    signInWithPassword,
    signOut,
    signUpWithPassword,
    user,
  }
}
