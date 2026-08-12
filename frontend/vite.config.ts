import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  envPrefix: ['VITE_', 'SUPABASE_'],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    // Nunca heredar `VITE_GOOGLE_MAPS_API_KEY` (u otras VITE_*) de `.env.local` del desarrollador:
    // los tests que afirman "sin key" (`googleMapsClient.test.ts`) dependen de que arranque vacía,
    // `vi.stubEnv`/`vi.unstubAllEnvs` la pisan por test según haga falta.
    env: {
      VITE_GOOGLE_MAPS_API_KEY: '',
    },
  },
})
