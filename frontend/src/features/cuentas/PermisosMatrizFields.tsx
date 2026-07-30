import { chipColors, InlineIcon } from '../../design-system/components';
import { Field, Select } from '../../design-system/form';
import type { Modulo } from '../../shared/types/usuario';
import { ETIQUETA_MODULO, ETIQUETA_NIVEL, MODULO_COLOR, MODULOS, ORDEN_NIVELES, type NivelDeFila } from './modulos';
import { MODULO_ICON_PATH } from './moduloIcons';

interface PermisosMatrizFieldsProps {
  valores: Record<Modulo, NivelDeFila>;
  onCambiarNivel: (modulo: Modulo, nivel: NivelDeFila) => void;
  disabled?: boolean;
  /** Prefijo de id único por instancia (el caller pasa su propio `useId()`) — evita colisión de
   * ids cuando MatrizPermisos y CuentaForm renderizan cada uno su propia PermisosMatrizFields. */
  idPrefix: string;
}

// Matriz de permisos por módulo (design.md D9, tasks.md 7.3/7.4/7.5): 7 filas × <Select> de nivel
// (antes 4 — ver permisos-modulos-granulares design.md D4/D9, cada módulo pasa a ser 1:1 con una
// pantalla, ya no hace falta el hint "incluye X e Y" de SUBMODULOS_MODULO), cada una con el ícono
// de identidad del módulo (mismo path que app/navIcons.tsx, ver moduloIcons.tsx) en un badge de
// color fijo por módulo (MODULO_COLOR) — así el módulo se reconoce visualmente igual acá y en el
// Chip de CuentasList. Compartida entre MatrizPermisos (edición de una cuenta existente) y
// CuentaForm (permisos iniciales de alta).
export function PermisosMatrizFields({ valores, onCambiarNivel, disabled = false, idPrefix }: PermisosMatrizFieldsProps) {
  return (
    <div className="grid grid-cols-1 gap-md md:grid-cols-2">
      {MODULOS.map((modulo) => {
        const fieldId = `${idPrefix}-${modulo}`;
        const color = chipColors[MODULO_COLOR[modulo]];
        return (
          <div key={modulo} className="flex items-start gap-sm">
            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-pill ${color.bg} ${color.fg}`}>
              <InlineIcon size={20}>{MODULO_ICON_PATH[modulo]}</InlineIcon>
            </span>
            <div className="min-w-0 flex-1">
              <Field label={ETIQUETA_MODULO[modulo]} htmlFor={fieldId}>
                <Select
                  id={fieldId}
                  density="comfortable"
                  value={valores[modulo]}
                  disabled={disabled}
                  onChange={(event) => onCambiarNivel(modulo, event.target.value as NivelDeFila)}
                >
                  <option value="sin_acceso">Sin acceso</option>
                  {ORDEN_NIVELES.map((nivel) => (
                    <option key={nivel} value={nivel}>
                      {ETIQUETA_NIVEL[nivel]}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          </div>
        );
      })}
    </div>
  );
}
