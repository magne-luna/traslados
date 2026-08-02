import { useState } from 'react';
import { AvisoSoloLectura } from '../../design-system/components';
import type { ObraSocialRepository } from '../../shared/lib/obrasSociales/ObraSocialRepository';
import type { Prestador } from '../../shared/types/prestador';
import { useObrasSociales } from '../obras-sociales/useObrasSociales';
import { PrestadorDetail } from './PrestadorDetail';
import { usePrestadorRepository } from './PrestadorRepositoryContext';
import { PrestadoresList } from './PrestadoresList';
import { usePrestadores } from './usePrestadores';

type View = { kind: 'list' } | { kind: 'detail'; prestadorId: string | null };

interface PrestadoresPageProps {
  /** Vínculo N:N (D2, tasks.md 5.1): reutilizado de la feature de Obras Sociales para poblar el
   * multi-select de `PrestadorForm`, mismo criterio de composición que `PacientesPage.tsx`
   * (`obraSocialRepository` inyectado por prop desde el composition root, no por Context — acá
   * no hace falta un segundo Context: ninguna otra pantalla de esta feature lo necesita). */
  obraSocialRepository: ObraSocialRepository;
}

// Composición raíz de la feature (tasks.md 4.4, espejo de ObraSocialesPage.tsx): resuelve el
// repository del context, wire de usePrestadores, y decide qué pantalla mostrar (listado o
// detalle). Sin test dedicado (plomería de composition-root).
//
// gateo-obrasocial (spec prestador-crud §Gateo por el módulo de permisos obra_social): se monta
// acá <AvisoSoloLectura />, una sola vez, para cubrir tanto la vista de lista como la de detalle.
export function PrestadoresPage({ obraSocialRepository }: PrestadoresPageProps) {
  const repository = usePrestadorRepository();
  const { prestadores, loading, error, crear, actualizar } = usePrestadores(repository);
  const { obrasSociales } = useObrasSociales(obraSocialRepository);
  const [view, setView] = useState<View>({ kind: 'list' });

  if (view.kind === 'detail') {
    const prestador: Prestador | null =
      view.prestadorId === null ? null : (prestadores.find((p) => p.id === view.prestadorId) ?? null);

    return (
      <>
        <AvisoSoloLectura />
        <PrestadorDetail
          prestador={prestador}
          obrasSociales={obrasSociales}
          crear={crear}
          actualizar={actualizar}
          onCreated={(creado) => setView({ kind: 'detail', prestadorId: creado.id })}
          onBack={() => setView({ kind: 'list' })}
        />
      </>
    );
  }

  return (
    <>
      <AvisoSoloLectura />
      <PrestadoresList
        prestadores={prestadores}
        loading={loading}
        error={error}
        onSelect={(prestador) => setView({ kind: 'detail', prestadorId: prestador.id })}
        onCreateNew={() => setView({ kind: 'detail', prestadorId: null })}
      />
    </>
  );
}
