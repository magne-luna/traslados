import { useState } from 'react';
import type { ObraSocial } from '../../shared/types/obraSocial';
import { ObraSocialDetail } from './ObraSocialDetail';
import { useObraSocialRepository } from './ObraSocialRepositoryContext';
import { ObrasSocialesList } from './ObrasSocialesList';
import { useObrasSociales } from './useObrasSociales';

type View = { kind: 'list' } | { kind: 'detail'; obraSocialId: string | null };

// Composición raíz de la feature (tasks.md 3.2, 7.1): resuelve el repository del context,
// wire de useObrasSociales, y decide qué pantalla mostrar (listado o detalle). No hay router
// anidado — el listado y el detalle son dos vistas del mismo componente de página, montado en
// una única ruta (`/obras-sociales`) del router de la app.
export function ObraSocialesPage() {
  const repository = useObraSocialRepository();
  const { obrasSociales, loading, error, crear, actualizar } = useObrasSociales(repository);
  const [view, setView] = useState<View>({ kind: 'list' });

  if (view.kind === 'detail') {
    const obraSocial: ObraSocial | null =
      view.obraSocialId === null ? null : (obrasSociales.find((os) => os.id === view.obraSocialId) ?? null);

    return (
      <ObraSocialDetail
        obraSocial={obraSocial}
        crear={crear}
        actualizar={actualizar}
        onCreated={(creada) => setView({ kind: 'detail', obraSocialId: creada.id })}
        onBack={() => setView({ kind: 'list' })}
      />
    );
  }

  return (
    <ObrasSocialesList
      obrasSociales={obrasSociales}
      loading={loading}
      error={error}
      onSelect={(obraSocial) => setView({ kind: 'detail', obraSocialId: obraSocial.id })}
      onCreateNew={() => setView({ kind: 'detail', obraSocialId: null })}
    />
  );
}
