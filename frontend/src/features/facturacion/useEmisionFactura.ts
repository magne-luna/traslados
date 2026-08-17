import { useCallback, useState } from 'react';
import type { ActualizacionFactura, Factura } from '../../shared/types/factura';
import type { CupoAutorizado } from '../../shared/types/presupuesto';
import type { ObraSocial } from '../../shared/types/obraSocial';
import type { Paciente } from '../../shared/types/paciente';
import type { AutorizacionRepository } from '../../shared/lib/presupuestos/AutorizacionRepository';
import type { PresupuestoRepository } from '../../shared/lib/presupuestos/PresupuestoRepository';
import { derivarCupoAutorizado } from '../../shared/lib/presupuestos/cupoAutorizado';
import { construirDatosDescripcion } from '../../shared/lib/facturacion/construirDatosDescripcion';
import { cupoConsumido } from '../../shared/lib/facturacion/cupoConsumido';
import { calcularFechaEstimadaCobro } from '../../shared/lib/facturacion/calcularFechaEstimadaCobro';
import { prestacionesDePresupuesto } from '../../shared/lib/facturacion/prestacionesDescripcion';
import { renderDescripcionFactura } from '../../shared/lib/facturacion/renderDescripcionFactura';
import { resolverIdentificadorFactura } from '../../shared/lib/facturacion/resolverIdentificadorFactura';
import { validarCupoFacturacion, type ValidarCupoFacturacionResultado } from '../../shared/lib/facturacion/validarCupoFacturacion';

interface UseEmisionFacturaArgs {
  factura: Factura | null;
  paciente: Paciente | undefined;
  obraSocial: ObraSocial | undefined;
  facturasExistentes: Factura[];
  autorizacionRepository: AutorizacionRepository;
  /** WU2 (2026-08-16): el bloque "Prestaciones:" de la descripción congelada al emitir se arma de
   * las líneas del presupuesto de la autorización elegida (decisión usuaria, opción a del brief). */
  presupuestoRepository: PresupuestoRepository;
  actualizar: (id: string, data: ActualizacionFactura) => Promise<Factura>;
  onError: (mensaje: string) => void;
}

function toErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'Ocurrió un error inesperado.';
}

