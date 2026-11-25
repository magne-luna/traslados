import { Input, Label } from '../../design-system/form';
import { ETIQUETA_APLICACION } from '../../shared/lib/hojas-de-ruta/transporteRecorrido';
import type { BorradorTercerizado } from '../../shared/lib/hojas-de-ruta/borradorTercerizado';

const radioClasses = 'flex items-center gap-xs font-body text-[13px] text-text';

// Control "Viaje tercerizado" (spec recorrido-tercerizado): checkbox → radios "Uber / aplicación" /
// "Remis" y, para remis, la agencia en texto libre (sin catálogo, decisión 2026-10-14). Quien lo usa
// oculta vehículo y conductor mientras está tildado.
export function TransporteTercerizadoCampos({
  formId,
  value,
  onChange,
  onAgenciaBlur,
}: {
  formId: string;
  value: BorradorTercerizado;
  onChange: (value: BorradorTercerizado) => void;
  /** Edición en RecorridoCard: la agencia se persiste al salir del campo, no en cada tecla. */
  onAgenciaBlur?: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-md">
      <label htmlFor={`${formId}-tercerizado`} className={radioClasses}>
        <input
          id={`${formId}-tercerizado`}
          type="checkbox"
          checked={value.tercerizado}
          onChange={(event) => onChange({ ...value, tercerizado: event.target.checked })}
        />
        Viaje tercerizado
      </label>

      {value.tercerizado && (
        <fieldset className="m-0 flex flex-wrap items-center gap-md border-none p-0">
          <legend className="sr-only">Tipo de viaje tercerizado</legend>
          <label htmlFor={`${formId}-tipo-aplicacion`} className={radioClasses}>
            <input
              id={`${formId}-tipo-aplicacion`}
              type="radio"
              name={`${formId}-tipo-tercerizado`}
              checked={value.tipo === 'aplicacion'}
              onChange={() => onChange({ ...value, tipo: 'aplicacion' })}
            />
            {ETIQUETA_APLICACION}
          </label>
          <label htmlFor={`${formId}-tipo-remis`} className={radioClasses}>
            <input
              id={`${formId}-tipo-remis`}
              type="radio"
              name={`${formId}-tipo-tercerizado`}
              checked={value.tipo === 'remis'}
              onChange={() => onChange({ ...value, tipo: 'remis' })}
            />
            Remis
          </label>
          {value.tipo === 'remis' && (
            <div className="flex items-center gap-xs">
              <Label htmlFor={`${formId}-agencia`}>Agencia</Label>
              <Input
                id={`${formId}-agencia`}
                value={value.agencia}
                onChange={(event) => onChange({ ...value, agencia: event.target.value })}
                onBlur={onAgenciaBlur}
                placeholder="Ej. París"
                maxLength={100}
              />
            </div>
          )}
        </fieldset>
      )}
    </div>
  );
}
