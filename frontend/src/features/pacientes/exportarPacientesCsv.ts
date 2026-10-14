import type { Paciente } from '../../shared/types/paciente';

/** Edad cumplida a `ahora`. Lee la fecha ISO ('YYYY-MM-DD') por partes: `new Date('2009-10-15')` es
 * medianoche UTC, que en Argentina cae el día anterior y adelantaba un día el cumpleaños. */
export function calcularEdad(fechaNacimiento: string, ahora: Date): number {
  const [anio = 0, mes = 1, dia = 1] = fechaNacimiento.split('-').map(Number);
  let edad = ahora.getFullYear() - anio;
  const aunNoCumplio = ahora.getMonth() + 1 < mes || (ahora.getMonth() + 1 === mes && ahora.getDate() < dia);
  if (aunNoCumplio) edad -= 1;
  return edad;
}

function fechaArgentina(iso: string): string {
  const [anio, mes, dia] = iso.split('-');
  return anio && mes && dia ? `${dia}/${mes}/${anio}` : '';
}

function celda(valor: string | number): string {
  const texto = String(valor);
  return /[;"\r\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

const ENCABEZADO = ['Apellido y nombre', 'Obra social', 'DNI', 'Vencimiento CUD', 'Edad', 'Amparo'];

/**
 * Listado de pacientes para abrir en Excel (Andrea, 2026-08-04). CSV y no .xlsx para no sumar una
 * dependencia: `;` es el separador que espera Excel en es-AR y el BOM hace que respete las tildes.
 */
export function pacientesACsv(pacientes: Paciente[], nombreObraSocial: (id: string | null) => string, ahora: Date): string {
  const filas = pacientes.map((paciente) => [
    `${paciente.apellido}, ${paciente.nombre}`,
    nombreObraSocial(paciente.obraSocialId),
    paciente.dni,
    paciente.cud ? fechaArgentina(paciente.cud.fechaVencimiento) : '',
    paciente.fechaNacimiento ? calcularEdad(paciente.fechaNacimiento, ahora) : '',
    paciente.amparoJudicial ? 'Sí' : 'No',
  ]);
  return '﻿' + [ENCABEZADO, ...filas].map((fila) => fila.map(celda).join(';') + '\r\n').join('');
}
