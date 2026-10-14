/**
 * Corta un monto a 2 decimales sin redondear: Andrea (2026-10-07) "mejor menos que más" — un monto
 * no puede pasarse de lo autorizado por un centavo de redondeo. El epsilon evita que un error de
 * coma flotante (0.29 → 0.28999…) le reste un centavo de más.
 */
export function truncarACentavos(monto: number): number {
  return Math.floor(monto * 100 + 1e-6) / 100;
}
