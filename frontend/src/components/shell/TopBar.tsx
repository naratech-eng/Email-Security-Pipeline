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
  onOpenMobileNav: () => void;
}

export function TopBar({ onToggleSidebar, onOpenMobileNav }: TopBarProps) {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const [query, setQuery] = useState('');
  const env = envLabel();

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
