// Los tokens del design system (colores, spacing, radios, sombras, tipografía — calcados de
// ../../prototype.html, paleta validada por Andrea/el equipo) viven ahora como variables de
// @theme en src/index.css, consumidas por los componentes vía clases utilitarias de Tailwind
// (Regla Dura del proyecto — ver CLAUDE.md: SIEMPRE Tailwind, NUNCA inline styles). Este
// archivo solo conserva el tipo compartido que no tiene equivalente visual.
export type SemanticStatus = 'success' | 'warning' | 'danger' | 'info' | 'secondary';
