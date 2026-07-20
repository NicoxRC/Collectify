import { createBrowserRouter } from 'react-router-dom';

import { AppLayout } from '@/components/layout/AppLayout';
import { HealthCheckPage } from '@/features/health/HealthCheckPage';

// Grows with each phase: Phase 2 adds /login and route protection,
// Phase 3+ add one route block per feature. See docs/phasesClient.
export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      {
        index: true,
        element: <HealthCheckPage />,
      },
    ],
  },
]);
