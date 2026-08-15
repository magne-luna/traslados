import type { AsistenciaPrestacion, Factura } from '../../types/factura';
import { calcularFechaEstimadaCobro } from '../facturacion/calcularFechaEstimadaCobro';
import { TIPO_COMPROBANTE_DEFAULT } from '../facturacion/constantes';
import { renderDescripcionFactura, type DatosDescripcionFactura } from '../facturacion/renderDescripcionFactura';
import { resolverIdentificadorFactura } from '../facturacion/resolverIdentificadorFactura';
import { calcularTotalFactura } from '../facturacion/totalesFactura';
import { buildOsecacFixture } from './osecacFixture';
import { buildPacientesFixture } from './pacientesFixture';

// Fixture inicial del mock de Facturas (tasks.md 4.4): ligadas a pacientes/obra social que
// existen en pacientesFixture.ts/osecacFixture.ts ('paciente-martina', 'paciente-facundo',
// obraSocialId 'osecac'). Una factura por cada estado del circuito (EstadoFactura) y al menos
// una del paciente con `amparoJudicial: true` (facundo). Las facturas ya emitidas usan el mismo
// pipeline de funciones puras que va a usar la UI (renderDescripcionFactura,
// resolverIdentificadorFactura, calcularFechaEstimadaCobro) para que el fixture sea consistente
// con las reglas de negocio, no un dato inventado a mano.

function isoDate(fecha: Date): string {
  return fecha.toISOString().slice(0, 10);
}

function primerDiaDelMes(anio: number, mes: number): Date {
  return new Date(Date.UTC(anio, mes - 1, 1));
}

function ultimoDiaDelMes(anio: number, mes: number): Date {
  return new Date(Date.UTC(anio, mes, 0));
}

function mesesAtras(meses: number): { mes: number; anio: number } {
  const fecha = new Date();
  fecha.setMonth(fecha.getMonth() - meses);
  return { mes: fecha.getMonth() + 1, anio: fecha.getFullYear() };
}

// `prestadorNombre`/`prestadorDomicilio` se retiraron por completo (change
// `facturacion-seleccion-autorizacion`, design.md D5): nunca tuvieron columna real en producción,
// eran un remanente de `sacar-prestadores` (que a su vez revertía `factura-por-prestador`) sin
// entidad ni repository detrás. `autorizacionId` (D1/D3) todavía no se puebla acá — el picker que
// lo consume vive en la sección 3 de `facturacion-seleccion-autorizacion`, bloqueada hasta que se
// apliquen las migraciones.

