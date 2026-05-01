import { createClient } from '@supabase/supabase-js'
import type { Database } from './database'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim() ?? ''
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ?? ''

export const isSupabaseConfigured = Boolean(supabaseUrl && supabasePublishableKey)

export function getSupabaseClient() {
  if (!isSupabaseConfigured) {
    throw new Error('缺少 Supabase 配置，请设置 VITE_SUPABASE_URL 和 VITE_SUPABASE_PUBLISHABLE_KEY。')
  }

  return createClient<Database>(supabaseUrl, supabasePublishableKey)
}

export const supabase = isSupabaseConfigured ? getSupabaseClient() : null
