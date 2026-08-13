import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { Paciente } from '../../shared/types/paciente';
import type { ObraSocial } from '../../shared/types/obraSocial';
import { ResumenPasoWizard } from './ResumenPasoWizard';

// `prestadorNombre`/`prestadorDomicilio` se retiraron por completo (change
// `facturacion-seleccion-autorizacion`, design.md D5) — `autorizacionLabel` los reemplaza (D4).

const martina: Paciente = {
  id: 'paciente-martina',
  apellido: 'Gómez',
  nombre: 'Martina',
  fechaNacimiento: '2015-03-12',
  dni: '45123456',
  cuilTitular: '27-30111222-4',
  diagnostico: 'Parálisis cerebral',
  accesorioMovilidad: [],
  obraSocialId: 'osecac',
  numeroAfiliado: { valor: '45123456' },
  cud: null,
  direcciones: [],
  personasACargo: [],
  amparoJudicial: false,
};

const osecac: ObraSocial = {
  id: 'osecac',
  nombre: 'OSECAC',
  cuit: '30-54155200-6',
  modalidadFacturacion: 'por-prestacion',
  admitePagosParciales: false,
  formatoAfiliado: 'numero-documento',
  checklist: [],
  plantillaFactura: { campos: [], identificadorOrigen: 'paciente.numeroAfiliado' },
};

describe('ResumenPasoWizard — autorizacionLabel (D4)', () => {
  it('sin paciente elegido: no muestra ninguna etiqueta de autorización', () => {
    render(<ResumenPasoWizard paciente={undefined} obraSocial={undefined} autorizacionLabel="Kinesiología" />);
    expect(screen.queryByText('Kinesiología')).not.toBeInTheDocument();
  });

  it('sin autorizacionLabel (todavía no se eligió ninguna): no muestra esa fila', () => {
    render(<ResumenPasoWizard paciente={martina} obraSocial={osecac} />);
    expect(screen.getByText('OSECAC')).toBeInTheDocument();
  });

  it('con autorizacionLabel: la muestra junto al resto del resumen', () => {
    render(<ResumenPasoWizard paciente={martina} obraSocial={osecac} autorizacionLabel="Kinesiología" />);
    expect(screen.getByText('Kinesiología')).toBeInTheDocument();
  });
});
