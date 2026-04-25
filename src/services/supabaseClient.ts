import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const supabasePublishableKey = import.meta.env
  .VITE_PUBLIC_SUPABASE_PUBLISHABLE_KEY as string | undefined

function requireEnv(name: string, value: string | undefined) {
  if (!value) throw new Error(`Missing environment variable: ${name}`)
  return value
}

export const supabase = createClient(
  requireEnv('VITE_SUPABASE_URL', supabaseUrl),
  requireEnv('VITE_PUBLIC_SUPABASE_PUBLISHABLE_KEY', supabasePublishableKey),
  {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    realtime: { params: { eventsPerSecond: 20 } },
  },
)

