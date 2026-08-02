// Sugerencias de horario para el combo de "Hora estimada" (feedback de usuario: ni el spinner
// nativo de `type="time"` ni un <select> largo resultaban cómodos). El campo sigue siendo texto
// libre (formato "HH:mm") — esto son sugerencias vía HoraEstimadaCombo (antes <datalist>, que no
// se podía acotar en alto/scroll por ser un popup dibujado por el browser), no una restricción de
// valores.
//
// Rango acotado a horario operativo habitual (06:00-22:00, cada 30 min — feedback de usuario: la
// lista completa de 24hs cada 15 min arrancaba en 00:00 y obligaba a scrollear mucho para llegar
// a un horario útil). Sigue siendo posible escribir cualquier hora fuera de este rango a mano.
const HORA_INICIO = 6;
const HORA_FIN = 22;
const PASO_MINUTOS = 30;

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

const pasosPorHora = 60 / PASO_MINUTOS;
const cantidadPasos = (HORA_FIN - HORA_INICIO) * pasosPorHora + 1;

export const HORARIOS_SUGERIDOS: string[] = Array.from({ length: cantidadPasos }, (_, indice) => {
  const minutosTotales = HORA_INICIO * 60 + indice * PASO_MINUTOS;
  return `${pad(Math.floor(minutosTotales / 60))}:${pad(minutosTotales % 60)}`;
});
