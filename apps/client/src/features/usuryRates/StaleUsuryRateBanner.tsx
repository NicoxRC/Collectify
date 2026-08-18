import { Link } from 'react-router-dom';

import { useCurrentUsuryRate } from '@/features/usuryRates/useUsuryRates';

// Persistent, hard-to-miss banner shown wherever an admin would otherwise
// start creating a loan — confirmed with the client (see
// docs/phases/PHASE_15_USURY_RATE.md "Stale-rate alert") this is NOT a
// dismiss-once-and-forget banner: it keeps showing every session until a
// current-month rate is entered, since the SFC's publication date moves
// around and there's no fixed day to remind on instead. GET
// /usury-rates/current is admin-only server-side, so only render this
// where the caller already knows the current user is an admin.
export function StaleUsuryRateBanner() {
  const { data: current, isPending } = useCurrentUsuryRate();

  // GET /usury-rates/current returns null when NO rate has ever been
  // entered (not just when the latest one is from a prior month) — that
  // case must show this banner too. Bug fixed 2026-08-18: the original
  // `!current?.isStale` check treated a null `current` (nothing entered
  // yet at all) as "not stale" and silently suppressed the banner in
  // exactly the situation it exists to warn about.
  if (isPending) return null;
  if (current?.isStale === false) return null;

  return (
    <div
      role="alert"
      className="flex items-center justify-between gap-3 rounded border border-amber-400/40 bg-amber-400/10 px-4 py-2.5 text-small text-amber-200"
    >
      <span>
        No has agregado la tasa de usura de este mes — los préstamos nuevos no
        podrán validarse contra el techo vigente.
      </span>
      <Link
        to="/tasa-de-usura"
        className="shrink-0 font-semibold text-amber-100 underline hover:text-white"
      >
        Registrar tasa
      </Link>
    </div>
  );
}
