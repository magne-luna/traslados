import { describe, expect, it } from 'vitest';
import type { PlantillaFactura } from '../../types/obraSocial';
import { renderDescripcionFactura, type DatosDescripcionFactura } from './renderDescripcionFactura';

const datosBase: DatosDescripcionFactura = {
  pacienteNombre: 'Gómez, Martina',
  pacienteDni: '45123456',
  pacienteNumeroAfiliado: 'OS-AB12345',
  domicilio: 'Av. Rivadavia 4500, CABA',
  prestacion: 'Kinesiología',
  mesFacturado: 7,
  anioFacturado: 2026,
  cantidadDias: 20,
  dependenciaYRetorno: 'Escuela N°12 / domicilio',
  valorKm: 350,
  cantidadKm: 12,
  total: 84_000,
  valoresManuales: {},
  prestaciones: [],
};

describe('renderDescripcionFactura', () => {
  it('respeta el orden de los campos de la plantilla, no el orden en que están declarados', () => {
    const plantilla: PlantillaFactura = {
      identificadorOrigen: 'paciente.dni',
      campos: [
        { id: 'c-prestacion', etiqueta: 'Prestación', origen: 'traslado.prestacion', orden: 1 },
        { id: 'c-dni', etiqueta: 'DNI', origen: 'paciente.dni', orden: 0 },
      ],
    };

    const resultado = renderDescripcionFactura(plantilla, datosBase);
    const posicionDni = resultado.indexOf('DNI');
    const posicionPrestacion = resultado.indexOf('Prestación');

    expect(posicionDni).toBeGreaterThanOrEqual(0);
    expect(posicionPrestacion).toBeGreaterThan(posicionDni);
  });

  it('resuelve dos plantillas distintas de forma independiente (sin estado compartido)', () => {
    const plantillaCorta: PlantillaFactura = {
      identificadorOrigen: 'paciente.dni',
      campos: [{ id: 'c-1', etiqueta: 'Paciente', origen: 'paciente.nombre', orden: 0 }],
    };
    const plantillaLarga: PlantillaFactura = {
      identificadorOrigen: 'paciente.numeroAfiliado',
      campos: [
        { id: 'c-1', etiqueta: 'Paciente', origen: 'paciente.nombre', orden: 0 },
        { id: 'c-2', etiqueta: 'Afiliado', origen: 'paciente.numeroAfiliado', orden: 1 },
      ],
    };

    const corta = renderDescripcionFactura(plantillaCorta, datosBase);
    const larga = renderDescripcionFactura(plantillaLarga, datosBase);

    expect(corta).not.toContain('Afiliado');
    expect(larga).toContain('Afiliado: OS-AB12345');
  });

  it('cubre todos los campos que pide US-400, incluido el mes/año formateado', () => {
    const plantilla: PlantillaFactura = {
      identificadorOrigen: 'paciente.dni',
      campos: [
        { id: 'c-nombre', etiqueta: 'Paciente', origen: 'paciente.nombre', orden: 0 },
        { id: 'c-dni', etiqueta: 'DNI', origen: 'paciente.dni', orden: 1 },
        { id: 'c-afiliado', etiqueta: 'N° Afiliado', origen: 'paciente.numeroAfiliado', orden: 2 },
        { id: 'c-domicilio', etiqueta: 'Domicilio', origen: 'paciente.domicilio', orden: 3 },
        { id: 'c-prestacion', etiqueta: 'Prestación', origen: 'traslado.prestacion', orden: 4 },
        { id: 'c-mes', etiqueta: 'Período', origen: 'traslado.mesYAnio', orden: 5 },
        { id: 'c-dias', etiqueta: 'Días', origen: 'traslado.cantidadDias', orden: 6 },
        { id: 'c-depret', etiqueta: 'Dependencia y retorno', origen: 'traslado.dependenciaYRetorno', orden: 7 },
        { id: 'c-valorkm', etiqueta: 'Valor km', origen: 'traslado.valorKm', orden: 8 },
        { id: 'c-cantkm', etiqueta: 'Cantidad km', origen: 'traslado.cantidadKm', orden: 9 },
        { id: 'c-total', etiqueta: 'Total', origen: 'traslado.total', orden: 10 },
      ],
    };

    const resultado = renderDescripcionFactura(plantilla, datosBase);

    expect(resultado).toContain('Paciente: Gómez, Martina');
    expect(resultado).toContain('DNI: 45123456');
    expect(resultado).toContain('N° Afiliado: OS-AB12345');
    expect(resultado).toContain('Domicilio: Av. Rivadavia 4500, CABA');
    expect(resultado).toContain('Prestación: Kinesiología');
    expect(resultado).toContain('Período: 07/2026');
    expect(resultado).toContain('Días: 20');
    expect(resultado).toContain('Dependencia y retorno: Escuela N°12 / domicilio');
    expect(resultado).toContain('Valor km: 350');
    expect(resultado).toContain('Cantidad km: 12');
    expect(resultado).toContain('Total: 84000');
  });

  it('resuelve un campo de origen valor-manual con el texto cargado a mano', () => {
    const plantilla: PlantillaFactura = {
      identificadorOrigen: 'paciente.dni',
      campos: [{ id: 'c-manual', etiqueta: 'Observación', origen: 'valor-manual', orden: 0 }],
    };

    const resultado = renderDescripcionFactura(plantilla, {
      ...datosBase,
      valoresManuales: { 'c-manual': 'Traslado especial por lluvia' },
    });

    expect(resultado).toBe('Observación: Traslado especial por lluvia');
  });

  it('es pura: la misma entrada siempre produce la misma salida', () => {
    const plantilla: PlantillaFactura = {
      identificadorOrigen: 'paciente.dni',
      campos: [{ id: 'c-1', etiqueta: 'Prestación', origen: 'traslado.prestacion', orden: 0 }],
    };

    expect(renderDescripcionFactura(plantilla, datosBase)).toBe(renderDescripcionFactura(plantilla, datosBase));
  });

  // WU2 de `facturacion-cambios-ui` (decisión usuaria 2026-08-16): modalidad `general` → la
  // descripción agrega un bloque "Prestaciones:" al final, alimentado por las líneas del
  // presupuesto de la autorización elegida (opción a — `prestacionesDePresupuesto`, resueltas
  // client-side contra el catálogo del paciente). Siempre DESPUÉS de la plantilla.
  it('con prestaciones (modalidad general): agrega el bloque "Prestaciones:" al final de la descripción', () => {
    const plantilla: PlantillaFactura = {
      identificadorOrigen: 'paciente.dni',
      campos: [{ id: 'c-1', etiqueta: 'Período', origen: 'traslado.mesYAnio', orden: 0 }],
    };

    const resultado = renderDescripcionFactura(plantilla, { ...datosBase, prestaciones: ['Kinesiología', 'Fonoaudiología'] });

    expect(resultado).toContain('Prestaciones: Kinesiología, Fonoaudiología');
    expect(resultado.indexOf('Prestaciones:')).toBeGreaterThan(resultado.indexOf('Período'));
  });

  it('sin prestaciones (por-prestacion, presupuestos legacy sin líneas): no agrega el bloque', () => {
    const plantilla: PlantillaFactura = {
      identificadorOrigen: 'paciente.dni',
      campos: [{ id: 'c-1', etiqueta: 'Prestación', origen: 'traslado.prestacion', orden: 0 }],
    };

    const resultado = renderDescripcionFactura(plantilla, datosBase);

    expect(resultado).not.toContain('Prestaciones:');
  });
});
