// Umbrales de mantenimiento como constantes configurables documentadas (design.md Decisión 4):
// un único punto de edición y de re-test si el cliente pide ajustarlos, en vez de números
// mágicos dispersos en los componentes.

/** RN-VE-03: cambio de aceite cada 10.000 km desde el último service (lo que ocurra primero). */
export const KM_SERVICE = 10_000;

/** RN-VE-03, US-500: alerta intermedia a los 5.000 km desde el último service. */
export const KM_ALERTA_INTERMEDIA = 5_000;

/**
 * RN-VE-03: cambio de aceite cada ~2-3 meses desde el último service (lo que ocurra primero
 * entre km y tiempo). La KB documenta "2-3 meses"; se toma 3 como default configurable
 * (design.md Open Questions — a confirmar con el cliente).
 */
export const MESES_SERVICE = 3;

/** RN-VE-04: la VTV vence cada 6 meses. */
export const MESES_VTV = 6;

/**
 * RN-VE-04, US-500: ventana de aviso ("por-vencer") antes del vencimiento de una habilitación
 * (VTV o RTO), en días.
 */
export const DIAS_AVISO_HABILITACION = 30;
