import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from './roles.decorator';
import { Role } from './roles.enum';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles) return true;
    
    const request = context.switchToHttp().getRequest();
    const { user } = request;
    
    console.log('Required Roles:', requiredRoles);
    console.log('User in Guard:', user);
    console.log('Headers:', request.headers);
    console.log('Authorization header:', request.headers.authorization);
    
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
    return requiredRoles.includes(user?.role);
  }
}
