import { Field, Select } from '../../design-system/form';
import { agruparRecorridosHabitualesPorDia } from '../../shared/lib/hojas-de-ruta/recorridosHabitualesDelDia';
import type { Direccion } from '../../shared/types/hojaDeRuta';
import type { RecorridoHabitual } from '../../shared/types/recorridoHabitual';
import { DIA_SEMANA_LABELS } from '../pacientes/diaSemanaOptions';
import { etiquetaDireccion } from './etiquetaDireccion';

interface SelectorRecorridoHabitualProps {
  formId: string;
  /** Destinos habituales del paciente elegido (RF-110), ya cargados por `useRecorridosHabituales`. */
  recorridos: RecorridoHabitual[];
  /** Catálogo del paciente — resuelve los ids del habitual a texto legible. */
  direcciones: Direccion[];
  /** Fecha ISO de la hoja de ruta: decide qué habituales son "los de este día". */
  fecha: string;
  /** Id del habitual aplicado, o `''`. Se limpia solo al cambiar de paciente (lo hace el caller). */
  value: string;
  /** Pedido en curso: el campo se muestra deshabilitado avisando, nunca vacío sin explicación. */
  loading?: boolean;
  /** Falló la carga — se distingue de "el paciente no tiene ninguno", que no es un error. */
  error?: string | null;
  /** `undefined` = el operador volvió a "sin destino habitual" (no se toca nada de lo ya escrito). */
  onSelect: (recorrido: RecorridoHabitual | undefined) => void;
}

const MSG_SIN_HABITUALES = 'Este paciente no tiene destinos habituales cargados en su ficha.';
const MSG_CARGANDO = 'Buscando destinos habituales…';

function etiquetaOpcion(recorrido: RecorridoHabitual, direcciones: Direccion[]): string {
  const inicial = direcciones.find((d) => d.id === recorrido.direccionInicialId);
  const final = direcciones.find((d) => d.id === recorrido.direccionFinalId);
  // Una dirección borrada de la ficha después de cargar el habitual deja el id crudo antes que
  // una opción sin nombre — `camposDesdeRecorridoHabitual` igual no la va a copiar.
  const origen = inicial ? etiquetaDireccion(inicial) : recorrido.direccionInicialId;
  const destino = final ? etiquetaDireccion(final) : recorrido.direccionFinalId;
  return `${recorrido.hora} · ${origen} → ${destino}`;
}

// Atajo "Destino habitual" del armado de la hoja de ruta (feedback de usuario): elegir uno de los
// destinos habituales del paciente (RF-110, cargados en su ficha) COMPLETA hora estimada, origen
// y destino del formulario, en vez de tipearlos de nuevo cada día.
//
// Los del día de la fecha de la hoja van primero y agrupados aparte, pero NO se esconde el resto:
// un traslado excepcional un jueves con el destino habitual de los martes es un caso real del
// negocio (decisión de la usuaria, 2026-08-27). Compartido por NuevoRecorridoForm y
// AsignacionPanel — igual que SelectorPaciente y PacienteTramoCampos, los dos formularios de
// "sumar un pasajero" tienen los mismos campos ("literal quiero que sean el mismo formulario").
//
// EL CAMPO SE MUESTRA SIEMPRE, aunque no haya nada que ofrecer (feedback de la usuaria,
// 2026-08-27): la primera versión no renderizaba nada con la lista vacía, y eso hacía
// indistinguible "este paciente no tiene ninguno" de "la función no anda" — la usuaria abrió la
// pantalla, no vio el campo y preguntó dónde estaba. Sin habituales queda deshabilitado con el
// motivo escrito; los tres motivos (cargando / error / no tiene) son textos distintos, porque un
// fallo de red y una ficha vacía se arreglan de maneras distintas.
// Quien NO monta el campo es el formulario, cuando no le inyectaron repository (la función no
// está cableada en esa pantalla) — no este componente.
export function SelectorRecorridoHabitual({
  formId,
  recorridos,
  direcciones,
  fecha,
  value,
  loading = false,
  error = null,
  onSelect,
}: SelectorRecorridoHabitualProps) {
  const { diaDeLaFecha, delDia, otrosDias } = agruparRecorridosHabitualesPorDia(recorridos, fecha);
  const vacio = recorridos.length === 0;

  const hint = loading
    ? MSG_CARGANDO
    : error !== null
      ? error
      : vacio
        ? MSG_SIN_HABITUALES
        : delDia.length === 0 && diaDeLaFecha !== undefined
          ? `Sin destinos de ${DIA_SEMANA_LABELS[diaDeLaFecha]} — abajo están los de otros días`
          : undefined;

  function handleChange(id: string) {
    onSelect(id === '' ? undefined : recorridos.find((r) => r.id === id));
  }

  return (
    <Field label="Destino habitual" htmlFor={`${formId}-habitual`} hint={hint}>
      <Select
        id={`${formId}-habitual`}
        value={value}
        disabled={loading || vacio}
        onChange={(event) => handleChange(event.target.value)}
      >
        <option value="">— Sin destino habitual —</option>

        {delDia.length > 0 && diaDeLaFecha !== undefined && (
          <optgroup label={`Para este día (${DIA_SEMANA_LABELS[diaDeLaFecha]})`}>
            {delDia.map((recorrido) => (
              <option key={recorrido.id} value={recorrido.id}>
                {etiquetaOpcion(recorrido, direcciones)}
              </option>
            ))}
          </optgroup>
        )}

        {otrosDias.length > 0 && (
          <optgroup label={delDia.length > 0 ? 'Otros días' : 'Otros días de la semana'}>
            {otrosDias.map((recorrido) => (
              <option key={recorrido.id} value={recorrido.id}>
                {`${DIA_SEMANA_LABELS[recorrido.diaSemana]} ${etiquetaOpcion(recorrido, direcciones)}`}
              </option>
            ))}
          </optgroup>
        )}
      </Select>
    </Field>
  );
}
