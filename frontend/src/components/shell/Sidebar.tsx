import { NavLink } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { NAV_ITEMS } from './nav';

interface SidebarProps {
  collapsed: boolean;
}

export function Sidebar({ collapsed }: SidebarProps) {
  return (
    <aside
      className={cn(
        'flex h-full shrink-0 flex-col border-r border-border bg-surface transition-[width] duration-200',
        collapsed ? 'w-16' : 'w-60',
      )}
    >
      <div
        className={cn(
          'flex h-14 items-center gap-2 border-b border-border px-4',
          collapsed && 'justify-center px-0',
        )}
      >
        <ShieldCheck className="size-6 text-primary" aria-hidden />
        {!collapsed && (
          <span className="font-mono text-sm font-semibold tracking-tight">
            ESP<span className="text-primary"> / SOC</span>
          </span>
        )}
      </div>

      <nav className="flex flex-1 flex-col gap-1 p-2" aria-label="Primary">
        {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => {
          const link = (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  'text-muted-foreground hover:bg-surface-2 hover:text-foreground',
                  isActive &&
                    'bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary',
                  collapsed && 'justify-center px-0',
                )
              }
            >
              <Icon className="size-5 shrink-0" aria-hidden />
              {!collapsed && <span>{label}</span>}
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
    </aside>
  );
}
