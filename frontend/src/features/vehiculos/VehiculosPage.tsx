import { useState } from 'react';
import type { DocumentoRepository } from '../../shared/lib/documentos/DocumentoRepository';
import type { Vehiculo } from '../../shared/types/vehiculo';
import { useVehiculoRepository } from './VehiculoRepositoryContext';
import { VehiculoDetail } from './VehiculoDetail';
import { VehiculosList } from './VehiculosList';
import { useVehiculos } from './useVehiculos';

type View = { kind: 'list' } | { kind: 'detail'; vehiculoId: string | null };

interface VehiculosPageProps {
  documentoRepository: DocumentoRepository;
}

// Composición raíz de la feature (tasks.md 4.2, 5.7): resuelve el VehiculoRepository del
// context, wire de useVehiculos, y decide qué pantalla mostrar (listado o detalle). No hay
// router anidado — mismo patrón que ObraSocialesPage (FE-2).
export function VehiculosPage({ documentoRepository }: VehiculosPageProps) {
  const repository = useVehiculoRepository();
  const { vehiculos, loading, error, crear, actualizar } = useVehiculos(repository);
  const [view, setView] = useState<View>({ kind: 'list' });

  if (view.kind === 'detail') {
    const vehiculo: Vehiculo | null =
      view.vehiculoId === null ? null : (vehiculos.find((v) => v.id === view.vehiculoId) ?? null);

    return (
      <VehiculoDetail
        vehiculo={vehiculo}
        crear={crear}
        actualizar={actualizar}
        documentoRepository={documentoRepository}
        onCreated={(creado) => setView({ kind: 'detail', vehiculoId: creado.id })}
        onBack={() => setView({ kind: 'list' })}
      />
    );
  }

  return (
    <VehiculosList
      vehiculos={vehiculos}
      loading={loading}
      error={error}
      onSelect={(vehiculo) => setView({ kind: 'detail', vehiculoId: vehiculo.id })}
      onCreateNew={() => setView({ kind: 'detail', vehiculoId: null })}
    />
  );
}
