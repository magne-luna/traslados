import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl: string = import.meta.env.SUPABASE_URL
const supabaseAnonKey: string = import.meta.env.SUPABASE_ANON_KEY

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey)
