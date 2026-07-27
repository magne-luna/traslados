import { useState } from 'react';
import type { DocumentoRepository } from '../../shared/lib/documentos/DocumentoRepository';
import type { Conductor } from '../../shared/types/conductor';
import { useConductorRepository } from './ConductorRepositoryContext';
import { ConductorDetail } from './ConductorDetail';
import { ConductoresList } from './ConductoresList';
import { useConductores } from './useConductores';

type View = { kind: 'list' } | { kind: 'detail'; conductorId: string | null };

interface ConductoresPageProps {
  documentoRepository: DocumentoRepository;
}

// Composición raíz de la feature (tasks.md 4.2, 5.5): resuelve el ConductorRepository del
// context, wire de useConductores, y decide qué pantalla mostrar (listado o detalle). No hay
// router anidado — mismo patrón que VehiculosPage.
export function ConductoresPage({ documentoRepository }: ConductoresPageProps) {
  const repository = useConductorRepository();
  const { conductores, loading, error, crear, actualizar } = useConductores(repository);
  const [view, setView] = useState<View>({ kind: 'list' });

  if (view.kind === 'detail') {
    const conductor: Conductor | null =
      view.conductorId === null ? null : (conductores.find((c) => c.id === view.conductorId) ?? null);

    return (
      <ConductorDetail
        conductor={conductor}
        crear={crear}
        actualizar={actualizar}
        documentoRepository={documentoRepository}
        onCreated={(creado) => setView({ kind: 'detail', conductorId: creado.id })}
        onBack={() => setView({ kind: 'list' })}
      />
    );
  }

  return (
    <ConductoresList
      conductores={conductores}
      loading={loading}
      error={error}
      onSelect={(conductor) => setView({ kind: 'detail', conductorId: conductor.id })}
      onCreateNew={() => setView({ kind: 'detail', conductorId: null })}
    />
  );
}
