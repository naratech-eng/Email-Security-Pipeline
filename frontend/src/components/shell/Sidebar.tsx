import { useState } from 'react';
import { NavLink } from 'react-router';
import { ShieldCheck, Settings, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { UserAvatar } from '@/components/user/UserAvatar';
import { SettingsDialog } from '@/components/settings/SettingsDialog';
import { useAuth } from '@/auth/AuthProvider';
import { usePermissions } from '@/auth/usePermissions';
import { useDetectionsFeed } from '@/feed/DetectionsFeedProvider';
import { NAV_ITEMS } from './nav';

const ROLE_LABELS: Record<string, string> = {
  'soc-analyst': 'SOC Analyst',
  'security-operator': 'Security Operator',
  'security-analyst': 'Security Analyst',
};

interface SidebarContentProps {
  collapsed?: boolean;
  onNavigate?: () => void;
}

/** Sidebar body shared by the desktop rail and the mobile drawer. */
export function SidebarContent({ collapsed = false, onNavigate }: SidebarContentProps) {
  const { user, signOut } = useAuth();
  const perms = usePermissions();
  const { arrivals } = useDetectionsFeed();
  const [settingsOpen, setSettingsOpen] = useState(false);

  const visibleNav = NAV_ITEMS.filter((item) => {
    if (item.to === '/analyze') return perms.canAnalyze;
    if (item.to === '/users') return perms.canManageUsers;
    return true;
  });

  const roleLabel = user?.role ? ROLE_LABELS[user.role] ?? user.role : 'Analyst';

  return (
    <div className="flex h-full flex-col bg-surface">
      {/* Brand */}
      <div
        className={cn(
          'flex h-14 items-center gap-2 border-b border-border px-4',
          collapsed && 'justify-center px-0',
        )}
      >
        <ShieldCheck className="size-6 shrink-0 text-primary" aria-hidden />
        {!collapsed && (
          <span className="truncate text-sm font-semibold tracking-tight">
            Email Security Pipeline
          </span>
        )}
      </div>

      {/* Nav */}
      <nav className="flex flex-1 flex-col gap-1 p-2" aria-label="Primary">
        {visibleNav.map(({ to, label, icon: Icon, end }) => {
          const link = (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={onNavigate}
              className={({ isActive }) =>
                cn(
                  'relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  'text-muted-foreground hover:bg-surface-2 hover:text-foreground',
                  isActive &&
                    'bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary',
                  // left accent bar on the active item
                  isActive &&
                    !collapsed &&
                    'before:absolute before:inset-y-1.5 before:left-0 before:w-0.5 before:rounded-full before:bg-primary',
                  collapsed && 'justify-center px-0',
                )
              }
            >
              <Icon className="size-5 shrink-0" aria-hidden />
              {!collapsed && <span>{label}</span>}
              {/* Live arrivals on the feed item — the same poll snapshot the
                  Detections table renders, so the two can't disagree. */}
              {to === '/detections' && arrivals.length > 0 && (
                <span
                  className={cn(
                    'rounded-full bg-primary/20 px-1.5 font-mono text-[10px] font-semibold leading-4 text-primary',
                    collapsed ? 'absolute right-1 top-1' : 'ml-auto',
                  )}
                  aria-label={`${arrivals.length} new since your last look`}
                >
                  {arrivals.length > 9 ? '9+' : arrivals.length}
                </span>
              )}
            </NavLink>
          );
          return collapsed ? (
            <Tooltip key={to}>
              <TooltipTrigger asChild>{link}</TooltipTrigger>
              <TooltipContent side="right">{label}</TooltipContent>
            </Tooltip>
          ) : (
            link
          );
        })}
      </nav>

      {/* Footer — profile + settings + sign out */}
      <div className="border-t border-border p-2">
        <div
          className={cn(
            'flex items-center gap-3',
            collapsed
              ? 'justify-center'
              : 'rounded-lg border border-border bg-surface-2 px-3 py-2.5',
          )}
        >
          <UserAvatar user={user} className="size-9 shrink-0" />
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">
                {user?.email ?? 'Account'}
              </p>
              <p className="truncate text-xs text-muted-foreground">{roleLabel}</p>
            </div>
          )}
        </div>

        <div className={cn('mt-1 flex gap-1', collapsed && 'flex-col items-center')}>
          <Button
            collapsed={collapsed}
            label="Settings"
            icon={Settings}
            onClick={() => setSettingsOpen(true)}
          />
          <Button
            collapsed={collapsed}
            label="Sign out"
            icon={LogOut}
            onClick={() => void signOut()}
          />
        </div>
      </div>

      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  );
}

// Small footer action button (label hidden when collapsed).
function Button({
  collapsed,
  label,
  icon: Icon,
  onClick,
}: {
  collapsed: boolean;
  label: string;
  icon: typeof Settings;
  onClick: () => void;
}) {
  const btn = (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cn(
        'flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-xs font-medium',
        'text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground',
        collapsed && 'flex-none',
      )}
    >
      <Icon className="size-4 shrink-0" aria-hidden />
      {!collapsed && <span>{label}</span>}
    </button>
  );
  return collapsed ? (
    <Tooltip>
      <TooltipTrigger asChild>{btn}</TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  ) : (
    btn
  );
}

/** Desktop rail. */
export function Sidebar({ collapsed }: { collapsed: boolean }) {
  return (
    <aside
      className={cn(
        'hidden shrink-0 border-r border-border transition-[width] duration-200 md:block',
        collapsed ? 'w-16' : 'w-60',
      )}
    >
      <SidebarContent collapsed={collapsed} />
    </aside>
  );
}
