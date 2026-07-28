import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'

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
