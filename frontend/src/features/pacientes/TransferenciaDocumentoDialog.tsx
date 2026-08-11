import { useEffect, useState } from 'react';
import { Button, Overlay } from '../../design-system/components';
import { Alert } from '../../design-system/feedback';
import { Label, Select } from '../../design-system/form';

export interface DestinoTransferencia {
  clave: string;
  label: string;
}

interface TransferenciaDocumentoDialogProps {
  open: boolean;
  documentoNombre: string;
  itemNombre: string;
  origenLabel: string;
  destinos: DestinoTransferencia[];
  onCancelar: () => void;
  onConfirmar: (destinoClave: string) => void;
  enviando: boolean;
  error: string | null;
}

// documentos-transferencia-actividad (tasks.md 6.4/6.5, design.md Checkpoint (c)/(d)):
// confirmación explícita + selector de destino, reusando el design system (`Overlay` — mismo
// mecanismo que la previsualización y el diálogo de quitar dirección — + `Select` de
// `design-system/form.tsx` + `Button`). Nunca inventa componentes nuevos, nunca `style={{}}`.
export function TransferenciaDocumentoDialog({
  open,
  documentoNombre,
  itemNombre,
  origenLabel,
  destinos,
  onCancelar,
  onConfirmar,
  enviando,
  error,
}: TransferenciaDocumentoDialogProps) {
  const [destinoClave, setDestinoClave] = useState(destinos[0]?.clave ?? '');

  // Reinicia la selección cada vez que el diálogo se abre (o cambia el set de destinos, ej. otra
  // actividad de origen) — nunca arrastra la elección de una transferencia anterior.
  useEffect(() => {
    if (open) setDestinoClave(destinos[0]?.clave ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `destinos` es un array nuevo en cada
    // render del padre; solo interesa reaccionar a que el diálogo se abrió, no a su identidad.
  }, [open]);

  const destinoLabel = destinos.find((d) => d.clave === destinoClave)?.label ?? '';

  return (
    <Overlay open={open} onClose={onCancelar} title="Transferir documento">
      <div className="flex flex-col gap-md">
        {/* Identifica documento, origen y destino de forma legible — sin ambigüedad entre dos
            actividades del mismo tipo (`origenLabel`/`destinoLabel` ya vienen de
            `etiquetaActividad`, que incluye la descripción). */}
        <p className="m-0 font-body text-[13px] text-text">
          Vas a transferir <strong>{documentoNombre}</strong> ({itemNombre}) de{' '}
          <strong>{origenLabel}</strong> a <strong>{destinoLabel || 'un destino'}</strong>.
        </p>

        {error && <Alert tone="danger">{error}</Alert>}

        <div className="flex flex-col gap-xs">
          <Label htmlFor="transferencia-destino">Nueva actividad</Label>
          <Select id="transferencia-destino" value={destinoClave} onChange={(e) => setDestinoClave(e.target.value)}>
            {destinos.map((destino) => (
              <option key={destino.clave} value={destino.clave}>
                {destino.label}
              </option>
            ))}
          </Select>
        </div>

        <div className="flex justify-end gap-sm">
          <Button variant="secondary" onClick={onCancelar} disabled={enviando}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            onClick={() => onConfirmar(destinoClave)}
            disabled={enviando || destinoClave === ''}
          >
            {enviando ? 'Transfiriendo…' : 'Transferir'}
          </Button>
        </div>
      </div>
    </Overlay>
  );
}
