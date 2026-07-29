import { useId, useState } from 'react';
import { Button } from '../../design-system/components';
import { Alert } from '../../design-system/feedback';
import { Card } from '../../design-system/layout';
import type { MapaPermisos, Modulo, Permiso } from '../../shared/types/usuario';
import { filasAPermisos, filasSonIguales, mapaAFilas, type NivelDeFila } from './modulos';
import { PermisosMatrizFields } from './PermisosMatrizFields';

interface MatrizPermisosProps {
  permisos: MapaPermisos;
  /** Invoca `update-permisos` (vía CuentaRepository) con el conjunto COMPLETO deseado — nunca un
   * diff. La matriz no conoce Edge Functions: el caller (CuentaDetail) es quien invoca el
   * repository y recarga el listado. */
  onGuardar: (permisos: Permiso[]) => Promise<void>;
  /** Default false. Deshabilita selects y botones mientras la operación está en curso
   * (tasks.md 7.7/spec "Estados de carga, error y vacío" — envío en curso). */
  guardando?: boolean;
  error?: string | null;
}

// Matriz de permisos por cuenta (design.md D9, tasks.md 7.3/7.4/7.5): 4 filas × <Select> de nivel
// con ícono de identidad por módulo (PermisosMatrizFields) — no una grilla de radio buttons (D9:
// operable por teclado sin trampas de foco). Edición diferida en línea, NUNCA modal: cambiar un
// <Select> solo actualiza el borrador local; recién al tocar "Guardar cambios" se invoca
// `onGuardar` con el conjunto COMPLETO deseado (reemplazo total, nunca un diff) — "Cancelar"
// descarta el borrador y vuelve al último `permisos` recibido por props sin invocar nada.
export function MatrizPermisos({ permisos, onGuardar, guardando = false, error = null }: MatrizPermisosProps) {
  const estadoGuardado = mapaAFilas(permisos);
  const [borrador, setBorrador] = useState<Record<Modulo, NivelDeFila>>(estadoGuardado);
  const formId = useId();

  const hayCambios = !filasSonIguales(borrador, estadoGuardado);

  function handleCambiarNivel(modulo: Modulo, nivel: NivelDeFila) {
    setBorrador((prev) => ({ ...prev, [modulo]: nivel }));
  }

  function handleCancelar() {
    setBorrador(estadoGuardado);
  }

  async function handleGuardar() {
    await onGuardar(filasAPermisos(borrador));
  }

  return (
    <Card gap="lg">
      {error && <Alert tone="danger">{error}</Alert>}

      <PermisosMatrizFields valores={borrador} onCambiarNivel={handleCambiarNivel} disabled={guardando} idPrefix={formId} />

      <div className="flex items-center justify-end gap-sm border-t border-border pt-md">
        <Button variant="secondary" onClick={handleCancelar} disabled={!hayCambios || guardando}>
          Cancelar
        </Button>
        <Button variant="primary" onClick={() => void handleGuardar()} disabled={!hayCambios || guardando}>
          {guardando ? 'Guardando…' : 'Guardar cambios'}
        </Button>
      </div>
    </Card>
  );
}
