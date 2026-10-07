import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Tras un deploy nuevo en Vercel, una pestaña abierta con la versión anterior pide chunks con
// hash viejo (ej. `RequisitosActividadRoute-<hash>.js`) que ya no existen → "Failed to fetch
// dynamically imported module". Vite emite `vite:preloadError` en ese caso: recargamos para
// traer el index.html nuevo. La marca en sessionStorage evita un loop de recargas si el chunk
// realmente no existe (sólo se reintenta una vez cada 10 s).
const CLAVE_RECARGA_CHUNK = 'recarga-por-chunk-viejo'
window.addEventListener('vite:preloadError', (event) => {
  try {
    const ultima = Number(sessionStorage.getItem(CLAVE_RECARGA_CHUNK) ?? 0)
    if (Date.now() - ultima < 10_000) return
    sessionStorage.setItem(CLAVE_RECARGA_CHUNK, String(Date.now()))
  } catch {
    // sessionStorage bloqueado: sin la marca no hay forma de cortar un loop → no recargar.
    return
  }
  event.preventDefault()
  window.location.reload()
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
