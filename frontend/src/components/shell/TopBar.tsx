import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  PanelLeft,
  Search,
  Bell,
  Settings,
  Sun,
  Moon,
  UserRound,
  Circle,
} from 'lucide-react';
import { toast } from 'sonner';
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
import { envLabel } from '@/lib/env';

interface TopBarProps {
  onToggleSidebar: () => void;
}

const LATER_SLICE = 'This lands in a later build slice.';

export function TopBar({ onToggleSidebar }: TopBarProps) {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const [query, setQuery] = useState('');
  const env = envLabel();

  function onSearch(e: FormEvent) {
    e.preventDefault();
    const q = query.trim();
    // Global search is a shortcut into the detections filter (spec).
    navigate(q ? `/detections?q=${encodeURIComponent(q)}` : '/detections');
  }

  return (
    <header className="flex h-14 items-center gap-3 border-b border-border bg-surface px-3">
      <Button
        variant="ghost"
        size="icon"
        aria-label="Toggle navigation"
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
        {/* Quarantine bell — presentational in slice 1; wired to the poll later. */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Quarantine alerts">
              <Bell />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-72">
            <DropdownMenuLabel>Recent quarantine arrivals</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <div className="px-2 py-6 text-center text-sm text-muted-foreground">
              No new quarantine arrivals.
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Settings menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Settings">
              <Settings />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Settings</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => toggleTheme()}>
              {theme === 'dark' ? <Sun /> : <Moon />}
              Switch to {theme === 'dark' ? 'light' : 'dark'} theme
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => toast.info('Preferences', { description: LATER_SLICE })}>
              <Settings />
              Preferences
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Theme toggle — fully functional in slice 1 */}
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

        {/* User identity chip — placeholder until the auth slice */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Account">
              <UserRound />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col">
                <span className="text-sm text-foreground">Not signed in</span>
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Circle className="size-2 fill-muted-foreground text-muted-foreground" />
                  Auth arrives in a later slice
                </span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => toast.info('Sign out', { description: LATER_SLICE })}
            >
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
