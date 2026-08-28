// Snapshots congelados al emitir una factura (facturacion-electronica-arca, design.md D8): el
// contenido del documento fiscal se calcula del lado del servidor, no en el cliente.
//
// ⚠️ Esto es una COPIA Deno-limpia de las funciones puras del frontend:
//   frontend/src/shared/lib/facturacion/{calcularFechaEstimadaCobro,resolverIdentificadorFactura,
//   construirDatosDescripcion,renderDescripcionFactura}.ts
// No se importan directamente porque el frontend usa imports sin extensión (`./constantes`) y
// tipos cross-file que el bundler de Deno/Supabase Edge no resuelve. La paridad entre esta copia y
// el original se cubre con un test dedicado (tasks.md 2.7) — si alguno de esos archivos cambia,
// actualizar acá y correr el test de paridad.
//
// Constantes de plazo de cobro (frontend/src/shared/lib/facturacion/constantes.ts):
const PLAZO_COBRO_DEFAULT_DIAS = 90;
const PLAZO_COBRO_AMPARO_DIAS = 45;

// -------------------------------------------------------------------------------------------
// calcularFechaEstimadaCobro (RN-FA-04): fechaFactura + plazo. Precedencia: amparo judicial >
// plazo propio de la obra social > default general.
// -------------------------------------------------------------------------------------------

export interface CalcularFechaEstimadaCobroInput {
  fechaFactura: string;
  amparoJudicial: boolean;
  plazoObraSocial: number | undefined;
}

export function calcularFechaEstimadaCobro(input: CalcularFechaEstimadaCobroInput): string {
  const plazo = input.amparoJudicial
    ? PLAZO_COBRO_AMPARO_DIAS
    : input.plazoObraSocial ?? PLAZO_COBRO_DEFAULT_DIAS;
  const fecha = new Date(`${input.fechaFactura}T00:00:00.000Z`);
  fecha.setUTCDate(fecha.getUTCDate() + plazo);
  return fecha.toISOString().slice(0, 10);
}

// -------------------------------------------------------------------------------------------
// resolverIdentificadorFactura (IN-01): DNI o número de afiliado según la plantilla de la OS.
// -------------------------------------------------------------------------------------------

export type IdentificadorOrigenFactura = 'paciente.dni' | 'paciente.numeroAfiliado';

export interface IdentificadorFactura {
  origen: IdentificadorOrigenFactura;
  valor: string;
}

export interface PacienteParaIdentificador {
  dni: string;
  numeroAfiliadoValor: string;
}

export function resolverIdentificadorFactura(
  paciente: PacienteParaIdentificador,
  identificadorOrigen: IdentificadorOrigenFactura,
): IdentificadorFactura {
  if (identificadorOrigen === 'paciente.dni') {
    return { origen: 'paciente.dni', valor: paciente.dni };
  }
  return { origen: 'paciente.numeroAfiliado', valor: paciente.numeroAfiliadoValor };
}

// -------------------------------------------------------------------------------------------
// renderDescripcionFactura + construirDatosDescripcion (RF-400): recorre la plantilla de la OS.
// -------------------------------------------------------------------------------------------

export type OrigenCampoPlantilla =
  | 'paciente.nombre'
  | 'paciente.dni'
  | 'paciente.numeroAfiliado'
  | 'paciente.domicilio'
  | 'traslado.prestacion'
  | 'traslado.mesYAnio'
  | 'traslado.cantidadDias'
  | 'traslado.dependenciaYRetorno'
  | 'traslado.valorKm'
  | 'traslado.cantidadKm'
  | 'traslado.total'
  | 'valor-manual';

export interface PlantillaCampo {
  id: string;
  etiqueta: string;
  origen: OrigenCampoPlantilla;
  orden: number;
}

export interface DatosDescripcionFactura {
  pacienteNombre: string;
  pacienteDni: string;
  pacienteNumeroAfiliado: string;
  domicilio: string;
  prestacion: string;
  mesFacturado: number;
  anioFacturado: number;
  cantidadDias: number;
  dependenciaYRetorno: string;
  valorKm: number;
  cantidadKm: number;
  total: number;
  valoresManuales: Record<string, string>;
  prestaciones: string[];
}

export interface DireccionPaciente {
  id: string;
  calle: string;
  localidad: string;
}

export interface PacienteParaDescripcion {
  nombre: string;
  apellido: string;
  dni: string;
  numeroAfiliadoValor: string;
  direcciones: DireccionPaciente[];
}

export interface CamposParaDescripcion {
  prestacion: string;
  mesFacturado: number;
  anioFacturado: number;
  dias: number;
  dependenciaYRetorno: string;
  valorKm: number;
  cantidadKm: number;
  monto: number;
  domicilioId: string;
  prestaciones?: string[];
}

export function construirDatosDescripcion(
  campos: CamposParaDescripcion,
  paciente: PacienteParaDescripcion,
): DatosDescripcionFactura {
  const domicilio = paciente.direcciones.find((d) => d.id === campos.domicilioId);
  return {
    pacienteNombre: `${paciente.apellido}, ${paciente.nombre}`,
    pacienteDni: paciente.dni,
    pacienteNumeroAfiliado: paciente.numeroAfiliadoValor,
    domicilio: domicilio ? `${domicilio.calle}, ${domicilio.localidad}` : '',
    prestacion: campos.prestacion,
    mesFacturado: campos.mesFacturado,
    anioFacturado: campos.anioFacturado,
    cantidadDias: campos.dias,
    dependenciaYRetorno: campos.dependenciaYRetorno,
    valorKm: campos.valorKm,
    cantidadKm: campos.cantidadKm,
    total: campos.monto,
    valoresManuales: {},
    prestaciones: campos.prestaciones ?? [],
  };
}

function formatearMesYAnio(mes: number, anio: number): string {
  return `${String(mes).padStart(2, '0')}/${anio}`;
}

function resolverValor(origen: OrigenCampoPlantilla, campoId: string, datos: DatosDescripcionFactura): string {
  switch (origen) {
    case 'paciente.nombre':
      return datos.pacienteNombre;
    case 'paciente.dni':
      return datos.pacienteDni;
    case 'paciente.numeroAfiliado':
      return datos.pacienteNumeroAfiliado;
    case 'paciente.domicilio':
      return datos.domicilio;
    case 'traslado.prestacion':
      return datos.prestacion;
    case 'traslado.mesYAnio':
      return formatearMesYAnio(datos.mesFacturado, datos.anioFacturado);
    case 'traslado.cantidadDias':
      return String(datos.cantidadDias);
    case 'traslado.dependenciaYRetorno':
      return datos.dependenciaYRetorno;
    case 'traslado.valorKm':
      return String(datos.valorKm);
    case 'traslado.cantidadKm':
      return String(datos.cantidadKm);
    case 'traslado.total':
      return String(datos.total);
    case 'valor-manual':
      return datos.valoresManuales[campoId] ?? '';
    default:
      return '';
  }
}

export function renderDescripcionFactura(campos: PlantillaCampo[], datos: DatosDescripcionFactura): string {
  const ordenados = [...campos].sort((a, b) => a.orden - b.orden);
  const lineas = ordenados.map((c) => `${c.etiqueta}: ${resolverValor(c.origen, c.id, datos)}`).join('\n');
  if (datos.prestaciones.length === 0) return lineas;
  const bloque = `Prestaciones: ${datos.prestaciones.join(', ')}`;
  return lineas === '' ? bloque : `${lineas}\n${bloque}`;
}
