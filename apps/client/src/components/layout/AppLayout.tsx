import { Outlet } from 'react-router-dom';

import { Sidebar } from '@/components/layout/Sidebar';

export function AppLayout() {
  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-y-auto px-10 pb-10 pt-8">
        <Outlet />
      </main>
    </div>
  );
}
