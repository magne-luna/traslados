// deno test supabase/functions/_shared/emisionSnapshots.test.ts
//
// Paridad con las funciones puras del frontend (design.md D8, tasks.md 2.7): esta copia Deno debe
// producir el MISMO resultado que
//   frontend/src/shared/lib/facturacion/{calcularFechaEstimadaCobro,resolverIdentificadorFactura,
//   construirDatosDescripcion,renderDescripcionFactura}.ts
// Si el original cambia, actualizar emisionSnapshots.ts y este test.

import { assertEquals } from 'jsr:@std/assert@1';
import {
  calcularFechaEstimadaCobro,
  construirDatosDescripcion,
  renderDescripcionFactura,
  resolverIdentificadorFactura,
  type PlantillaCampo,
} from './emisionSnapshots.ts';

// --- calcularFechaEstimadaCobro: amparo (45) > plazo OS > default (90) ---

Deno.test('fechaEstimadaCobro: default general 90 días', () => {
  assertEquals(
    calcularFechaEstimadaCobro({ fechaFactura: '2026-03-01', amparoJudicial: false, plazoObraSocial: undefined }),
    '2026-05-30',
  );
});

Deno.test('fechaEstimadaCobro: plazo propio de la obra social gana al default', () => {
  assertEquals(
    calcularFechaEstimadaCobro({ fechaFactura: '2026-03-01', amparoJudicial: false, plazoObraSocial: 30 }),
    '2026-03-31',
  );
});

Deno.test('fechaEstimadaCobro: amparo judicial (45) gana al plazo de la OS', () => {
  assertEquals(
    calcularFechaEstimadaCobro({ fechaFactura: '2026-03-01', amparoJudicial: true, plazoObraSocial: 120 }),
    '2026-04-15',
  );
});

// --- resolverIdentificadorFactura ---

Deno.test('identificador: origen DNI', () => {
  assertEquals(
    resolverIdentificadorFactura({ dni: '30123456', numeroAfiliadoValor: 'AF-9' }, 'paciente.dni'),
    { origen: 'paciente.dni', valor: '30123456' },
  );
});

Deno.test('identificador: origen número de afiliado', () => {
  assertEquals(
    resolverIdentificadorFactura({ dni: '30123456', numeroAfiliadoValor: 'AF-9' }, 'paciente.numeroAfiliado'),
    { origen: 'paciente.numeroAfiliado', valor: 'AF-9' },
  );
});

// --- construirDatosDescripcion + renderDescripcionFactura ---

const PACIENTE = {
  nombre: 'Ana',
  apellido: 'Pérez',
  dni: '30123456',
  numeroAfiliadoValor: 'AF-9',
  direcciones: [{ id: 'dir-1', calle: 'San Martín 100', localidad: 'La Plata' }],
};

const CAMPOS = {
  prestacion: 'Traslado ida y vuelta',
  mesFacturado: 3,
  anioFacturado: 2026,
  dias: 20,
  dependenciaYRetorno: 'Con dependencia',
  valorKm: 150,
  cantidadKm: 320,
  monto: 45000,
  domicilioId: 'dir-1',
};

Deno.test('construirDatosDescripcion: nombre "Apellido, Nombre" y domicilio "calle, localidad"', () => {
  const d = construirDatosDescripcion(CAMPOS, PACIENTE);
  assertEquals(d.pacienteNombre, 'Pérez, Ana');
  assertEquals(d.domicilio, 'San Martín 100, La Plata');
  assertEquals(d.total, 45000);
  assertEquals(d.prestaciones, []);
});

Deno.test('construirDatosDescripcion: domicilio vacío si el id no está en las direcciones', () => {
  const d = construirDatosDescripcion({ ...CAMPOS, domicilioId: 'inexistente' }, PACIENTE);
  assertEquals(d.domicilio, '');
});

Deno.test('renderDescripcionFactura: recorre la plantilla ordenada por `orden`, "Etiqueta: valor" por línea', () => {
  const campos: PlantillaCampo[] = [
    { id: 'c2', etiqueta: 'Período', origen: 'traslado.mesYAnio', orden: 2 },
    { id: 'c1', etiqueta: 'Paciente', origen: 'paciente.nombre', orden: 1 },
    { id: 'c3', etiqueta: 'Total', origen: 'traslado.total', orden: 3 },
  ];
  const texto = renderDescripcionFactura(campos, construirDatosDescripcion(CAMPOS, PACIENTE));
  assertEquals(texto, 'Paciente: Pérez, Ana\nPeríodo: 03/2026\nTotal: 45000');
});

Deno.test('renderDescripcionFactura: bloque "Prestaciones:" al final cuando hay prestaciones', () => {
  const campos: PlantillaCampo[] = [{ id: 'c1', etiqueta: 'Paciente', origen: 'paciente.nombre', orden: 1 }];
  const datos = construirDatosDescripcion({ ...CAMPOS, prestaciones: ['Kinesiología', 'Fonoaudiología'] }, PACIENTE);
  assertEquals(renderDescripcionFactura(campos, datos), 'Paciente: Pérez, Ana\nPrestaciones: Kinesiología, Fonoaudiología');
});

Deno.test('renderDescripcionFactura: sin campos y sin prestaciones -> string vacío', () => {
  assertEquals(renderDescripcionFactura([], construirDatosDescripcion(CAMPOS, PACIENTE)), '');
});
