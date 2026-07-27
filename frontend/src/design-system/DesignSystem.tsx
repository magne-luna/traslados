import { useId, useState, type ReactNode } from 'react';
import type { SemanticStatus } from './tokens';
import { Section, Swatch, Button, Chip, NavIcon, chipColors } from './components';
import { Field, Input, Select, Textarea } from './form';
import { Alert, Pill, EmptyState } from './feedback';
import { Card, Panel } from './layout';
import { Table, Tr, Th, Td } from './table';
import { DocumentChecklist } from '../shared/components/DocumentChecklist';
import { useDocumentChecklist } from '../shared/lib/documentos/useDocumentChecklist';
import { mockDocumentoRepository } from '../shared/lib/documentos/mockDocumentoRepository';
import type { ChecklistItem } from '../shared/types/documento';

const ALL_TONES: SemanticStatus[] = ['success', 'warning', 'danger', 'info', 'secondary'];

// Preview del design system — calcado de ../../prototype.html (validado con el cliente) y
// portado acá como primer artefacto real de FE-0/FE-1. Los primitivos (Section, Swatch, Button,
// Chip, NavIcon) viven en ./components.tsx y se reusan en toda la app, no solo acá.
// Ver knowledge-base/08_arquitectura_propuesta.md y ROADMAP-FRONTEND.md § FE-0/FE-1.
//
// Estilado 100% con clases Tailwind (Regla Dura del proyecto): los tokens viven como variables
// de @theme en src/index.css, no como objeto JS consumido por style={{}}.

function FacturaCard({ estado, children }: { estado: SemanticStatus; children: ReactNode }) {
  return (
    <div
      className={`rounded-lg border border-border border-l-[3px] bg-surface p-lg shadow-sm ${chipColors[estado].borderLeft}`}
    >
      {children}
    </div>
  );
}

type ModuleKey = 'dashboard' | 'hojasRuta' | 'pacientes' | 'obrasSociales' | 'facturacion' | 'flota';

const MODULES: { key: ModuleKey; label: string }[] = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'hojasRuta', label: 'Hojas de Ruta' },
  { key: 'pacientes', label: 'Pacientes' },
  { key: 'obrasSociales', label: 'Obras Sociales' },
  { key: 'facturacion', label: 'Facturación y Cobros' },
  { key: 'flota', label: 'Flota y Conductores' },
];

