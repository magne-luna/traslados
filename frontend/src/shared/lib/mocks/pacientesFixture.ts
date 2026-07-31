import type { Paciente } from '../../types/paciente';

const MS_POR_DIA = 24 * 60 * 60 * 1000;

function isoDateEnDias(dias: number): string {
  return new Date(Date.now() + dias * MS_POR_DIA).toISOString().slice(0, 10);
}

// Fixture inicial del mock de Pacientes (design.md Decisión 5, tasks.md 3.2): siembra pacientes
// con los tres formatos de identificador de afiliado (RN-ID-02, IN-01), uno con amparo judicial
// y otro sin él, un par de direcciones de ejemplo (domicilio/escuela, referenciadas por id desde
// hojas-de-ruta y facturación) y un CUD "por-vencer" para ejercitar la alerta (RF-104). Las
// fechas de CUD se calculan relativas a `Date.now()` (nunca hardcodeadas) para que el fixture
// siga siendo representativo sin importar cuándo se lea.
export function buildPacientesFixture(): Paciente[] {
  const martina: Paciente = {
    id: 'paciente-martina',
    apellido: 'Gómez',
    segundoApellido: 'Díaz',
    nombre: 'Martina',
    segundoNombre: 'Sol',
    fechaNacimiento: '2015-03-12',
    dni: '45123456',
    cuilTitular: '27-30111222-4',
    diagnostico: 'Parálisis cerebral',
    condicion: 'Estable, requiere seguimiento trimestral',
    // Múltiple (docx: tabla de vínculo Paciente-Accesorio, igual que Vehiculo-Accesorio): Martina
    // ejercita el caso de 2+ accesorios cargados a la vez.
    accesorioMovilidad: ['silla-plegable', 'andador'],
    obraSocialId: 'osecac',
    numeroAfiliado: { valor: '45123456' },
    cud: { numero: 'CUD-2021-001', fechaEmision: '2021-01-10', fechaVencimiento: isoDateEnDias(400) },
    direcciones: [
      { id: 'dir-martina-domicilio-ida', tipo: 'domicilio', calle: 'Av. Rivadavia 4500', localidad: 'CABA', dias: 'Lunes a viernes', horario: '08:00' },
      { id: 'dir-martina-escuela-vuelta', tipo: 'escuela', calle: 'Escuela N°12, Bulnes 1200', localidad: 'CABA', dias: 'Lunes a viernes', horario: '16:30' },
    ],
    // Teléfono/teléfono alternativo viven en Personas a Cargo (docx), no en Paciente.
    personasACargo: [
      { id: 'pac-martina-1', nombre: 'Laura', apellido: 'Gómez', dni: '30111222', telefono: '11-4444-5555' },
    ],
    amparoJudicial: false,
  };

  const facundo: Paciente = {
    id: 'paciente-facundo',
    apellido: 'Pereyra',
    nombre: 'Facundo',
    fechaNacimiento: '2010-11-02',
    dni: '46987654',
    cuilTitular: '20-25333444-5',
    diagnostico: 'Trastorno del espectro autista',
    // Ninguno cargado (array vacío, no `null`): Facundo ejercita el caso de 0 accesorios.
    accesorioMovilidad: [],
    obraSocialId: 'osecac',
    // Formato alfanumérico: alguna obras sociales emiten credenciales con letras (IN-01).
    numeroAfiliado: { valor: 'OS-AB12345' },
    // CUD "por-vencer": dentro del umbral de 60 días (design.md Decisión 3, RF-104).
    cud: { numero: 'CUD-2022-045', fechaEmision: '2022-02-01', fechaVencimiento: isoDateEnDias(30) },
    direcciones: [
      { id: 'dir-facundo-domicilio-ida', tipo: 'domicilio', calle: 'Calle 50 N°850', localidad: 'La Plata' },
    ],
    personasACargo: [
      {
        id: 'pac-facundo-1',
        nombre: 'Roberto',
        apellido: 'Pereyra',
        dni: '25333444',
        telefono: '221-555-6666',
        telefonoAlternativo: '221-555-7777',
      },
    ],
    amparoJudicial: true,
    amparoJudicialAclaracion: 'Amparo judicial N°4521/22 — cobertura al 100%.',
  };

  const brisa: Paciente = {
    id: 'paciente-brisa',
    apellido: 'Ledesma',
    nombre: 'Brisa',
    fechaNacimiento: '2018-06-20',
    dni: '48222111',
    // CUIL del titular con sufijo /01: formato distinto del identificador de afiliado (RN-ID-01).
    cuilTitular: '27-28555666/01',
    diagnostico: 'Síndrome de Down',
    // Uno solo cargado: Brisa ejercita el caso intermedio entre 0 (Facundo) y 2+ (Martina).
    accesorioMovilidad: ['andador'],
    obraSocialId: null,
    // Formato CUIL con sufijo: el identificador de afiliado usa el CUIL del titular con /01.
    numeroAfiliado: { valor: '27-28555666/01' },
    cud: null,
    direcciones: [],
    personasACargo: [],
    amparoJudicial: false,
  };

  return [martina, facundo, brisa];
}
