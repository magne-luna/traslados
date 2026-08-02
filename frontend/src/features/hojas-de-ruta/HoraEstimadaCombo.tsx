import { useId, useRef, useState, type KeyboardEvent } from 'react';
import { Input } from '../../design-system/form';

interface HoraEstimadaComboProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  sugerencias: string[];
  placeholder?: string;
}

// Reemplaza <input list> + <datalist> (feedback de usuario: el popup nativo del datalist no se
// puede acotar en alto ni scrollear vía CSS — es el browser el que lo dibuja). Sigue siendo texto
// libre igual que antes (HORARIOS_SUGERIDOS son sugerencias, no una restricción de valores); lo
// único que cambia es que el listado de sugerencias ahora lo dibujamos nosotros, así puede llevar
// `max-h` + `overflow-y-auto` de verdad.
export function HoraEstimadaCombo({ id, value, onChange, sugerencias, placeholder }: HoraEstimadaComboProps) {
  const [abierto, setAbierto] = useState(false);
  const [resaltado, setResaltado] = useState(-1);
  const listboxId = useId();
  const cerrarAlDesenfocar = useRef(true);

  const filtradas = value ? sugerencias.filter((hora) => hora.startsWith(value)) : sugerencias;
  const mostrarListbox = abierto && filtradas.length > 0;

  function elegir(hora: string) {
    onChange(hora);
    setAbierto(false);
    setResaltado(-1);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      setAbierto(false);
      setResaltado(-1);
      return;
    }
    if (!mostrarListbox) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setResaltado((indice) => Math.min(indice + 1, filtradas.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setResaltado((indice) => Math.max(indice - 1, 0));
    } else if (event.key === 'Enter' && resaltado >= 0) {
      const hora = filtradas[resaltado];
      if (hora) {
        event.preventDefault();
        elegir(hora);
      }
    }
  }

  return (
    <div className="relative">
      <Input
        id={id}
        type="text"
        inputMode="numeric"
        placeholder={placeholder}
        value={value}
        role="combobox"
        aria-expanded={mostrarListbox}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-activedescendant={resaltado >= 0 ? `${listboxId}-${resaltado}` : undefined}
        onChange={(event) => {
          onChange(event.target.value);
          setAbierto(true);
          setResaltado(-1);
        }}
        onFocus={() => setAbierto(true)}
        onBlur={() => {
          if (cerrarAlDesenfocar.current) {
            setAbierto(false);
            setResaltado(-1);
          }
        }}
        onKeyDown={onKeyDown}
      />
      {mostrarListbox && (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute z-10 mt-xs max-h-56 w-full overflow-y-auto rounded-sm border border-border-strong bg-surface py-xs shadow-card"
        >
          {filtradas.map((hora, indice) => (
            <li
              key={hora}
              id={`${listboxId}-${indice}`}
              role="option"
              aria-selected={indice === resaltado}
              className={`cursor-pointer px-md py-1.5 font-body text-[13px] text-text ${
                indice === resaltado ? 'bg-surface-soft' : ''
              }`}
              onMouseDown={(event) => {
                event.preventDefault();
                cerrarAlDesenfocar.current = false;
              }}
              onMouseUp={() => {
                cerrarAlDesenfocar.current = true;
              }}
              onClick={() => elegir(hora)}
            >
              {hora}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
