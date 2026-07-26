import { useMemo } from 'react';
import { useAuth } from './AuthProvider';

/** Cognito group names (from the JWT `cognito:groups` claim). */
export const GROUP = {
  socAnalyst: 'soc-analyst',
  securityOperator: 'security-operator',
  securityAnalyst: 'security-analyst',
} as const;

export type Role = 'soc-analyst' | 'security-operator' | 'security-analyst' | null;

export interface Permissions {
  role: Role;
  isPending: boolean;
  canViewOverview: boolean;
  canViewDetections: boolean;
  canAnalyze: boolean;
  canReviewDetections: boolean;
  canManageUsers: boolean;
  canExportCsv: boolean;
}

/**
 * Pure derivation of capabilities from Cognito groups. The single source of
 * truth for RBAC — route guards, nav, and action controls all read this, so the
 * whole matrix is auditable in one place. Highest privilege wins.
 */
export function derivePermissions(groups: string[]): Permissions {
  const has = (g: string) => groups.includes(g);
  const isAnalyst = has(GROUP.securityAnalyst);
  const isOperator = has(GROUP.securityOperator);
  const isSoc = has(GROUP.socAnalyst);
  const known = isAnalyst || isOperator || isSoc;

  const role: Role = isAnalyst
    ? 'security-analyst'
    : isOperator
      ? 'security-operator'
      : isSoc
        ? 'soc-analyst'
        : null;

  return {
    role,
    isPending: groups.length === 0,
    canViewOverview: known,
    canViewDetections: known,
    canAnalyze: isOperator || isAnalyst,
    canReviewDetections: isAnalyst,
    canManageUsers: isAnalyst,
    canExportCsv: isAnalyst,
  };
}

export function usePermissions(): Permissions {
  const { user } = useAuth();
  return useMemo(() => derivePermissions(user?.groups ?? []), [user?.groups]);
}
