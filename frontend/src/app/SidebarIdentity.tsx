import { Chip, NavIcon } from '../design-system/components';
import type { Usuario } from '../shared/types/usuario';

// Bloque de identidad + cierre de sesión (design.md D10, tasks.md 8.4, app-shell spec
// "Identidad de la cuenta y cierre de sesión en el shell") — extraído de AppShell.tsx en el
// REFACTOR de tasks.md 8.5. El botón SIEMPRE es un <button> real con aria-label propio (no
// depende del texto visible), así sigue siendo accesible con el sidebar colapsado (frontend-ui-
// design: nunca depender solo de un ícono sin etiqueta).
interface SidebarIdentityProps {
  usuario: Usuario;
  collapsed: boolean;
  onLogout: () => void;
}

export function SidebarIdentity({ usuario, collapsed, onLogout }: SidebarIdentityProps) {
  return (
    <div className={`mt-auto flex flex-col gap-sm border-t border-sidebar-border pt-md ${collapsed ? 'items-center' : ''}`}>
      {!collapsed && (
        <div className="flex flex-col gap-xs px-md pb-xs">
          <span className="truncate font-body text-[13px] font-semibold text-sidebar-text">
            {usuario.nombre} {usuario.apellido}
          </span>
          <span className="truncate font-body text-[11px] text-muted">{usuario.email}</span>
          <Chip kind={usuario.rol === 'admin' ? 'info' : 'secondary'}>{usuario.rol}</Chip>
        </div>
      )}

      <button
        type="button"
        onClick={onLogout}
        aria-label="Cerrar sesión"
        title={collapsed ? 'Cerrar sesión' : undefined}
        className={`flex items-center gap-sm rounded-sm px-md py-sm font-body text-[13px] font-semibold text-sidebar-text hover:bg-surface-soft ${
          collapsed ? 'justify-center' : 'justify-start'
        }`}
      >
        <NavIcon>
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" strokeLinecap="round" strokeLinejoin="round" />
          <polyline points="16 17 21 12 16 7" />
          <line x1={21} y1={12} x2={9} y2={12} />
        </NavIcon>
        {!collapsed && 'Cerrar sesión'}
      </button>
    </div>
  );
}
