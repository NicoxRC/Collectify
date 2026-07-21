import { NavLink } from 'react-router-dom';

import { useAuth } from '@/features/auth/useAuth';

import type { UserRole } from '@/features/auth/authApi';

interface NavItem {
  label: string;
  to: string;
  // Omitted = visible to every role. Admin-only items (message templates,
  // user management...) land here as each phase adds them — set
  // roles: ['admin'] and pair with RequireRole on the actual route.
  roles?: UserRole[];
}

// More items (Clientes, Préstamos, WhatsApp...) are added as each feature
// phase lands — see docs/phasesClient.
const NAV_ITEMS: NavItem[] = [{ label: 'Dashboard', to: '/' }];

export function Sidebar() {
  const { user } = useAuth();

  const visibleItems = NAV_ITEMS.filter(
    (item) => !item.roles || (user && item.roles.includes(user.role)),
  );

  return (
    <aside className="flex w-56 flex-col border-r border-border bg-background">
      <div className="flex items-center gap-2.5 px-4 py-5">
        <div className="flex size-7 shrink-0 items-center justify-center rounded bg-white">
          <span className="text-[14px] font-semibold text-background">C</span>
        </div>
        <span className="text-body text-white">Collectify</span>
      </div>
      <nav className="flex flex-1 flex-col gap-1 px-2">
        {visibleItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end
            className={({ isActive }) =>
              [
                'rounded px-3 py-2 text-small font-medium',
                isActive
                  ? 'bg-white text-background'
                  : 'text-muted hover:bg-surface hover:text-white',
              ].join(' ')
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
