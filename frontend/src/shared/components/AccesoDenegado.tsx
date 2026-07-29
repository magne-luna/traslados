import { Section } from '../../design-system/components';
import { EmptyState } from '../../design-system/feedback';

// design.md D6 (route-guard): autenticado + sin permiso ⇒ pantalla explícita dentro del
// AppShell, no un <Navigate>. Un redirect silencioso es indistinguible de un bug para quien lo
// sufre y puede disparar bucles si el destino tampoco es accesible — y la navegación ya oculta
// estos módulos, así que llegar acá implica una URL escrita a mano o un link viejo (el caso en
// que el mensaje más importa). Reutiliza Section/EmptyState del design system — sin markup a
// mano, sin `style={{}}`.
interface AccesoDenegadoProps {
  mensaje?: string;
}

const MENSAJE_DEFECTO = 'Tu cuenta no tiene permiso para acceder a esta sección. Pedile acceso a la administradora.';

export function AccesoDenegado({ mensaje = MENSAJE_DEFECTO }: AccesoDenegadoProps) {
  return (
    <div className="py-xxl px-xl">
      <Section label="—" title="Acceso denegado">
        <EmptyState message={mensaje} />
      </Section>
    </div>
  );
}