export function buildFacturasFixture(): Factura[] {
  const [martina, facundo] = buildPacientesFixture();
  const osecac = buildOsecacFixture();
  if (!martina || !facundo) {
    throw new Error('facturasFixture requiere que pacientesFixture siga sembrando a Martina y Facundo.');
  }

  // --- Factura 1: a-facturar (paciente-martina) — todavía sin emitir: sin fechaFactura, sin
  // fechaEstimadaCobro, sin identificadorFactura congelado, descripción vacía (la vista previa en
  // vivo la arma el formulario, tasks.md 7.6 — no se persiste hasta emitir). ---
  const periodoActual = { mes: new Date().getMonth() + 1, anio: new Date().getFullYear() };
  const asistenciasMartina: AsistenciaPrestacion[] = [
    {
      id: 'asistencia-martina-1',
      fecha: isoDate(primerDiaDelMes(periodoActual.anio, periodoActual.mes)),
      prestacion: 'Kinesiología',
      dependencia: 'Escuela N°12',
      retorno: 'Domicilio',
      facturaSabados: false,
    },
    {
      id: 'asistencia-martina-2',
      fecha: isoDate(new Date(Date.UTC(periodoActual.anio, periodoActual.mes - 1, 10))),
      prestacion: 'Kinesiología',
      dependencia: 'Escuela N°12',
      retorno: 'Domicilio',
      facturaSabados: false,
    },
  ];

  const facturaMartinaAFacturar: Factura = {
    id: 'factura-martina-a-facturar',
    pacienteId: martina.id,
    descripcion: '',
    dias: 18,
    valorKm: 300,
    monto: calcularTotalFactura({ valorKm: 300, cantidadKm: 40, dias: 18 }),
    estado: 'a-facturar',
    fechaInicial: isoDate(primerDiaDelMes(periodoActual.anio, periodoActual.mes)),
    fechaTope: isoDate(ultimoDiaDelMes(periodoActual.anio, periodoActual.mes)),
    tipoComprobante: TIPO_COMPROBANTE_DEFAULT,
    cantidadKm: 40,
    prestacion: 'Kinesiología',
    mesFacturado: periodoActual.mes,
    anioFacturado: periodoActual.anio,
    dependenciaYRetorno: 'Escuela N°12 / domicilio',
    domicilioId: 'dir-martina-domicilio-ida',
    asistencias: asistenciasMartina,
  };

  // --- Factura 2: facturado (paciente-facundo, amparoJudicial: true) — ya emitida: congela
  // descripción e identificador, calcula fecha estimada de cobro con el plazo de amparo (gana
  // sobre el plazo propio de la obra social, design.md Decisión 7). ---
  const periodoFacturado = mesesAtras(1);
  const identificadorFacundo = resolverIdentificadorFactura(facundo, osecac.plantillaFactura.identificadorOrigen);
  const fechaFacturaFacundo = isoDate(new Date(Date.UTC(periodoFacturado.anio, periodoFacturado.mes - 1, 3)));
  const datosDescripcionFacundo: DatosDescripcionFactura = {
    pacienteNombre: `${facundo.apellido}, ${facundo.nombre}`,
    pacienteDni: facundo.dni,
    pacienteNumeroAfiliado: facundo.numeroAfiliado.valor,
    domicilio: 'Calle 50 N°850, La Plata',
    prestacion: 'Transporte escolar',
    mesFacturado: periodoFacturado.mes,
    anioFacturado: periodoFacturado.anio,
    cantidadDias: 22,
    dependenciaYRetorno: 'Escuela / domicilio',
    valorKm: 320,
    cantidadKm: 55,
    total: calcularTotalFactura({ valorKm: 320, cantidadKm: 55, dias: 22 }),
    valoresManuales: {},
    prestaciones: [],
  };

  const facturaFacundoFacturado: Factura = {
    id: 'factura-facundo-facturado',
    pacienteId: facundo.id,
    descripcion: renderDescripcionFactura(osecac.plantillaFactura, datosDescripcionFacundo),
    dias: datosDescripcionFacundo.cantidadDias,
    valorKm: datosDescripcionFacundo.valorKm,
    monto: datosDescripcionFacundo.total,
    estado: 'facturado',
    fechaInicial: isoDate(primerDiaDelMes(periodoFacturado.anio, periodoFacturado.mes)),
    fechaTope: isoDate(ultimoDiaDelMes(periodoFacturado.anio, periodoFacturado.mes)),
    tipoComprobante: TIPO_COMPROBANTE_DEFAULT,
    cantidadKm: datosDescripcionFacundo.cantidadKm,
    fechaFactura: fechaFacturaFacundo,
    fechaEstimadaCobro: calcularFechaEstimadaCobro({
      fechaFactura: fechaFacturaFacundo,
      amparoJudicial: facundo.amparoJudicial,
      plazoObraSocial: undefined,
    }),
    prestacion: datosDescripcionFacundo.prestacion,
    mesFacturado: periodoFacturado.mes,
    anioFacturado: periodoFacturado.anio,
    dependenciaYRetorno: datosDescripcionFacundo.dependenciaYRetorno,
    domicilioId: 'dir-facundo-domicilio-ida',
    identificadorFactura: identificadorFacundo,
    asistencias: [
      {
        id: 'asistencia-facundo-1',
        fecha: fechaFacturaFacundo,
        prestacion: 'Transporte escolar',
        dependencia: 'Escuela',
        retorno: 'Domicilio',
        facturaSabados: false,
      },
    ],
  };

  // --- Factura 3: cobrado (paciente-martina) — saldada por completo (ver cobrosFixture.ts,
  // que le agrega cobros cuya suma cubre el monto total). ---
  const periodoCobrado = mesesAtras(3);
  const fechaFacturaMartinaCobrado = isoDate(new Date(Date.UTC(periodoCobrado.anio, periodoCobrado.mes - 1, 5)));
  const datosDescripcionMartinaCobrado: DatosDescripcionFactura = {
    pacienteNombre: `${martina.apellido}, ${martina.nombre}`,
    pacienteDni: martina.dni,
    pacienteNumeroAfiliado: martina.numeroAfiliado.valor,
    domicilio: 'Av. Rivadavia 4500, CABA',
    prestacion: 'Kinesiología',
    mesFacturado: periodoCobrado.mes,
    anioFacturado: periodoCobrado.anio,
    cantidadDias: 20,
    dependenciaYRetorno: 'Escuela N°12 / domicilio',
    valorKm: 300,
    cantidadKm: 45,
    total: calcularTotalFactura({ valorKm: 300, cantidadKm: 45, dias: 20 }),
    valoresManuales: {},
    prestaciones: [],
  };

  const facturaMartinaCobrado: Factura = {
    id: 'factura-martina-cobrado',
    pacienteId: martina.id,
    descripcion: renderDescripcionFactura(osecac.plantillaFactura, datosDescripcionMartinaCobrado),
    dias: datosDescripcionMartinaCobrado.cantidadDias,
    valorKm: datosDescripcionMartinaCobrado.valorKm,
    monto: datosDescripcionMartinaCobrado.total,
    estado: 'cobrado',
    fechaInicial: isoDate(primerDiaDelMes(periodoCobrado.anio, periodoCobrado.mes)),
    fechaTope: isoDate(ultimoDiaDelMes(periodoCobrado.anio, periodoCobrado.mes)),
    tipoComprobante: TIPO_COMPROBANTE_DEFAULT,
    cantidadKm: datosDescripcionMartinaCobrado.cantidadKm,
    fechaFactura: fechaFacturaMartinaCobrado,
    fechaEstimadaCobro: calcularFechaEstimadaCobro({
      fechaFactura: fechaFacturaMartinaCobrado,
      amparoJudicial: martina.amparoJudicial,
      plazoObraSocial: undefined,
    }),
    prestacion: datosDescripcionMartinaCobrado.prestacion,
    mesFacturado: periodoCobrado.mes,
    anioFacturado: periodoCobrado.anio,
    dependenciaYRetorno: datosDescripcionMartinaCobrado.dependenciaYRetorno,
    domicilioId: 'dir-martina-domicilio-ida',
    identificadorFactura: resolverIdentificadorFactura(martina, osecac.plantillaFactura.identificadorOrigen),
    asistencias: [
      {
        id: 'asistencia-martina-cobrado-1',
        fecha: fechaFacturaMartinaCobrado,
        prestacion: 'Kinesiología',
        dependencia: 'Escuela N°12',
        retorno: 'Domicilio',
        facturaSabados: false,
      },
    ],
  };

  // --- Factura 4: pagado-parcialmente (paciente-facundo) — cobros parciales, saldo pendiente
  // (ver cobrosFixture.ts). ---
  const periodoParcial = mesesAtras(2);
  const fechaFacturaFacundoParcial = isoDate(new Date(Date.UTC(periodoParcial.anio, periodoParcial.mes - 1, 7)));
  const datosDescripcionFacundoParcial: DatosDescripcionFactura = {
    pacienteNombre: `${facundo.apellido}, ${facundo.nombre}`,
    pacienteDni: facundo.dni,
    pacienteNumeroAfiliado: facundo.numeroAfiliado.valor,
    domicilio: 'Calle 50 N°850, La Plata',
    prestacion: 'Transporte escolar',
    mesFacturado: periodoParcial.mes,
    anioFacturado: periodoParcial.anio,
    cantidadDias: 19,
    dependenciaYRetorno: 'Escuela / domicilio',
    valorKm: 320,
    cantidadKm: 48,
    total: calcularTotalFactura({ valorKm: 320, cantidadKm: 48, dias: 19 }),
    valoresManuales: {},
    prestaciones: [],
  };

  const facturaFacundoParcial: Factura = {
    id: 'factura-facundo-pagado-parcialmente',
    pacienteId: facundo.id,
    descripcion: renderDescripcionFactura(osecac.plantillaFactura, datosDescripcionFacundoParcial),
    dias: datosDescripcionFacundoParcial.cantidadDias,
    valorKm: datosDescripcionFacundoParcial.valorKm,
    monto: datosDescripcionFacundoParcial.total,
    estado: 'pagado-parcialmente',
    fechaInicial: isoDate(primerDiaDelMes(periodoParcial.anio, periodoParcial.mes)),
    fechaTope: isoDate(ultimoDiaDelMes(periodoParcial.anio, periodoParcial.mes)),
    tipoComprobante: TIPO_COMPROBANTE_DEFAULT,
    cantidadKm: datosDescripcionFacundoParcial.cantidadKm,
    fechaFactura: fechaFacturaFacundoParcial,
    fechaEstimadaCobro: calcularFechaEstimadaCobro({
      fechaFactura: fechaFacturaFacundoParcial,
      amparoJudicial: facundo.amparoJudicial,
      plazoObraSocial: undefined,
    }),
    prestacion: datosDescripcionFacundoParcial.prestacion,
    mesFacturado: periodoParcial.mes,
    anioFacturado: periodoParcial.anio,
    dependenciaYRetorno: datosDescripcionFacundoParcial.dependenciaYRetorno,
    domicilioId: 'dir-facundo-domicilio-ida',
    identificadorFactura: identificadorFacundo,
    asistencias: [
      {
        id: 'asistencia-facundo-parcial-1',
        fecha: fechaFacturaFacundoParcial,
        prestacion: 'Transporte escolar',
        dependencia: 'Escuela',
        retorno: 'Domicilio',
        facturaSabados: true,
      },
    ],
  };

  return [facturaMartinaAFacturar, facturaFacundoFacturado, facturaMartinaCobrado, facturaFacundoParcial];
}
