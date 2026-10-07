/**
 * Provider-account mutation policy (opt-in, backward compatible).
 *
 * Default (env flag unset): behaviour is unchanged for existing deployments.
 * With RESTRICT_PROVIDER_ACCOUNT_MUTATIONS=true: only ADMIN / SUPERADMIN
 * (the OWNER-equivalent roles in this codebase) may connect, reconnect,
 * enable/disable or delete provider accounts. Unknown/missing role is denied
 * (fail closed).
 */
export type OrgRole = 'SUPERADMIN' | 'ADMIN' | 'USER';

export function canMutateProviderAccounts(
  role: string | undefined | null,
  env: Record<string, string | undefined> = process.env
): boolean {
  if (env.RESTRICT_PROVIDER_ACCOUNT_MUTATIONS !== 'true') {
    return true;
  }
  return role === 'ADMIN' || role === 'SUPERADMIN';
}
