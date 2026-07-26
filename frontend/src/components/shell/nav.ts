import type { LucideIcon } from 'lucide-react';
import { LayoutDashboard, ShieldAlert, ScanSearch, Users } from 'lucide-react';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
}

/**
 * Primary navigation. Slice 1 renders these statically; role-based visibility
 * (via usePermissions) lands in slice 2.
 */
export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/detections', label: 'Detections', icon: ShieldAlert },
  { to: '/analyze', label: 'Analyze', icon: ScanSearch },
  { to: '/users', label: 'Users', icon: Users },
];