// Encapsula la resolución del CupoAutorizado real (tasks.md 8.2: PresupuestoRepository +
// AutorizacionRepository + derivarCupoAutorizado, sin reimplementar la derivación) y la acción
// de emitir (tasks.md 9.1, 8.4): fija fechaFactura, congela descripcion e identificadorFactura,
// calcula fechaEstimadaCobro, y exige confirmación explícita — sin bloquear — cuando se excede
// el cupo (design.md Decisión 6). Extraído de FacturaDetail (tasks.md 12.3) para separar lógica
// de negocio de la composición visual.
export function useEmisionFactura({
  factura,
  paciente,
  obraSocial,
  facturasExistentes,
  autorizacionRepository,
  presupuestoRepository,
  actualizar,
  onError,
}: UseEmisionFacturaArgs) {
  const [cupoParaConfirmar, setCupoParaConfirmar] = useState<ValidarCupoFacturacionResultado | null>(null);

  // `resolverCupoAutorizado` deja de adivinar (change `facturacion-seleccion-autorizacion`,
  // design.md D6): antes iteraba TODOS los presupuestos del paciente y devolvía la primera
  // autorización con cupo cargado — con varias autorizaciones simultáneas (`por-prestacion`) eso
  // podía alertar contra la autorización equivocada. Ahora recibe la autorización ELEGIDA en el
  // Paso 2 del wizard (`autorizacionId`) y deriva el cupo de ESA, vía `getById` +
  // `derivarCupoAutorizado` (reusada sin cambios). Sin `autorizacionId` (facturas anteriores a
  // este change, `autorizacion_id NULL`) → `undefined`, camino ya tolerado por
  // `validarCupoFacturacion` (sin cupo, no alerta).
  const resolverCupoAutorizado = useCallback(
    async (pacienteId: string, autorizacionId: string | undefined): Promise<CupoAutorizado | undefined> => {
      if (!pacienteId || !autorizacionId) return undefined;
      const autorizacion = await autorizacionRepository.getById(autorizacionId);
      if (!autorizacion) return undefined;
      return derivarCupoAutorizado(autorizacion, pacienteId);
    },
    [autorizacionRepository],
  );

  // WU2 (2026-08-16, opción a del brief): resuelve los nombres del bloque "Prestaciones:" desde
  // las LÍNEAS del presupuesto de la autorización ELEGIDA (`autorizacionId` → `getById` →
  // `presupuestoId` → `getById` → `prestacionesDePresupuesto` contra el catálogo del paciente).
  // Sin autorización (legacy, `autorizacion_id NULL`), autorización sin presupuesto resuelto o
  // presupuesto legacy sin líneas (REAPERTURA #13): `[]` — el bloque no se agrega, no se adivina.
  // `paciente` entra ya angostado por el guard de `emitirFactura`.
  async function resolverPrestacionesDescripcion(pacienteResuelto: Paciente): Promise<string[]> {
    if (!factura?.autorizacionId) return [];
    const autorizacion = await autorizacionRepository.getById(factura.autorizacionId);
    if (!autorizacion) return [];
    const presupuesto = await presupuestoRepository.getById(autorizacion.presupuestoId);
    return prestacionesDePresupuesto(presupuesto ?? undefined, pacienteResuelto);
  }

  async function emitirFactura() {
    if (!factura || !paciente) return;
    try {
      const identificadorOrigen = obraSocial?.plantillaFactura.identificadorOrigen ?? 'paciente.numeroAfiliado';
      const identificadorFactura = resolverIdentificadorFactura(paciente, identificadorOrigen);
      const fechaFactura = new Date().toISOString().slice(0, 10);
      const fechaEstimadaCobro = calcularFechaEstimadaCobro({
        fechaFactura,
        amparoJudicial: paciente.amparoJudicial,
        // `ObraSocial.plazoCobroDias` (change `sacar-prestadores`, RF-306): dato real por obra
        // social, columna ya existente en la base (`obra_social.plazo_cobro_dias`) reexpuesta
        // vía `obraSocialMapping.ts`. Sin configurar (`undefined`), `calcularFechaEstimadaCobro`
        // cae en `PLAZO_COBRO_DEFAULT_DIAS` por su propia precedencia — sin duplicarla acá.
        plazoObraSocial: obraSocial?.plazoCobroDias,
      });
      const descripcion = obraSocial
        ? renderDescripcionFactura(
            obraSocial.plantillaFactura,
            construirDatosDescripcion(
              { ...factura, prestaciones: await resolverPrestacionesDescripcion(paciente) },
              paciente,
            ),
          )
        : factura.descripcion;
      await actualizar(factura.id, { estado: 'facturado', fechaFactura, fechaEstimadaCobro, identificadorFactura, descripcion });
    } catch (err) {
      onError(toErrorMessage(err));
    }
  }

  async function handleEmitirClick() {
    if (!factura) return;
    const cupo = await resolverCupoAutorizado(factura.pacienteId, factura.autorizacionId);
    const consumido = cupoConsumido(facturasExistentes, factura.pacienteId, factura.mesFacturado, factura.anioFacturado, {
      excluirFacturaId: factura.id,
    });
    const resultado = validarCupoFacturacion({
      diasFacturados: consumido.dias + factura.dias,
      kmFacturados: consumido.km + factura.cantidadKm,
      cupo,
    });
    if (resultado.excedeDias || resultado.excedeKm) {
      setCupoParaConfirmar(resultado);
      return;
    }
    await emitirFactura();
  }

  async function handleConfirmarEmision() {
    setCupoParaConfirmar(null);
    await emitirFactura();
  }

  return { resolverCupoAutorizado, cupoParaConfirmar, handleEmitirClick, handleConfirmarEmision };
}
