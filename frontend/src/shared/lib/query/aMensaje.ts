// Traduce el `error: Error | null` de React Query al `error: string | null` que ya consumen las
// pantallas (design.md §D6, traducción 1).
//
// Replica el `toErrorMessage` que hoy está copiado en cada hook, fallback incluido, para que
// ningún test de pantalla que afirme sobre el texto del error tenga que cambiar. Al centralizarlo,
// además, deja de haber N copias que puedan divergir.
//
// `null` ante ausencia de error: NO se inventa un mensaje cuando no pasó nada.

const MENSAJE_GENERICO = 'Ocurrió un error inesperado.';

export function aMensaje(err: unknown): string | null {
  if (err === null || err === undefined) return null;
  // Un `Error` con mensaje vacío no le dice nada a la usuaria: cae al genérico igual que un no-Error.
  if (err instanceof Error && err.message !== '') return err.message;
  return MENSAJE_GENERICO;
}
