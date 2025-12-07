import { Role } from '../enums/role.enum';

const ROLE_RANK: Record<Role, number> = {
  [Role.SUPERADMIN]: 4,
  [Role.OPERATOR]: 1,
  [Role.SUPERVISOR]: 2,
  [Role.ADMIN]: 3,
};

export const normalizeRole = (role?: string | Role | null): Role | undefined => {
  if (!role) return undefined;
  const normalized = String(role).toUpperCase() as Role;
  return normalized in ROLE_RANK ? normalized : undefined;
};

export const resolveHighestRole = (
  roles: Array<string | Role | null | undefined>,
): Role | undefined => {
  let highest: Role | undefined;
  let highestRank = -1;
  for (const candidate of roles) {
    const normalized = normalizeRole(candidate);
    if (!normalized) continue;
    const rank = ROLE_RANK[normalized];
    if (rank > highestRank) {
      highestRank = rank;
      highest = normalized;
    }
  }
  return highest;
};

export const uniqueNormalizedRoles = (
  roles: Array<string | Role | null | undefined>,
): Role[] => {
  const seen = new Set<Role>();
  for (const candidate of roles) {
    const normalized = normalizeRole(candidate);
    if (normalized) {
      seen.add(normalized);
    }
  }
  return Array.from(seen);
};

export const hasAtLeastRole = (
  roles: Array<string | Role | null | undefined>,
  required: Role,
): boolean => {
  const highest = resolveHighestRole(roles);
  if (!highest) return false;
  return ROLE_RANK[highest] >= ROLE_RANK[required];
};

export const sortRolesByRankDesc = (roles: Role[]): Role[] => {
  return [...roles].sort((a, b) => ROLE_RANK[b] - ROLE_RANK[a]);
};

export const getRoleRank = (role: Role): number => ROLE_RANK[role];
