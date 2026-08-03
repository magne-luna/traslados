import { NavIcon } from '../design-system/components';
import type { Usuario } from '../shared/types/usuario';

interface SidebarIdentityProps {
  usuario: Usuario;
  collapsed: boolean;
  onLogout: () => void;
}

function iniciales({ nombre, apellido }: Pick<Usuario, 'nombre' | 'apellido'>): string {
  return `${nombre.charAt(0)}${apellido.charAt(0)}`.toUpperCase();
}

function primeraPalabra({ nombre, apellido }: Pick<Usuario, 'nombre' | 'apellido'>): string {
  return `${nombre} ${apellido}`.trim().split(/\s+/)[0] ?? '';
}

export function SidebarIdentity({
  usuario,
  collapsed,
  onLogout,
}: SidebarIdentityProps) {
  return (
    <div
      className={`mt-auto flex flex-col gap-sm border-t border-sidebar-border pt-md ${
        collapsed ? 'items-center' : ''
      }`}
    >
      {!collapsed && (
        <div className="rounded-xl border border-sidebar-border bg-white px-md py-sm transition-colors hover:bg-surface-soft">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-soft text-[11px] font-semibold text-sidebar-text">
              {iniciales(usuario)}
            </span>

            <div className="min-w-0 flex-1">
              <p className="truncate font-body text-[14px] font-semibold text-sidebar-text">
                {primeraPalabra(usuario)}
              </p>

              <p className=" font-body text-[10px] text-muted">
                {usuario.email}
              </p>
            </div>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={onLogout}
        aria-label="Cerrar sesión"
        title={collapsed ? 'Cerrar sesión' : undefined}
        className={`flex items-center cursor-pointer gap-sm rounded-lg px-md py-sm font-body text-[13px] font-medium text-sidebar-text transition-colors hover:bg-surface-soft ${
          collapsed ? 'justify-center' : 'justify-start'
        }`}
      >
        <NavIcon>
          <path
            d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <polyline points="16 17 21 12 16 7" />
          <line x1={21} y1={12} x2={9} y2={12} />
        </NavIcon>

        {!collapsed && 'Cerrar sesión'}
      </button>
    </div>
  );
}