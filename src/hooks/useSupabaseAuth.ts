import { useCallback, useEffect, useState } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { getSessionUser, normalizeAuthEmail, validatePasswordAuthInput } from '../lib/supabase/auth'
import { isSupabaseConfigured, supabase } from '../lib/supabase/client'

export function useSupabaseAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [isAuthLoading, setIsAuthLoading] = useState(isSupabaseConfigured)
  const [isAuthSubmitting, setIsAuthSubmitting] = useState(false)
  const [authError, setAuthError] = useState('')
  const [authNotice, setAuthNotice] = useState('')
  const [pendingConfirmationEmail, setPendingConfirmationEmail] = useState<string | null>(null)

  const applySession = useCallback((nextSession: Session | null) => {
    setUser(getSessionUser(nextSession))
  }, [])

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

      applySession(data.session)
      setIsAuthLoading(false)
    }

    void restoreSession()

    const { data } = client.auth.onAuthStateChange((_event, nextSession) => {
      applySession(nextSession)
      if (nextSession?.user) {
        setAuthError('')
        setPendingConfirmationEmail(null)
      }
    })

    return () => {
      isCancelled = true
      data.subscription.unsubscribe()
    }
  }, [applySession])

  const signInWithPassword = useCallback(async (email: string, password: string) => {
    if (!supabase) {
      setAuthError('缺少 Supabase 配置，暂时无法登录。')
      return
    }

    const validation = validatePasswordAuthInput(email, password)
    if (validation.error) {
      setAuthError(validation.error)
      return
    }

    setAuthError('')
    setAuthNotice('')
    setIsAuthSubmitting(true)
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: validation.email,
        password,
      })

      if (error) {
        applySession(null)
        setAuthError(error.message)
        return
      }

      if (!data.session) {
        applySession(null)
        setPendingConfirmationEmail(validation.email)
        setAuthNotice('还没有有效登录会话。请先完成邮箱确认，然后再登录。')
        return
      }

      applySession(data.session)
      setPendingConfirmationEmail(null)
      setAuthNotice('已登录，正在载入云端书架。')
    } finally {
      setIsAuthSubmitting(false)
    }
  }, [applySession])

  const signUpWithPassword = useCallback(async (email: string, password: string) => {
    if (!supabase) {
      setAuthError('缺少 Supabase 配置，暂时无法注册。')
      return
    }

    const validation = validatePasswordAuthInput(email, password, { requireMinimumLength: true })
    if (validation.error) {
      setAuthError(validation.error)
      return
    }

    setAuthError('')
    setAuthNotice('')
    setIsAuthSubmitting(true)
    try {
      const { data, error } = await supabase.auth.signUp({
        email: validation.email,
        password,
      })

      if (error) {
        applySession(null)
        setAuthError(error.message)
        return
      }

      applySession(data.session)
      if (data.session) {
        setPendingConfirmationEmail(null)
        setAuthNotice('注册成功，正在载入云端书架。')
        return
      }

      setPendingConfirmationEmail(validation.email)
      setAuthNotice('注册申请已提交。请先打开邮箱确认链接，然后回到这里登录。')
    } finally {
      setIsAuthSubmitting(false)
    }
  }, [applySession])

  const resendSignUpConfirmation = useCallback(async (email: string) => {
    const trimmedEmail = normalizeAuthEmail(email)
    if (!supabase) {
      setAuthError('缺少 Supabase 配置，暂时无法重新发送确认邮件。')
      return
    }

    if (!trimmedEmail) {
      setAuthError('请输入邮箱后再重新发送确认邮件。')
      return
    }

    setAuthError('')
    setAuthNotice('')
    setIsAuthSubmitting(true)
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: trimmedEmail,
      })

      if (error) {
        setAuthError(error.message)
        return
      }

      setPendingConfirmationEmail(trimmedEmail)
      setAuthNotice('确认邮件已重新发送，请检查邮箱后再登录。')
    } finally {
      setIsAuthSubmitting(false)
    }
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

    applySession(null)
    setPendingConfirmationEmail(null)
    setAuthNotice('已退出登录。')
  }, [applySession])

  return {
    authError,
    authNotice,
    isAuthConfigured: isSupabaseConfigured,
    isAuthLoading,
    isAuthSubmitting,
    pendingConfirmationEmail,
    resendSignUpConfirmation,
    signInWithPassword,
    signOut,
    signUpWithPassword,
    user,
  }
}
