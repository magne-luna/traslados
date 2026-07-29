import { describe, it, expect, vi, beforeAll, beforeEach, afterAll, afterEach } from 'vitest'

// Mock @supabase/supabase-js before any imports of supabaseClient
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    auth: {},
    storage: {},
    from: vi.fn(),
  })),
}))

describe('supabaseClient', () => {
  beforeAll(() => {
    vi.stubEnv('SUPABASE_URL', 'https://test-project.supabase.co')
    vi.stubEnv('SUPABASE_ANON_KEY', 'test-anon-key-123')
  })

  afterAll(() => {
    vi.unstubAllEnvs()
  })

  it('exports a singleton SupabaseClient initialized from env vars', async () => {
    const { createClient } = await import('@supabase/supabase-js')
    const { supabase } = await import('../supabaseClient')

    // createClient was called exactly once with the correct env vars
    expect(createClient).toHaveBeenCalledOnce()
    expect(createClient).toHaveBeenCalledWith(
      'https://test-project.supabase.co',
      'test-anon-key-123',
    )

    // The exported instance is a valid SupabaseClient-shaped object
    expect(supabase).toBeDefined()
    expect(supabase.auth).toBeDefined()
    expect(supabase.storage).toBeDefined()

    // The client can build queries via from()
    expect(supabase.from).toBeInstanceOf(Function)
    supabase.from('test_table')
    expect(supabase.from).toHaveBeenCalledWith('test_table')
  })
})

// tasks.md 1.2/1.3 (auth-frontend-real): sin esto, createClient(undefined, undefined) revienta
// con un error críptico de @supabase/supabase-js en vez de nombrar la variable de entorno que
// falta. Cada test recarga el módulo desde cero (vi.resetModules) porque la validación corre al
// evaluar el módulo, no en una función expuesta.
describe('supabaseClient — validación de variables de entorno', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('falla nombrando SUPABASE_URL cuando falta', async () => {
    vi.stubEnv('SUPABASE_URL', '')
    vi.stubEnv('SUPABASE_ANON_KEY', 'test-anon-key-123')

    await expect(import('../supabaseClient')).rejects.toThrow(/SUPABASE_URL/)
  })

  it('falla nombrando SUPABASE_ANON_KEY cuando falta', async () => {
    vi.stubEnv('SUPABASE_URL', 'https://test-project.supabase.co')
    vi.stubEnv('SUPABASE_ANON_KEY', '')

    await expect(import('../supabaseClient')).rejects.toThrow(/SUPABASE_ANON_KEY/)
  })

  it('con ambas variables presentes no falla', async () => {
    vi.stubEnv('SUPABASE_URL', 'https://test-project.supabase.co')
    vi.stubEnv('SUPABASE_ANON_KEY', 'test-anon-key-123')

    await expect(import('../supabaseClient')).resolves.toBeDefined()
  })
})
