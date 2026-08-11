import { describe, expect, it } from 'vitest';
import type { ComponentProps } from 'react';
import type { ChecklistItem, DocumentoAdjunto } from '../types/documento';
import { DocumentChecklist } from './DocumentChecklist';

// Test de contrato (tasks.md §4.1, design.md D1 / Checkpoint (b) VEREDICTO "opción B"): la
// agrupación por actividad de `documentos-checklist-por-actividad` se resuelve por composición en
// Pacientes (§3 — N `PacienteDocumentosChecklist`, cada una con su propio subconjunto de
// `items`/`documentos` ya filtrado por `agrupacionId` desde el repository), NUNCA dentro de este
// componente compartido — eso sigue siendo cierto. Lo que SÍ cambió (2026-08-07, feedback directo
// de la usuaria tras verificación manual): el prop opcional `mostrarProgreso` — la barra "X de Y
// cargados" propia de cada instancia dejó de mostrarse en Pacientes (queda solo el total agregado
// de `PacienteDocumentos.tsx`), sin tocar el comportamiento por default (`true`) que siguen usando
// Vehículos/Conductores/Facturas. Segundo cambio de contrato (checklist-documental-progreso-visual,
// skill `prototype`, 2026-08-10): el prop opcional `variant` (`'default' | 'ring'`) — puramente
// visual (ver DocumentChecklist.tsx), default `'default'` sin cambio de comportamiento para
// Vehículos/Conductores/Facturas; solo Pacientes pasa `'ring'`. Tercer cambio de contrato
// (documentos-transferencia-actividad, tasks.md 6.1, design.md Checkpoint (c) VEREDICTO opción A):
// el prop opcional `onTransferir` — mismo mecanismo opt-in que `mostrarProgreso`, sin cambio de
// comportamiento para Vehículos/Conductores/Facturas (nunca lo pasan). Este archivo deja constancia
// explícita de que esos son los ÚNICOS cambios de contrato: ningún prop `agrupacion`/`grupos` (la
// rama "opción C" que ese change nunca tomó), ninguno de los 7 props originales cambió de tipo/
// opcionalidad.
//
// Mismo patrón que `DocumentoRepository.agrupacion.types.test.ts` (§2): un componente/objeto puede
// compilar igual con MENOS props de las que declara su interfaz si son opcionales, así que la única
// señal que realmente se rompe si el contrato cambia de más es comparar el tipo completo a nivel de
// tipo, no un render puntual (que es justo lo que ya cubre extensamente `DocumentChecklist.test.tsx`,
// pero solo a nivel de comportamiento, no de forma exacta del tipo de sus props).

type Equal<X, Y> = (<T>() => T extends X ? 1 : 2) extends <T>() => T extends Y ? 1 : 2 ? true : false;
type Expect<T extends true> = T;

// El contrato actual: los 7 props originales (heredados de `pacientes-documentos-multiples` +
// `documentos-previsualizacion`) más `mostrarProgreso?` (2026-08-07) y `variant?` (2026-08-10) y
// `onTransferir?` (documentos-transferencia-actividad, ver comentario de arriba).
type PropsEsperadas = {
  items: ChecklistItem[];
  documentos: DocumentoAdjunto[];
  onUpload: (itemId: string, file: File) => void;
  onRemove: (documentoId: string) => void;
  readOnly?: boolean;
  onResolverPrevisualizacion?: (documentoId: string) => Promise<string | null>;
  onRevocarPrevisualizacion?: (url: string) => void;
  onTransferir?: (documentoId: string) => void;
  mostrarProgreso?: boolean;
  variant?: 'default' | 'ring';
};

type PropsReales = ComponentProps<typeof DocumentChecklist>;

// Si `DocumentChecklist` ganara un prop `agrupacion`/`grupos` (la rama "opción C" que ese change
// explícitamente NO tomó) o alguno de los 9 props actuales perdiera/mutara su tipo/opcionalidad,
// esta línea deja de compilar — es la señal dura de regresión de contrato.
export type _CheckContratoSinCambios = Expect<Equal<PropsReales, PropsEsperadas>>;

describe('DocumentChecklist — contrato de props sin cambios (tasks.md §4.1, design.md D1)', () => {
  it('la comparación de tipos de arriba compiló (si el contrato cambió, `tsc -b --noEmit` falla acá, no este assert)', () => {
    expect(true).toBe(true);
  });
});
