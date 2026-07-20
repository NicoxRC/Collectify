import { useHealth } from '@/features/health/useHealth';

// Temporary Phase 1 page — proves the client can reach the API through
// apiClient end to end. Replaced once Phase 2 lands a real post-login
// landing page (and eventually the Phase 7 dashboard).
export function HealthCheckPage() {
  const { data, isLoading, isError, error } = useHealth();

  return (
    <div className="max-w-md rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <h1 className="text-lg font-semibold text-gray-900">
        Conexión con la API
      </h1>
      <p className="mt-1 text-sm text-gray-500">
        Página temporal de la Fase 1 — se elimina en fases posteriores.
      </p>

      <div className="mt-4 text-sm">
        {isLoading && <span className="text-gray-500">Consultando…</span>}
        {isError && (
          <span className="text-red-600">
            Error: {error instanceof Error ? error.message : 'desconocido'}
          </span>
        )}
        {data && (
          <span className="font-medium text-green-600">
            API responde: {data.status}
          </span>
        )}
      </div>
    </div>
  );
}
