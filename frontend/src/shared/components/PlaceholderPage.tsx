import { Section } from '../../design-system/components';

interface PlaceholderPageProps {
  moduleName: string;
}

// Decisión 5 de design.md: un único placeholder parametrizado por módulo en vez de ocho
// componentes casi idénticos. Cada FE-N reemplaza el `element` de su ruta en router.tsx por
// la pantalla real; este componente reutiliza Section/tokens (vía clases Tailwind) del design
// system, no recrea nada.
export function PlaceholderPage({ moduleName }: PlaceholderPageProps) {
  return (
    <div className="py-xxl px-xl">
      <Section label="—" title={moduleName}>
        <p className="font-body text-sm text-muted">Próximamente.</p>
      </Section>
    </div>
  );
}
