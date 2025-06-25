import { Controller, Post, Body, Get, Headers } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  async login(@Body() body: { phone: string; password: string }) {
    return this.authService.login(body.phone, body.password);
  }

  @Post('refresh')
  async refresh(@Body() body: { refreshToken: string }) {
    return this.authService.refresh(body.refreshToken);
  }

  @Get('me')
  async getMe(@Headers('authorization') authHeader: string): Promise<any> {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return { error: 'Missing or invalid Authorization header' };
    }
    const accessToken = authHeader.replace('Bearer ', '');
    return this.authService.getUserByToken(accessToken);
  }
}
