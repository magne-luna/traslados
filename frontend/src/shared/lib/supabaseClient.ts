import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// tasks.md 1.2/1.3 (auth-frontend-real): sin esta validación, createClient(undefined, undefined)
// falla con un error críptico interno de @supabase/supabase-js. Nombrar la variable faltante
// ahorra un ida y vuelta de debugging la primera vez que alguien arranca el proyecto sin
// `.env.local` (ver frontend/.env.example — el prefijo no es `VITE_`, ver envPrefix de
// vite.config.ts).
function requireEnv(name: 'SUPABASE_URL' | 'SUPABASE_ANON_KEY'): string {
  const value = import.meta.env[name]
  if (!value) {
    throw new Error(
      `Falta la variable de entorno ${name}. Definila en frontend/.env.local (ver .env.example).`,
    )
  }
  return value
}

const supabaseUrl: string = requireEnv('SUPABASE_URL')
const supabaseAnonKey: string = requireEnv('SUPABASE_ANON_KEY')

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey)
