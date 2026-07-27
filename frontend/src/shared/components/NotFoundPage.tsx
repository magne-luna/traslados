import { Link } from 'react-router';
import { Button } from '../../design-system/components';

// Manejo de ruta desconocida (spec app-routing): nunca dejar la app en blanco.
export function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-md bg-bg p-xl text-center">
      <h1 className="m-0 font-heading text-2xl font-bold text-ink">Página no encontrada</h1>
      <p className="m-0 font-body text-sm text-muted">La ruta a la que intentaste acceder no existe.</p>
      <Link to="/" className="no-underline">
        <Button variant="primary">Volver al Dashboard</Button>
      </Link>
    </div>
  );
}
