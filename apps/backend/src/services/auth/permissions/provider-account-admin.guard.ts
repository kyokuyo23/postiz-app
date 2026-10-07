import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { HttpForbiddenException } from '@gitroom/nestjs-libraries/services/exception.filter';
import { canMutateProviderAccounts } from '@gitroom/nestjs-libraries/security/role-policy';

/**
 * Restricts provider-account mutations (connect, enable/disable, delete) to
 * ADMIN/SUPERADMIN when RESTRICT_PROVIDER_ACCOUNT_MUTATIONS=true.
 * With the flag unset this guard is a no-op, so existing behaviour is kept.
 * Enforcement is server-side, from the membership resolved by AuthMiddleware.
 */
@Injectable()
export class ProviderAccountAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const role = req?.org?.users?.[0]?.role as string | undefined;
    if (req?.user?.isSuperAdmin || canMutateProviderAccounts(role)) {
      return true;
    }
    throw new HttpForbiddenException();
  }
}
