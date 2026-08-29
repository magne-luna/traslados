import type { ReactElement } from 'react';

// code-splitting-rutas: lo que se ve mientras baja el chunk de una pantalla.
//
// react-router lo exige como `HydrateFallback` en la raíz cuando la ruta inicial es `lazy`: sin
// esto, la primera carga renderiza un `<div />` vacío hasta que llega el módulo — pantalla en
// blanco, no un estado de carga. En las navegaciones POSTERIORES no aparece: react-router conserva
// la pantalla anterior mientras resuelve el `lazy`, así que no hay parpadeo entre módulos.
//
// Misma tipografía y mismo tono de "muted" que los estados de carga que ya usan los listados
// (`<p className="font-body text-sm text-muted">Cargando X…</p>`), para que la primera carga no se
// vea como una pantalla ajena a la app.
export function CargandoPantalla(): ReactElement {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="font-body text-sm text-muted" role="status">
        Cargando…
      </p>
    </div>
  );
}
