import { describe, expect, it } from 'vitest';
import type { Cobro, Factura } from '../../types/factura';
import type { HojaDeRuta } from '../../types/hojaDeRuta';
import type { Paciente } from '../../types/paciente';
import type { Vehiculo } from '../../types/vehiculo';
import { alertasMantenimiento } from './alertasMantenimiento';
import { cudPorVencer } from './cudPorVencer';
import { facturasEnMora } from './facturasEnMora';
import { resumenDelDia } from './resumenDelDia';

// tasks.md 4.8, spec reportes-contract (Scenario "Sin mutar la entrada"): ninguna función de
// agregación ordena, filtra ni modifica en el lugar las colecciones recibidas — siempre
// devuelve estructuras nuevas. Se compara la entrada (deep clone) antes y después de invocar
// cada función de la sección 4.

function factura(overrides: Partial<Factura> = {}): Factura {
  return {
    id: 'f1',
    pacienteId: 'p1',
    descripcion: '',
    dias: 10,
    valorKm: 100,
    monto: 10_000,
    estado: 'facturado',
    fechaInicial: '2026-01-01',
    fechaTope: '2026-01-31',
    tipoComprobante: 'A',
    cantidadKm: 50,
    prestacion: 'Kinesiología',
    mesFacturado: 1,
    anioFacturado: 2026,
    dependenciaYRetorno: '',
    domicilioId: 'dir-1',
    asistencias: [],
    fechaFactura: '2026-02-01',
    ...overrides,
  };
}

function cobro(overrides: Partial<Cobro> & Pick<Cobro, 'id' | 'facturaId' | 'montoPagado'>): Cobro {
  return { fecha: '2026-01-15', ...overrides };
}

function paciente(overrides: Partial<Paciente> = {}): Paciente {
  return {
    id: 'p1',
    apellido: 'Pérez',
    nombre: 'Juana',
    fechaNacimiento: '2000-01-01',
    dni: '30111222',
    cuilTitular: '27301112223',
    diagnostico: '',
    accesorioMovilidad: [],
    obraSocialId: null,
    numeroAfiliado: { formato: 'numero-documento', valor: '30111222' },
    cud: { numero: '1', fechaEmision: '2020-01-01', fechaVencimiento: '2026-08-01' },
    direcciones: [],
    personasACargo: [],
    amparoJudicial: false,
    ...overrides,
  };
}

function vehiculo(overrides: Partial<Vehiculo> = {}): Vehiculo {
  return {
    id: 'v1',
    patente: 'AB123CD',
    modelo: 'Sprinter',
    tipo: 'combi',
    capacidad: 6,
    accesoriosCompatibles: [],
    estado: 'habilitado',
    kilometraje: 20_000,
    kilometrajeUltimoService: 0,
    fechaUltimoService: '2020-01-01',
    habilitaciones: [{ tipo: 'vtv', fechaEmision: '2025-01-01', fechaVencimiento: '2026-01-01' }],
    gastos: [],
    ...overrides,
  };
}

function hojaDeRuta(): HojaDeRuta {
  return {
    id: 'h1',
    fecha: '2026-07-24',
    franjaInicio: '08:00',
    franjaFin: '20:00',
    recorridos: [
      {
        id: 'r1',
        vehiculoId: 'v1',
        conductorId: 'c1',
        manual: false,
        paradas: [{ id: 'p1', pacienteId: 'pac-1', tramo: 'ida', direccionOrigenId: 'd1', direccionDestinoId: 'd2', orden: 1 }],
      },
    ],
  };
}

describe('Sección 4: ninguna función muta las colecciones recibidas', () => {
  it('facturasEnMora no muta facturas ni cobros', () => {
    const facturas = [factura()];
    const cobros = [cobro({ id: 'c1', facturaId: 'f1', montoPagado: 100 })];
    const facturasAntes = structuredClone(facturas);
    const cobrosAntes = structuredClone(cobros);

    facturasEnMora({ facturas, cobros, hoy: '2026-06-01' });

    expect(facturas).toEqual(facturasAntes);
    expect(cobros).toEqual(cobrosAntes);
  });

  it('cudPorVencer no muta pacientes', () => {
    const pacientes = [paciente()];
    const antes = structuredClone(pacientes);

    cudPorVencer({ pacientes, hoy: new Date('2026-07-24'), umbralDias: 60 });

    expect(pacientes).toEqual(antes);
  });

  it('alertasMantenimiento no muta vehiculos', () => {
    const vehiculos = [vehiculo()];
    const antes = structuredClone(vehiculos);

    alertasMantenimiento({ vehiculos, ahora: new Date('2026-07-24') });

    expect(vehiculos).toEqual(antes);
  });

  it('resumenDelDia no muta la hoja de ruta recibida', () => {
    const hoja = hojaDeRuta();
    const antes = structuredClone(hoja);

    resumenDelDia(hoja);

    expect(hoja).toEqual(antes);
  });
});
