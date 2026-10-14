import { useId, useRef, useState, type KeyboardEvent } from 'react';
import { Input } from './form';

export interface OpcionCombobox {
  valor: string;
  etiqueta: string;
}

function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/** Cada palabra tipeada tiene que aparecer en la etiqueta, en cualquier orden ("luca aco"). */
function coincide(etiqueta: string, busqueda: string): boolean {
  const destino = normalizar(etiqueta);
  return normalizar(busqueda)
    .split(/\s+/)
    .filter(Boolean)
    .every((palabra) => destino.includes(palabra));
}

// Selector con búsqueda (Andrea, 2026-10-07: "escribir y que te vayan saliendo los que coinciden"),
// para listas largas como el padrón de pacientes. A diferencia de `HoraEstimadaCombo` (texto libre),
// acá el valor es SIEMPRE una opción elegida o '' — lo tipeado es solo el filtro. Si se sale del
// campo con un texto que no es una opción, vuelve a mostrar lo que estaba elegido.
//
// `data-valor` en cada opción: lo usa el helper de tests `elegirEnCombobox` para elegir por id.
export function ComboboxBuscable({
  id,
  opciones,
  valor,
  onChange,
  placeholder,
  invalid,
}: {
  id: string;
  opciones: OpcionCombobox[];
  valor: string;
  onChange: (valor: string) => void;
  placeholder?: string;
  invalid?: boolean;
}) {
  const etiquetaElegida = opciones.find((opcion) => opcion.valor === valor)?.etiqueta ?? '';
  const [texto, setTexto] = useState(etiquetaElegida);
  const [etiquetaPrevia, setEtiquetaPrevia] = useState(etiquetaElegida);
  const [abierto, setAbierto] = useState(false);
  const [resaltado, setResaltado] = useState(-1);
  const listboxId = useId();
  const cerrarAlDesenfocar = useRef(true);

  // El valor cambió desde afuera (reset del form, opciones que llegan tarde): se refleja en el texto.
  if (etiquetaElegida !== etiquetaPrevia) {
    setEtiquetaPrevia(etiquetaElegida);
    setTexto(etiquetaElegida);
  }

  // Recién enfocado con algo elegido, el texto es la etiqueta: se muestran todas, no solo esa.
  const filtradas = texto === etiquetaElegida ? opciones : opciones.filter((opcion) => coincide(opcion.etiqueta, texto));

  function cerrar() {
    setAbierto(false);
    setResaltado(-1);
  }

  function elegir(opcion: OpcionCombobox) {
    setTexto(opcion.etiqueta);
    onChange(opcion.valor);
    cerrar();
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      setTexto(etiquetaElegida);
      cerrar();
      return;
    }
    if (!abierto || filtradas.length === 0) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setResaltado((indice) => Math.min(indice + 1, filtradas.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setResaltado((indice) => Math.max(indice - 1, 0));
    } else if (event.key === 'Enter' && resaltado >= 0) {
      const opcion = filtradas[resaltado];
      if (opcion) {
        event.preventDefault();
        elegir(opcion);
      }
    }
  }

  return (
    <div className="relative">
      <Input
        id={id}
        type="text"
        density="comfortable"
        autoComplete="off"
        placeholder={placeholder}
        invalid={invalid}
        value={texto}
        role="combobox"
        aria-expanded={abierto}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-activedescendant={resaltado >= 0 ? `${listboxId}-${resaltado}` : undefined}
        onChange={(event) => {
          setTexto(event.target.value);
          setAbierto(true);
          setResaltado(-1);
          if (event.target.value.trim() === '' && valor !== '') onChange('');
        }}
        onFocus={() => setAbierto(true)}
        onClick={() => setAbierto(true)}
        onBlur={() => {
          if (!cerrarAlDesenfocar.current) return;
          setTexto(etiquetaElegida);
          cerrar();
        }}
        onKeyDown={onKeyDown}
      />
      {abierto && (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute z-10 mt-xs max-h-64 w-full overflow-y-auto rounded-sm border border-border-strong bg-surface py-xs shadow-card"
        >
          {filtradas.length === 0 ? (
            <li className="px-md py-1.5 font-body text-[13px] text-muted">Sin coincidencias</li>
          ) : (
            filtradas.map((opcion, indice) => (
              <li
                key={opcion.valor}
                id={`${listboxId}-${indice}`}
                role="option"
                data-valor={opcion.valor}
                aria-selected={opcion.valor === valor}
                className={`cursor-pointer px-md py-1.5 font-body text-[13px] text-text ${
                  indice === resaltado ? 'bg-surface-soft' : ''
                } ${opcion.valor === valor ? 'font-semibold' : ''}`}
                onMouseDown={(event) => {
                  event.preventDefault();
                  cerrarAlDesenfocar.current = false;
                }}
                onMouseUp={() => {
                  cerrarAlDesenfocar.current = true;
                }}
                onClick={() => elegir(opcion)}
              >
                {opcion.etiqueta}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
