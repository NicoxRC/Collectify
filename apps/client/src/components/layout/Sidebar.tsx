import { NavLink } from 'react-router-dom';

import { useAuth } from '@/features/auth/useAuth';

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
            end
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

      {/* User + logout — the real design puts this in the sidebar footer,
          not in a top header bar (there isn't one, see AppLayout.tsx).
          Shows email, not a full name: /auth/me only returns
          id/email/role (see apps/api AuthenticatedUser interface) even
          though the User entity has fullName — nothing to display there
          without a backend change. */}
      <div className="flex items-center gap-2 px-3.5 py-3">
        <div className="flex size-[26px] shrink-0 items-center justify-center rounded-full bg-border">
          <span className="text-[9px] font-medium text-muted">
            {user?.email.slice(0, 2).toUpperCase()}
          </span>
        </div>
        <div className="flex flex-1 flex-col gap-0.5 overflow-hidden">
          <span className="truncate text-label font-medium text-white">
            {user?.email}
          </span>
          <span className="text-[8px] tracking-[0.32px] text-muted">
            {user?.role.toUpperCase()}
          </span>
        </div>
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
