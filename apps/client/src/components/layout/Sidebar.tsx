import { NavLink } from 'react-router-dom';

import { useAuth } from '@/features/auth/useAuth';
import { getInitials } from '@/lib/format';

import type { UserRole } from '@/features/auth/authApi';

interface NavItem {
  label: string;
  to: string;
  // Omitted = visible to every role.
  roles?: UserRole[];
}

// Full nav per the Figma "Design System" file (sidebar in frame 40:3) has 8
// items: Dashboard, Clientes, Préstamos, Mensajes, Plantillas, Reportes,
// Gestionar usuarios, Configuración. Only items with a real route are
// listed here — uncomment/add each as its phase ships (see
// docs/phasesClient). Gestionar usuarios and Configuración are admin-only
// per docs/PROJECT_ROADMAP.md Phase 8.
const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', to: '/' },
  { label: 'Clientes', to: '/clientes' },
  { label: 'Préstamos', to: '/prestamos' },
  { label: 'Mensajes', to: '/mensajes' },
  { label: 'Plantillas', to: '/plantillas', roles: ['admin'] },
  {
    label: 'Conceptos de interés',
    to: '/conceptos-de-interes',
    roles: ['admin'],
  },
];

export function Sidebar() {
  const { user, logout } = useAuth();

  const visibleItems = NAV_ITEMS.filter(
    (item) => !item.roles || (user && item.roles.includes(user.role)),
  );

  return (
    <aside className="flex w-[220px] shrink-0 flex-col border-r border-border bg-surface">
      <div className="flex items-center gap-2.5 p-5">
        <div className="flex size-7 shrink-0 items-center justify-center rounded bg-white">
          <span className="text-[13px] font-semibold text-background">C</span>
        </div>
        <span className="text-[15px] font-semibold text-white">Collectify</span>
      </div>

      <div className="border-t border-border" />

      <div className="px-5 pb-1 pt-2">
        <span className="text-[8px] font-medium tracking-[0.64px] text-mid">
          MENÚ
        </span>
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 px-2">
        {visibleItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            // `end` restricts the active match to an exact path — needed
            // on "/" (Dashboard) only, since without it every route would
            // match (every path starts with "/"). Every other item should
            // stay highlighted on its nested detail routes too (e.g.
            // /clientes/:id, /prestamos/:id), so the sidebar keeps
            // answering "where am I" one level deep, not just on the
            // exact list page.
            end={item.to === '/'}
            className={({ isActive }) =>
              [
                'flex items-center gap-2.5 rounded px-4 py-2.5 text-small',
                isActive
                  ? 'bg-border font-medium text-white'
                  : 'font-normal text-muted hover:text-white',
              ].join(' ')
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-border" />

      {/* User block — the real design puts this in the sidebar footer, not
          a top header bar (there isn't one, see AppLayout.tsx). Links to
          /perfil ("Mi perfil"), which now also holds "Cambiar
          contraseña" — the client shared that design after an initial
          version of this put a key icon here instead. Shows the real
          name/initials now that GET /auth/me exposes fullName (see
          apps/client/docs/DESIGN_TOKENS.md "Known design/backend gaps") —
          previously fell back to email initials. */}
      <div className="flex items-center gap-2 px-3.5 py-3">
        <NavLink
          to="/perfil"
          className={({ isActive }) =>
            `flex flex-1 items-center gap-2 overflow-hidden rounded ${isActive ? 'text-white' : ''}`
          }
        >
          <div className="flex size-[26px] shrink-0 items-center justify-center rounded-full bg-border">
            <span className="text-[9px] font-medium text-muted">
              {user ? getInitials(user.fullName) : ''}
            </span>
          </div>
          <div className="flex flex-1 flex-col gap-0.5 overflow-hidden">
            <span className="truncate text-label font-medium text-white">
              {user?.fullName}
            </span>
            <span className="text-[8px] tracking-[0.32px] text-muted">
              {user?.role.toUpperCase()}
            </span>
          </div>
        </NavLink>
        <button
          type="button"
          onClick={logout}
          className="shrink-0 text-meta text-subtle hover:text-muted"
        >
          Salir
        </button>
      </div>
    </aside>
  );
}
