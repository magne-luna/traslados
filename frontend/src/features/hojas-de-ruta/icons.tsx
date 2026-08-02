import { NavIcon } from '../../design-system/components';

// Set de íconos del rediseño de Hoja de Ruta (cabecera, botones y formulario de recorrido) —
// todos sobre NavIcon (18x18, stroke currentColor), mismo patrón que AppShell.tsx.

export function CalendarIcon() {
  return (
    <NavIcon>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </NavIcon>
  );
}

export function ClockIcon() {
  return (
    <NavIcon>
      <circle cx="12" cy="12" r="9" />
      <polyline points="12 7 12 12 15.5 14" />
    </NavIcon>
  );
}

export function ListIcon() {
  return (
    <NavIcon>
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" />
      <line x1="3" y1="12" x2="3.01" y2="12" />
      <line x1="3" y1="18" x2="3.01" y2="18" />
    </NavIcon>
  );
}

export function GlobeIcon() {
  return (
    <NavIcon>
      <circle cx="12" cy="12" r="9" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <path d="M12 3a13.7 13.7 0 0 1 3.5 9A13.7 13.7 0 0 1 12 21a13.7 13.7 0 0 1-3.5-9A13.7 13.7 0 0 1 12 3z" />
    </NavIcon>
  );
}

export function PrinterIcon() {
  return (
    <NavIcon>
      <polyline points="6 9 6 2 18 2 18 9" />
      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
      <rect x="6" y="14" width="12" height="8" />
    </NavIcon>
  );
}

export function PlusIcon() {
  return (
    <NavIcon>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </NavIcon>
  );
}

export function CarIcon() {
  return (
    <NavIcon>
      <path d="M3 17V12l2.2-5.4A2 2 0 0 1 7 5.5h10a2 2 0 0 1 1.8 1.1L21 12v5" />
      <path d="M3 17h18" />
      <circle cx="7.5" cy="17" r="1.8" />
      <circle cx="16.5" cy="17" r="1.8" />
    </NavIcon>
  );
}

export function UserIcon() {
  return (
    <NavIcon>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </NavIcon>
  );
}

export function PinIcon() {
  return (
    <NavIcon>
      <path d="M12 21s-7-6.5-7-11a7 7 0 0 1 14 0c0 4.5-7 11-7 11z" />
      <circle cx="12" cy="10" r="2.5" />
    </NavIcon>
  );
}

export function ArrowRightIcon() {
  return (
    <NavIcon>
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="13 6 19 12 13 18" />
    </NavIcon>
  );
}

export function ArrowLeftIcon() {
  return (
    <NavIcon>
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="11 6 5 12 11 18" />
    </NavIcon>
  );
}

export function NotesIcon() {
  return (
    <NavIcon>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </NavIcon>
  );
}
