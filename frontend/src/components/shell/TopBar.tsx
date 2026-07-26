import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Menu, PanelLeft, Search, Bell, Sun, Moon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useTheme } from '@/hooks/useTheme';
import { useDetectionsFeed } from '@/feed/DetectionsFeedProvider';
import { envLabel } from '@/lib/env';
import { formatRelative } from '@/lib/format';

interface TopBarProps {
  onToggleSidebar: () => void;
  onOpenMobileNav: () => void;
}

export function TopBar({ onToggleSidebar, onOpenMobileNav }: TopBarProps) {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const { quarantineUnread, acknowledgeQuarantine } = useDetectionsFeed();
  const [query, setQuery] = useState('');
  const env = envLabel();
  const unreadCount = quarantineUnread.length;

  /**
   * The acknowledgement gesture (RB-3): go to the quarantine view and clear the
   * mark, in that order. Only this action advances the mark — merely opening the
   * bell, or a poll landing, must not, or the count stops meaning anything.
   */
  function onViewQuarantine() {
    navigate('/detections?verdict=quarantine');
    acknowledgeQuarantine();
  }

  function onSearch(e: FormEvent) {
    e.preventDefault();
    const q = query.trim();
    navigate(q ? `/detections?q=${encodeURIComponent(q)}` : '/detections');
  }

  return (
    <header className="flex h-14 items-center gap-2 border-b border-border bg-surface px-3">
      {/* Mobile: hamburger */}
      <Button
        variant="ghost"
        size="icon"
        aria-label="Open navigation"
        className="md:hidden"
        onClick={onOpenMobileNav}
      >
        <Menu />
      </Button>
      {/* Desktop: collapse rail */}
      <Button
        variant="ghost"
        size="icon"
        aria-label="Collapse navigation"
        className="hidden md:inline-flex"
        onClick={onToggleSidebar}
      >
        <PanelLeft />
      </Button>

      <Badge variant={env === 'PROD' ? 'quarantine' : 'default'}>{env}</Badge>

      <form onSubmit={onSearch} className="relative ml-1 max-w-md flex-1">
        <Search
          className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search senders, subjects, domains…"
          aria-label="Global search"
          className="pl-8"
        />
      </form>

      <div className="ml-auto flex items-center gap-1">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="relative"
              aria-label={
                unreadCount === 0
                  ? 'Quarantine alerts — none unacknowledged in the current feed window'
                  : `Quarantine alerts — ${unreadCount} unacknowledged in the current feed window`
              }
            >
              <Bell />
              {unreadCount > 0 && (
                <span
                  className="absolute -right-0.5 -top-0.5 flex min-w-4 items-center justify-center rounded-full bg-verdict-quarantine px-1 font-mono text-[10px] font-semibold leading-4 text-background"
                  aria-hidden
                >
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <DropdownMenuLabel>Unacknowledged quarantine</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {unreadCount === 0 ? (
              <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                No unacknowledged quarantine arrivals.
              </div>
            ) : (
              quarantineUnread.slice(0, 5).map((row) => (
                <DropdownMenuItem
                  key={row.id}
                  onSelect={() => navigate(`/detections/${row.id}`)}
                  className="flex-col items-start gap-0.5"
                >
                  <span className="w-full truncate text-sm">
                    {row.subject || '(no subject)'}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatRelative(row.created_at)}
                  </span>
                </DropdownMenuItem>
              ))
            )}
            <DropdownMenuSeparator />
            {unreadCount > 0 && (
              <DropdownMenuItem onSelect={onViewQuarantine}>
                View all quarantine &amp; mark seen
              </DropdownMenuItem>
            )}
            {/* The count can only ever describe the rows the feed currently
                holds — say so rather than implying full coverage. */}
            <p className="px-2 py-1.5 text-xs text-muted-foreground">
              Counts unacknowledged quarantine in the current feed window, not all
              time.
            </p>
          </DropdownMenuContent>
        </DropdownMenu>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
              onClick={toggleTheme}
            >
              {theme === 'dark' ? <Sun /> : <Moon />}
            </Button>
          </TooltipTrigger>
          <TooltipContent>Toggle theme</TooltipContent>
        </Tooltip>
      </div>
    </header>
  );
}
