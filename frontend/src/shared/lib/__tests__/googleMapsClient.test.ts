import { describe, it, expect } from 'vitest'

describe('googleMapsClient', () => {
  it('exports a typed const object with no network calls', async () => {
    const mod = await import('../googleMapsClient')
    const { googleMapsClient } = mod

    // Must be an empty object — no API key, no initialization
    expect(googleMapsClient).toBeDefined()
    expect(typeof googleMapsClient).toBe('object')
    expect(Object.keys(googleMapsClient)).toHaveLength(0)
  })

  it('has no function exports (no network calls)', async () => {
    const mod = await import('../googleMapsClient')

    // Verify there are no function exports that could make network calls
    for (const key of Object.keys(mod)) {
      expect(typeof (mod as Record<string, unknown>)[key]).not.toBe('function')
    }
  })
})
