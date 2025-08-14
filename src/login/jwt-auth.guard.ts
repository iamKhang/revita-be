import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const request = context.switchToHttp().getRequest();

    console.log(
      'JwtAuthGuard - Authorization header:',
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      request.headers.authorization,
    );

    return super.canActivate(context);
  }

  handleRequest(err: any, user: any, info: any, context: ExecutionContext) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    console.log('JwtAuthGuard - handleRequest:', { err, user, info });

    if (err || !user) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      console.log('JwtAuthGuard - Authentication failed:', { err, info });
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return super.handleRequest(err, user, info, context);
  }
}