const moduleIcons: Record<ModuleKey, ReactNode> = {
  dashboard: (
    <>
      <rect x={3} y={3} width={7} height={9} rx={1} />
      <rect x={14} y={3} width={7} height={5} rx={1} />
      <rect x={14} y={12} width={7} height={9} rx={1} />
      <rect x={3} y={16} width={7} height={5} rx={1} />
    </>
  ),
  hojasRuta: (
    <path d="M9 20 3 17V4l6 3 6-3 6 3v13l-6-3-6 3zM9 7v13m6-16v13" strokeLinecap="round" strokeLinejoin="round" />
  ),
  pacientes: (
    <path
      d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m7-10a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm11 10v-2a4 4 0 0 0-3-3.87m-4-12a4 4 0 0 1 0 7.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  obrasSociales: <path d="m8 3 4 8 5-5 5 15H2L8 3z" strokeLinecap="round" strokeLinejoin="round" />,
  facturacion: (
    <>
      <line x1={12} y1={1} x2={12} y2={23} />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  flota: (
    <>
      <rect x={3} y={3} width={18} height={18} rx={2} ry={2} />
      <line x1={9} y1={3} x2={9} y2={21} />
      <line x1={15} y1={3} x2={15} y2={21} />
      <line x1={3} y1={9} x2={21} y2={9} />
      <line x1={3} y1={15} x2={21} y2={15} />
    </>
  ),
};

function ModulePermissionsSidebar() {
  // RN-GL-01: no hay roles fijos. Cada cuenta habilita/deshabilita módulos de forma
  // independiente — por eso este preview usa checkboxes sueltos, no un selector de "rol"
  // (a diferencia de otros design systems que sí modelan roles predefinidos).
  const [enabled, setEnabled] = useState<Record<ModuleKey, boolean>>({
    dashboard: true,
    hojasRuta: true,
    pacientes: true,
    obrasSociales: false,
    facturacion: false,
    flota: false,
  });

  const toggle = (key: ModuleKey) => setEnabled((prev) => ({ ...prev, [key]: !prev[key] }));
  const activeModules = MODULES.filter((m) => enabled[m.key]);

  return (
    <div>
      <div className="mb-lg flex flex-wrap gap-sm">
        {MODULES.map((m) => (
          <label
            key={m.key}
            className="flex cursor-pointer items-center gap-xs rounded-pill border border-border-strong bg-surface px-md py-xs font-body text-xs font-semibold text-text"
          >
            <input type="checkbox" checked={enabled[m.key]} onChange={() => toggle(m.key)} />
            {m.label}
          </label>
        ))}
      </div>

      <div className="flex max-w-[640px] overflow-hidden rounded-lg border border-border shadow-sm">
        <div className="w-[210px] border-r border-sidebar-border bg-sidebar-bg p-md">
          {activeModules.length === 0 && <span className="font-body text-xs text-faint">Sin módulos habilitados.</span>}
          {activeModules.map((m, index) => {
            const active = index === 0;
            return (
              <div
                key={m.key}
                className={`mb-0.5 flex items-center gap-sm rounded-sm p-sm text-[13px] font-semibold ${
                  active
                    ? 'bg-surface-soft text-sidebar-text-active shadow-[inset_2px_0_0_var(--color-primary-soft)]'
                    : 'bg-transparent text-sidebar-text shadow-none'
                }`}
              >
                <NavIcon>{moduleIcons[m.key]}</NavIcon>
                {m.label}
              </div>
            );
          })}
        </div>
        <div className="flex flex-1 items-center justify-center bg-surface p-xl">
          <span className="text-center font-body text-xs text-muted">
            Esta cuenta ve <b className="text-ink">{activeModules.length}</b> de {MODULES.length} módulos.
            <br />
            Sin roles fijos (RN-GL-01) — el módulo sin permiso no se renderiza, ni se atenúa: no
            existe en el DOM para esa cuenta.
          </span>
        </div>
      </div>
    </div>
  );
}

const pacientesRows: { nombre: string; dni: string; obraSocial: string; accesorio: string; cud: string; cudEstado: SemanticStatus }[] = [
  {
    nombre: 'Bautista Gómez',
    dni: '48.123.456',
    obraSocial: 'OSDE Discapacidad',
    accesorio: 'Silla de ruedas rígida',
    cud: 'Vence en 38d',
    cudEstado: 'warning',
  },
  {
    nombre: 'Milagros Rossi',
    dni: '51.987.654',
    obraSocial: 'PAMI (INSSJP)',
    accesorio: 'Silla postural',
    cud: 'Vigente (2027-01-15)',
    cudEstado: 'success',
  },
  {
    nombre: 'Tomás Peralta',
    dni: '53.456.123',
    obraSocial: 'APROSS Córdoba',
    accesorio: 'Andador',
    cud: 'Vencido',
    cudEstado: 'danger',
  },
];

const facturas: { id: string; paciente: string; monto: string; estado: SemanticStatus; label: string }[] = [
  { id: 'FAC-0001', paciente: 'Bautista Gómez', monto: '$346.500', estado: 'success', label: 'Cobrado' },
  { id: 'FAC-0002', paciente: 'Milagros Rossi', monto: '$275.000', estado: 'warning', label: 'Pagado parcial' },
  { id: 'FAC-0003', paciente: 'Bautista Gómez', monto: '$346.500', estado: 'danger', label: 'Facturado — en mora' },
];

// Checklist de ejemplo (OSDE Discapacidad, RF-305) para demostrar el componente reutilizable
// de FE-1 en vivo — items requeridos vs. opcionales, subir/quitar archivo con estado real
// (via useDocumentChecklist + mockDocumentoRepository, ver src/shared/lib/documentos/).
const demoChecklist: ChecklistItem[] = [
  { id: 'cud', nombre: 'CUD Vigente', requerido: true },
  { id: 'codem', nombre: 'CODEM Activo', requerido: true },
  { id: 'presupuesto', nombre: 'Presupuesto Firmado', requerido: true },
  { id: 'autorizacion', nombre: 'Autorización de Prestación', requerido: false },
];

function DocumentosDemo() {
  const { documentos, loading, upload, remove } = useDocumentChecklist(
    'paciente',
    'p1',
    demoChecklist,
    mockDocumentoRepository,
  );

  if (loading) {
    return <p className="font-body text-[13px] text-muted">Cargando checklist…</p>;
  }

  return <DocumentChecklist items={demoChecklist} documentos={documentos} onUpload={upload} onRemove={remove} />;
}

export default function DesignSystem() {
  return (
    <div className="min-h-screen bg-bg px-10 py-xxxl font-body text-text">
      <header className="mb-xxxl">
        <div className="font-mono text-[11px] tracking-[0.08em] text-muted">PASTOR TRASLADOS · DESIGN SYSTEM</div>
        <h1 className="mt-1.5 mb-2 font-heading text-[34px] font-bold text-ink">Design System</h1>
        <p className="max-w-155 font-body text-sm leading-normal text-muted">
          Base visual del panel de gestión de Traslados, calcada del prototipo validado
          (<code>prototype.html</code>): tema claro, sobrio y profesional, acento teal/cyan de
          marca, tipografía Plus Jakarta Sans + IBM Plex Sans. El sidebar de permisos no usa
          roles fijos — cada cuenta habilita módulos de forma independiente (RN-GL-01, ver{' '}
          <code>knowledge-base/05_reglas_de_negocio.md</code>).
        </p>
      </header>

      <Section label="01" title="Paleta">
        <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-lg">
          <Swatch hex="#1B2B2A" bgClassName="bg-ink" name="Grafito · Texto" usage="Títulos, texto principal" />
          <Swatch hex="#F2F6F5" bgClassName="bg-bg" name="Fondo" usage="Fondo de página" />
          <Swatch hex="#3F7D73" bgClassName="bg-primary" name="Teal · Marca" usage="Acción principal, nav activo" />
          <Swatch hex="#64A69D" bgClassName="bg-primary-soft" name="Teal suave" usage="Íconos, acentos, gráfico" />
          <Swatch hex="#4C86A0" bgClassName="bg-secondary" name="Cyan · Info" usage="Enlaces, info secundaria" />
          <Swatch hex="#2F9E6E" bgClassName="bg-success" name="Verde · Éxito" usage="Cobrado, vigente, activo" />
          <Swatch hex="#B9791F" bgClassName="bg-warning" name="Ámbar · Alerta" usage="Por vencer, pago parcial" />
          <Swatch hex="#C0524A" bgClassName="bg-danger" name="Rojo · Crítico" usage="Vencido, en mora, incompatible" />
        </div>
      </Section>

      <Section label="02" title="Tipografía">
        <div className="flex flex-col gap-lg">
          <div>
            <div className="font-heading text-2xl font-bold text-ink">Plus Jakarta Sans 700 — Títulos</div>
            <div className="font-mono text-[11px] text-muted">h1–h4, nombres de módulo, valores de KPI</div>
          </div>
          <div>
            <div className="font-body text-base font-semibold text-ink">IBM Plex Sans — Cuerpo e interfaz</div>
            <div className="font-body text-[13px] text-muted">Labels, formularios, texto de tablas. Legible en denso.</div>
          </div>
          <div>
            <div className="font-mono text-[15px] text-ink">IBM Plex Mono — Datos que alinean en columna</div>
            <div className="font-body text-[13px] text-muted">DNI, CUIL, patente, montos — todo lo que se lee en tabla</div>
          </div>
        </div>
      </Section>

      <Section label="03" title="Botones">
        <div className="flex flex-wrap gap-md">
          <Button variant="primary">Guardar</Button>
          <Button variant="secondary">Cancelar</Button>
          <Button variant="success">Registrar cobro</Button>
          <Button variant="danger">Inhabilitar vehículo</Button>
        </div>
      </Section>

      <Section label="04" title="Chips de estado">
        <div className="flex flex-wrap gap-sm">
          <Chip kind="success">Cobrado</Chip>
          <Chip kind="info">Facturado</Chip>
          <Chip kind="warning">Pago parcial</Chip>
          <Chip kind="danger">En mora</Chip>
          <Chip kind="secondary">Sin obra social</Chip>
        </div>
      </Section>

      <Section label="05" title="Grilla de pacientes">
        <div className="overflow-hidden rounded-lg border border-border bg-surface shadow-sm">
          <div className="grid grid-cols-[1.4fr_1fr_1.2fr_1.2fr_1fr] bg-surface-soft px-lg py-sm font-mono text-[11px] tracking-[0.04em] text-faint uppercase">
            <div>Paciente</div>
            <div>DNI</div>
            <div>Obra Social</div>
            <div>Accesorio</div>
            <div>Estado CUD</div>
          </div>
          {pacientesRows.map((p) => (
            <div
              key={p.dni}
              className="grid grid-cols-[1.4fr_1fr_1.2fr_1.2fr_1fr] items-center border-t border-border px-lg py-md text-[13px]"
            >
              <div className="font-semibold text-ink">{p.nombre}</div>
              <div className="font-mono text-xs">{p.dni}</div>
              <div className="text-muted">{p.obraSocial}</div>
              <div className="text-muted">{p.accesorio}</div>
              <div>
                <Chip kind={p.cudEstado}>{p.cud}</Chip>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section label="06" title="Facturas por estado">
        <div className="flex flex-col gap-md">
          {facturas.map((f) => (
            <FacturaCard key={f.id} estado={f.estado}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[13px] font-semibold text-ink">
                    {f.id} — {f.paciente}
                  </div>
                  <Chip kind={f.estado}>{f.label}</Chip>
                </div>
                <div className="font-mono text-sm text-ink">{f.monto}</div>
              </div>
            </FacturaCard>
          ))}
        </div>
        <p className="mt-sm font-body text-xs text-muted">
          El borde de color identifica el estado de cobro de un vistazo (RN-FA), sin repetir la
          etiqueta en todos lados.
        </p>
      </Section>

      <Section label="07" title="Formulario">
        <div className="grid max-w-130 grid-cols-2 gap-lg">
          <label className="flex flex-col gap-xs">
            <span className="text-xs font-semibold text-muted">DNI del paciente</span>
            <input
              className="rounded-sm border border-border-strong bg-surface px-md py-[9px] font-mono text-[13px] text-text"
              placeholder="48.123.456"
            />
          </label>
          <label className="flex flex-col gap-xs">
            <span className="text-xs font-semibold text-muted">Obra Social</span>
            <div className="flex items-center justify-between rounded-sm border border-border-strong bg-surface px-md py-[9px] font-body text-[13px] font-semibold text-text">
              OSDE Discapacidad
              <span className="text-[11px] text-muted">▾</span>
            </div>
          </label>
        </div>
      </Section>

      <Section label="08" title="Sidebar de permisos (por módulo, sin roles fijos)">
        <ModulePermissionsSidebar />
      </Section>

      <Section label="09" title="Alertas operativas">
        <div className="flex max-w-[420px] flex-col gap-sm">
          <div className="flex items-center gap-sm rounded-md bg-danger-soft px-md py-2.5">
            <span className="text-[13px] font-bold text-danger">●</span>
            <span className="text-[13px] text-text">3 facturas en mora</span>
          </div>
          <div className="flex items-center gap-sm rounded-md bg-warning-soft px-md py-2.5">
            <span className="text-[13px] font-bold text-warning">●</span>
            <span className="text-[13px] text-text">2 CUD por vencer</span>
          </div>
          <div className="flex items-center gap-sm rounded-md bg-success-soft px-md py-2.5">
            <span className="text-[13px] font-bold text-success">●</span>
            <span className="text-[13px] text-text">2 vehículos con mantenimiento al día</span>
          </div>
        </div>
      </Section>

      <Section label="10" title="Checklist documental (componente reutilizable — FE-1)">
        <p className="mt-[-8px] mb-md max-w-140 font-body text-xs text-muted">
          Mismo componente para Pacientes, Vehículos, Conductores y Facturas (RF-900 a RF-902) —
          solo cambia la lista de <code>items</code> (el checklist configurado por obra social,
          RF-305) y la entidad. Subí/quitá un archivo: es 100% funcional contra un repositorio
          mock en memoria (<code>useDocumentChecklist</code> + <code>mockDocumentoRepository</code>).
        </p>
        <div className="max-w-140">
          <DocumentosDemo />
        </div>
      </Section>

      <Section label="11" title="Campos de formulario (Field/Input/Select/Textarea)">
        <FormFieldsCatalog />
      </Section>

      <Section label="12" title="Alert (5 tonos × 2 énfasis × 2 tamaños)">
        <AlertCatalog />
      </Section>

      <Section label="13" title="Card / Panel">
        <CardCatalog />
      </Section>

      <Section label="14" title="Table">
        <TableCatalog />
      </Section>

      <Section label="15" title="Pill / EmptyState">
        <PillEmptyStateCatalog />
      </Section>

      <Section label="16" title="Button (variantes × tamaños)">
        <ButtonCatalog />
      </Section>
    </div>
  );
}

// Catálogo de los primitivos de campo (form.tsx) — las 3 densidades, uso suelto (celda de tabla)
// y en Field (label + control + error), para que la comparación visual (Evidencia B) de las
// migraciones de la sección 9+ sea posible de un vistazo.
function FormFieldsCatalog() {
  const formId = useId();
  return (
    <div className="flex flex-col gap-lg">
      <div className="grid grid-cols-1 gap-lg md:grid-cols-3">
        <Field label="Nombre (comfortable)" htmlFor={`${formId}-nombre`} hint="Densidad por default">
          <Input id={`${formId}-nombre`} density="comfortable" placeholder="Ej. OSDE" value="" onChange={() => {}} />
        </Field>
        <Field label="Etiqueta (compact)" htmlFor={`${formId}-etiqueta`} error="Campo requerido">
          <Input id={`${formId}-etiqueta`} density="compact" value="" onChange={() => {}} />
        </Field>
        <Field label="Monto (tight)" htmlFor={`${formId}-monto`}>
          <Input id={`${formId}-monto`} density="tight" value="" onChange={() => {}} />
        </Field>
      </div>
      <div className="grid grid-cols-1 gap-lg md:grid-cols-2">
        <Field label="Obra social (Select)" htmlFor={`${formId}-select`}>
          <Select id={`${formId}-select`} value="" onChange={() => {}}>
            <option value="">Elegir…</option>
            <option value="osde">OSDE</option>
          </Select>
        </Field>
        <Field label="Observaciones (Textarea)" htmlFor={`${formId}-textarea`}>
          <Textarea id={`${formId}-textarea`} value="" onChange={() => {}} />
        </Field>
      </div>
    </div>
  );
}

function AlertCatalog() {
  return (
    <div className="flex flex-col gap-md">
      {ALL_TONES.map((tone) => (
        <div key={tone} className="flex flex-col gap-xs">
          <Alert tone={tone}>Alert flat/md — tono {tone}</Alert>
          <Alert tone={tone} size="sm">
            Alert flat/sm — tono {tone}
          </Alert>
          <Alert tone={tone} emphasis="accent" title="Aviso:">
            Alert accent — tono {tone}
          </Alert>
        </div>
      ))}
    </div>
  );
}

function CardCatalog() {
  return (
    <div className="flex flex-col gap-lg">
      <div className="grid grid-cols-1 gap-lg md:grid-cols-2">
        <Card radius="sm" padding="lg" gap="md">
          Card radius=&quot;sm&quot; (default) — formularios, detalles, resúmenes
        </Card>
        <Card radius="md" elevated interactive>
          Card radius=&quot;md&quot; elevated interactive — tarjetas clickeables de listado
        </Card>
      </div>
      <Panel title="Panel de ejemplo" titleId="panel-catalogo-heading" action={<Button size="sm">Acción</Button>}>
        <p className="m-0 font-body text-sm text-muted">Contenedor con encabezado accesible (aria-labelledby).</p>
      </Panel>
    </div>
  );
}

function TableCatalog() {
  return (
    <Table caption="Tabla de ejemplo del catálogo" minWidth="md">
      <thead>
        <Tr>
          <Th scope="col" align="left">
            Mes
          </Th>
          <Th scope="col" align="right" numeric>
            Facturado
          </Th>
        </Tr>
      </thead>
      <tbody>
        <Tr divided>
          <Th scope="row" align="left">
            Enero
          </Th>
          <Td align="right" numeric>
            $100.000
          </Td>
        </Tr>
      </tbody>
    </Table>
  );
}

function PillEmptyStateCatalog() {
  return (
    <div className="flex flex-col gap-lg">
      <div className="flex flex-wrap items-center gap-xs">
        <Pill>CUD Vigente</Pill>
        <Pill emphasis="strong">+2 más</Pill>
      </div>
      <EmptyState message="No hay elementos cargados todavía." action={<Button variant="secondary">Crear el primero</Button>} />
    </div>
  );
}

function ButtonCatalog() {
  return (
    <div className="flex flex-col gap-md">
      <div className="flex flex-wrap items-center gap-md">
        <Button variant="primary">Primary md</Button>
        <Button variant="secondary">Secondary md</Button>
        <Button variant="secondary-accent">Secondary-accent md</Button>
        <Button variant="success">Success md</Button>
        <Button variant="danger">Danger md</Button>
      </div>
      <div className="flex flex-wrap items-center gap-md">
        <Button variant="secondary-accent" size="sm">
          Editar
        </Button>
        <Button variant="secondary-accent" size="xs">
          ↑
        </Button>
        <Button variant="secondary-accent" size="xs" disabled>
          ↓ (disabled)
        </Button>
      </div>
    </div>
  );
}
