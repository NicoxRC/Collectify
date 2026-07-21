import { NavLink } from 'react-router-dom';

// More items (Clientes, Préstamos, WhatsApp...) are added as each feature
// phase lands — see docs/phasesClient.
const NAV_ITEMS = [{ label: 'Dashboard', to: '/' }] as const;

export function Sidebar() {
  return (
    <aside className="flex w-56 flex-col border-r border-gray-200 bg-white">
      <div className="px-4 py-5 text-lg font-semibold text-gray-900">
        Collectify
      </div>
      <nav className="flex flex-1 flex-col gap-1 px-2">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end
            className={({ isActive }) =>
              [
                'rounded-md px-3 py-2 text-sm font-medium',
                isActive
                  ? 'bg-gray-900 text-white'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
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
