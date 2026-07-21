import { useAuth } from '@/features/auth/useAuth';

export function Header() {
  const { user, logout } = useAuth();

  return (
    <header className="flex h-14 items-center justify-between border-b border-border bg-background px-6">
      <span className="text-small font-medium text-muted">
        Panel administrativo
      </span>

      <div className="flex items-center gap-3 text-small">
        {user && <span className="text-muted">{user.email}</span>}
        <button
          type="button"
          onClick={logout}
          className="font-medium text-subtle hover:text-white"
        >
          Cerrar sesión
        </button>
      </div>
    </header>
  );
}
