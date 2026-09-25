import { Outlet } from 'react-router-dom';

import { NavBar } from './NavBar';

export function AppShell() {
  return (
    <div className="flex min-h-screen flex-col">
      <div className="print:hidden">
        <NavBar />
      </div>
      <div className="flex-1">
        <Outlet />
      </div>
    </div>
  );
}
