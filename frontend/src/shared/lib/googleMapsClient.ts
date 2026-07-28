/**
 * Google Maps client — placeholder.
 *
 * The Google Maps API key is deferred. Initialize the real client with
 * @vis.gl/react-google-maps once the API key is available via env vars.
 *
 * This stub:
 * - Makes NO network calls
 * - Requires NO API key
 * - Exports a typed const for future integration
 * - Compiles to zero bytes after tree-shaking
 */
export const googleMapsClient = {} as const

export type GoogleMapsClient = typeof googleMapsClient
