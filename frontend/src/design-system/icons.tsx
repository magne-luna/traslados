import type { ReactNode } from 'react';

// Paths de <InlineIcon> reutilizados en más de un componente (evita repetir el mismo SVG suelto
// en cada archivo). Regla del proyecto: nunca emojis como ícono — siempre trazo SVG que herede
// color vía currentColor (ver InlineIcon/NavIcon en ./components.tsx).
export const iconDocumento: ReactNode = (
  <>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" strokeLinecap="round" strokeLinejoin="round" />
    <polyline points="14 2 14 8 20 8" />
    <line x1={16} y1={13} x2={8} y2={13} />
    <line x1={16} y1={17} x2={8} y2={17} />
  </>
);

export const iconSello: ReactNode = (
  <>
    <circle cx={12} cy={8} r={6} />
    <path d="M8.5 13.5 7 22l5-3 5 3-1.5-8.5" strokeLinecap="round" strokeLinejoin="round" />
  </>
);

export const iconCalendario: ReactNode = (
  <>
    <rect x={3} y={4} width={18} height={18} rx={2} />
    <line x1={16} y1={2} x2={16} y2={6} />
    <line x1={8} y1={2} x2={8} y2={6} />
    <line x1={3} y1={10} x2={21} y2={10} />
  </>
);

export const iconCasa: ReactNode = (
  <>
    <path d="M3 12 12 3l9 9" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M5 10v10a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V10" strokeLinecap="round" strokeLinejoin="round" />
  </>
);

export const iconEscuela: ReactNode = (
  <>
    <path d="M22 10 12 5 2 10l10 5 10-5Z" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M6 12v5c0 1.1 2.7 2 6 2s6-.9 6-2v-5" strokeLinecap="round" strokeLinejoin="round" />
  </>
);

export const iconUbicacion: ReactNode = (
  <>
    <path d="M12 22s7-7.5 7-12a7 7 0 1 0-14 0c0 4.5 7 12 7 12Z" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx={12} cy={10} r={2.5} />
  </>
);

export const iconReloj: ReactNode = (
  <>
    <circle cx={12} cy={12} r={9} />
    <polyline points="12 7 12 12 16 14" strokeLinecap="round" strokeLinejoin="round" />
  </>
);

export const iconCredencial: ReactNode = (
  <>
    <rect x={2} y={5} width={20} height={14} rx={2} />
    <line x1={2} y1={10} x2={22} y2={10} />
  </>
);

export const iconOjo: ReactNode = (
  <>
    <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx={12} cy={12} r={3} />
  </>
);

export const iconTacho: ReactNode = (
  <>
    <polyline points="3 6 5 6 21 6" />
    <path
      d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </>
);

export const iconArrastrar: ReactNode = (
  <>
    <circle cx={9} cy={6} r={1.4} fill="currentColor" stroke="none" />
    <circle cx={15} cy={6} r={1.4} fill="currentColor" stroke="none" />
    <circle cx={9} cy={12} r={1.4} fill="currentColor" stroke="none" />
    <circle cx={15} cy={12} r={1.4} fill="currentColor" stroke="none" />
    <circle cx={9} cy={18} r={1.4} fill="currentColor" stroke="none" />
    <circle cx={15} cy={18} r={1.4} fill="currentColor" stroke="none" />
  </>
);

export const iconFlechaArriba: ReactNode = <polyline points="18 15 12 9 6 15" strokeLinecap="round" strokeLinejoin="round" />;

export const iconFlechaAbajo: ReactNode = <polyline points="6 9 12 15 18 9" strokeLinecap="round" strokeLinejoin="round" />;

export const iconVelocimetro: ReactNode = (
  <>
    <circle cx={12} cy={12} r={9} />
    <path d="M12 12 16 8" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx={12} cy={12} r={1} fill="currentColor" stroke="none" />
  </>
);

export const iconLlave: ReactNode = (
  <path
    d="M14.7 6.3a1 1 0 0 0 1.4 1.4l3.6-3.6a6 6 0 0 1-7.9 7.9L4.7 19a2.1 2.1 0 0 1-3-3l7-7a6 6 0 0 1 7.9-7.9l-3.6 3.6a1 1 0 0 0 1.7.6z"
    strokeLinecap="round"
    strokeLinejoin="round"
  />
);

export const iconMoneda: ReactNode = (
  <>
    <circle cx={12} cy={12} r={9} />
    <path
      d="M9.5 9.2c0-1 1.1-1.7 2.5-1.7s2.5.7 2.5 1.7-1.1 1.3-2.5 1.3-2.5.3-2.5 1.3 1.1 1.7 2.5 1.7 2.5-.7 2.5-1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <line x1={12} y1={6} x2={12} y2={7.5} />
    <line x1={12} y1={16.5} x2={12} y2={18} />
  </>
);

export const iconTelefono: ReactNode = (
  <path
    d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3.1-8.7A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1.1.4 2.1.7 3.1a2 2 0 0 1-.5 2.1L8 10.1a16 16 0 0 0 6 6l1.2-1.3a2 2 0 0 1 2.1-.5c1 .4 2 .6 3.1.7a2 2 0 0 1 1.7 2z"
    strokeLinecap="round"
    strokeLinejoin="round"
  />
);

export const iconReordenar: ReactNode = (
  <>
    <polyline points="7 9 12 4 17 9" strokeLinecap="round" strokeLinejoin="round" />
    <polyline points="7 15 12 20 17 15" strokeLinecap="round" strokeLinejoin="round" />
  </>
);

export const iconAlerta: ReactNode = (
  <>
    <path d="M12 2 1 21h22L12 2Z" strokeLinecap="round" strokeLinejoin="round" />
    <line x1={12} y1={9} x2={12} y2={14} strokeLinecap="round" />
    <circle cx={12} cy={17.3} r={1} fill="currentColor" stroke="none" />
  </>
);

export const iconLapiz: ReactNode = (
  <>
    <path d="M12 20h9" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" strokeLinecap="round" strokeLinejoin="round" />
  </>
);

export const iconSubirArchivo: ReactNode = (
  <>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" strokeLinecap="round" strokeLinejoin="round" />
    <polyline points="14 2 14 8 20 8" />
    <line x1={12} y1={12} x2={12} y2={18} strokeLinecap="round" />
    <line x1={9} y1={15} x2={15} y2={15} strokeLinecap="round" />
  </>
);
