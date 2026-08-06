import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { geocodificarDireccion, parseGeocodingResponse } from '../googleMapsClient'

// Tests del cliente real de Geocoding (change hojas-de-ruta-geocoding, RF-701). Nunca golpea la
// red real: `fetch` global se mockea por test. La API key sale de `import.meta.env` — se
// stubea/limpia con `vi.stubEnv`/`vi.unstubAllEnvs`, mismo patrón que `RecorridoMapa.test.tsx`.

const RESPUESTA_OK = {
  status: 'OK',
  results: [{ geometry: { location: { lat: -34.6037, lng: -58.3816 } } }],
}

describe('parseGeocodingResponse (pura, sin red)', () => {
  it('extrae lat/lng del happy path', () => {
    expect(parseGeocodingResponse(RESPUESTA_OK)).toEqual({ lat: -34.6037, lng: -58.3816 })
  })

  it('status distinto de OK (ZERO_RESULTS) -> undefined', () => {
    expect(parseGeocodingResponse({ status: 'ZERO_RESULTS', results: [] })).toBeUndefined()
  })

  it('status distinto de OK (REQUEST_DENIED, key inválida) -> undefined', () => {
    expect(parseGeocodingResponse({ status: 'REQUEST_DENIED', error_message: 'invalid key' })).toBeUndefined()
  })

  it('results vacío con status OK (caso defensivo) -> undefined', () => {
    expect(parseGeocodingResponse({ status: 'OK', results: [] })).toBeUndefined()
  })

  it('results ausente -> undefined', () => {
    expect(parseGeocodingResponse({ status: 'OK' })).toBeUndefined()
  })

  it('geometry.location con lat/lng no numéricos -> undefined', () => {
    expect(
      parseGeocodingResponse({ status: 'OK', results: [{ geometry: { location: { lat: '1', lng: '2' } } }] }),
    ).toBeUndefined()
  })

  it('forma completamente inesperada (no objeto) -> undefined, sin lanzar', () => {
    expect(parseGeocodingResponse(null)).toBeUndefined()
    expect(parseGeocodingResponse('texto')).toBeUndefined()
    expect(parseGeocodingResponse(42)).toBeUndefined()
    expect(parseGeocodingResponse(undefined)).toBeUndefined()
  })

  it('geometry/location ausentes -> undefined', () => {
    expect(parseGeocodingResponse({ status: 'OK', results: [{}] })).toBeUndefined()
    expect(parseGeocodingResponse({ status: 'OK', results: [{ geometry: {} }] })).toBeUndefined()
  })
})

describe('geocodificarDireccion', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_GOOGLE_MAPS_API_KEY', 'fake-key-de-test')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('happy path: llama a fetch con la URL de la Geocoding API y devuelve la coordenada', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(RESPUESTA_OK),
    })
    vi.stubGlobal('fetch', fetchMock)

    const resultado = await geocodificarDireccion({ calle: 'Av. Santa Fe 1234', localidad: 'CABA' })

    expect(resultado).toEqual({ lat: -34.6037, lng: -58.3816 })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url] = fetchMock.mock.calls[0] as [string]
    expect(url).toContain('https://maps.googleapis.com/maps/api/geocode/json')
    expect(url).toContain('key=fake-key-de-test')
    // `URLSearchParams` codifica como `application/x-www-form-urlencoded` (espacios -> `+`), no
    // como `encodeURIComponent` (espacios -> `%20`) — se decodifica el param en vez de comparar
    // contra la forma cruda codificada.
    const address = new URL(url).searchParams.get('address')
    expect(address).toBe('Av. Santa Fe 1234, CABA')
  })

  it('sin API key configurada (env var ausente) -> undefined, sin llamar a fetch', async () => {
    vi.unstubAllEnvs()
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const resultado = await geocodificarDireccion({ calle: 'Corrientes 1000', localidad: 'CABA' })

    expect(resultado).toBeUndefined()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('API key vacía (cadena "") -> undefined, sin llamar a fetch', async () => {
    vi.unstubAllEnvs()
    vi.stubEnv('VITE_GOOGLE_MAPS_API_KEY', '')
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const resultado = await geocodificarDireccion({ calle: 'Corrientes 1000', localidad: 'CABA' })

    expect(resultado).toBeUndefined()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('dirección con calle vacía -> undefined, sin llamar a fetch (nunca geocodifica basura)', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const resultado = await geocodificarDireccion({ calle: '   ', localidad: 'CABA' })

    expect(resultado).toBeUndefined()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('dirección con localidad vacía -> undefined, sin llamar a fetch', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const resultado = await geocodificarDireccion({ calle: 'Corrientes 1000', localidad: '' })

    expect(resultado).toBeUndefined()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('respuesta HTTP no-ok (ej. 403/500) -> undefined, no lanza', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json: () => Promise.resolve({}) }))

    const resultado = await geocodificarDireccion({ calle: 'Corrientes 1000', localidad: 'CABA' })

    expect(resultado).toBeUndefined()
  })

  it('error de red (fetch rechaza) -> undefined, no lanza', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')))

    await expect(geocodificarDireccion({ calle: 'Corrientes 1000', localidad: 'CABA' })).resolves.toBeUndefined()
  })

  it('JSON malformado (json() rechaza) -> undefined, no lanza', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: () => Promise.reject(new Error('invalid json')) }),
    )

    await expect(geocodificarDireccion({ calle: 'Corrientes 1000', localidad: 'CABA' })).resolves.toBeUndefined()
  })

  it('status ZERO_RESULTS (dirección no encontrada) -> undefined, no lanza', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ status: 'ZERO_RESULTS', results: [] }) }),
    )

    const resultado = await geocodificarDireccion({ calle: 'dirección inexistente asdkjh', localidad: 'CABA' })

    expect(resultado).toBeUndefined()
  })
})
