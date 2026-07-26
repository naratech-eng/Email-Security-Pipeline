import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { MobileNav } from './MobileNav';
import { TopBar } from './TopBar';
import { DetectionsFeedProvider } from '@/feed/DetectionsFeedProvider';

/**
 * Persistent analyst frame. On md+ a collapsible sidebar rail; on small screens
 * the nav becomes a hamburger-triggered off-canvas drawer.
 *
 * The feed provider wraps the whole frame — not just the outlet — because the
 * top-bar quarantine bell and the nav arrival badge are siblings of the routed
 * page and must read the same poll snapshot the Detections table does.
 */
export function AppShell() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <DetectionsFeedProvider>
      <div className="flex h-dvh w-full overflow-hidden bg-background text-foreground">
        <Sidebar collapsed={collapsed} />
        <MobileNav open={mobileOpen} onOpenChange={setMobileOpen} />

        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar
            onToggleSidebar={() => setCollapsed((c) => !c)}
            onOpenMobileNav={() => setMobileOpen(true)}
          />
          <main className="flex-1 overflow-y-auto p-4 sm:p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </DetectionsFeedProvider>
  );
}
