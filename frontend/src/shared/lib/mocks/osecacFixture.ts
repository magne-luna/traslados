import type { ObraSocial } from '../../types/obraSocial';

// Único checklist precargado del maestro (tasks.md 2.3, RF-305). El resto de las obras
// sociales nace con checklist vacío — ver knowledge-base/09_decisiones_y_supuestos.md SU-02:
// "el checklist de OSECAC es representativo pero no único", otras obras sociales no relevadas
// aún. "FIM" queda tal cual la sigla del DRF (glosario pendiente, pregunta abierta Alta en
// knowledge-base/10_preguntas_abiertas.md) — no se inventa una expansión.
const OSECAC_CHECKLIST_NOMBRES = [
  'RHC',
  'Prescripción médica',
  'Justificación médica',
  'Consentimiento informado',
  'Declaración de domicilio',
  'Mapa / croquis del recorrido',
  'Presupuesto',
  'CBU',
  'Habilitación del prestador',
  'FIM',
] as const;

export function buildOsecacFixture(): ObraSocial {
  return {
    id: 'osecac',
    nombre: 'OSECAC',
    cuit: '30-54155200-6',
    // codigo/direccion/telefono/condicionIva (integracion-obra-social D9, tasks.md 2.4): las 4
    // columnas ya existen en la base real, pero ni el docx ni la KB dan un valor verificable para
    // OSECAC — quedan ausentes (undefined) en vez de inventados. Se completan cuando haya fuente.
    // Default documentado (knowledge-base/10_preguntas_abiertas.md: "confirmar 90 días de cobro
    // general"), editable por obra social — nunca hardcodeado aguas abajo.
    plazoCobroDias: 90,
    tipoComprobante: 'A',
    modalidadFacturacion: 'por-prestacion',
    admitePagosParciales: false,
    checklist: OSECAC_CHECKLIST_NOMBRES.map((nombre, index) => ({
      id: `osecac-item-${index}`,
      nombre,
      requerido: true,
    })),
    plantillaFactura: {
      // Plantilla representativa (tasks.md 4.4 de facturacion-ui, US-400): cubre los campos que
      // la KB pide para la descripción de la factura, en el orden en que se armaría el texto.
      campos: [
        { id: 'osecac-campo-paciente', etiqueta: 'Paciente', origen: 'paciente.nombre', orden: 0 },
        { id: 'osecac-campo-afiliado', etiqueta: 'N° de afiliado', origen: 'paciente.numeroAfiliado', orden: 1 },
        { id: 'osecac-campo-domicilio', etiqueta: 'Domicilio', origen: 'paciente.domicilio', orden: 2 },
        { id: 'osecac-campo-prestacion', etiqueta: 'Prestación', origen: 'traslado.prestacion', orden: 3 },
        { id: 'osecac-campo-periodo', etiqueta: 'Período', origen: 'traslado.mesYAnio', orden: 4 },
        { id: 'osecac-campo-dias', etiqueta: 'Cantidad de días', origen: 'traslado.cantidadDias', orden: 5 },
        { id: 'osecac-campo-depret', etiqueta: 'Dependencia y retorno', origen: 'traslado.dependenciaYRetorno', orden: 6 },
        { id: 'osecac-campo-valorkm', etiqueta: 'Valor del km', origen: 'traslado.valorKm', orden: 7 },
        { id: 'osecac-campo-cantkm', etiqueta: 'Cantidad de km', origen: 'traslado.cantidadKm', orden: 8 },
        { id: 'osecac-campo-total', etiqueta: 'Total', origen: 'traslado.total', orden: 9 },
      ],
      // Default documentado para IN-01 (pregunta abierta Alta, sin cerrar con el cliente):
      // se usa el número de afiliado, editable por obra social — ver obraSocial.ts.
      identificadorOrigen: 'paciente.numeroAfiliado',
    },
  };
}
