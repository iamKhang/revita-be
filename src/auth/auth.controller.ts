import {
  Controller,
  Post,
  Body,
  Get,
  Headers,
  Req,
  Res,
  UseGuards,
  Query,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { GoogleAuthGuard } from './google.guard';
import { Request, Response } from 'express';
import axios from 'axios';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  async login(@Body() body: { identifier: string; password: string }) {
    return this.authService.login(body.identifier, body.password);
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

  @Get('google')
  @UseGuards(GoogleAuthGuard)
  async googleAuth() {
    // Guard sẽ xử lý việc redirect đến Google
  }

  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  async googleAuthCallback(@Req() req: Request, @Res() res: Response) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const user = req.user as any;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    const result = await this.authService.googleLogin(user);
    // Redirect về frontend với tokens
    const redirectUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const queryParams = new URLSearchParams({
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      user: JSON.stringify(result.user),
    });
    res.redirect(`${redirectUrl}/auth/callback?${queryParams.toString()}`);
  }

  @Post('google/token')
  async googleToken(@Body() body: { code: string }) {
    try {
      console.log('🔍 Starting Google OAuth2 token exchange...');
      console.log('📝 Received code:', body.code);
      // Decode URL encoded authorization code
      const decodedCode = decodeURIComponent(body.code);
      console.log('🔓 Decoded code:', decodedCode);

      // Exchange authorization code for tokens
      console.log('🔄 Exchanging code for tokens...');
      const tokenResponse = await axios.post(
        'https://oauth2.googleapis.com/token',
        {
          code: decodedCode,
          client_id: process.env.GOOGLE_CLIENT_ID,
          client_secret: process.env.GOOGLE_CLIENT_SECRET,
          redirect_uri:
            process.env.GOOGLE_CALLBACK_URL ||
            'http://localhost:3000/auth/google/callback',
          grant_type: 'authorization_code',
        },
      );

      console.log('✅ Token exchange successful');
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const { access_token, refresh_token } = tokenResponse.data;

      // Get user info from Google
      console.log('👤 Getting user info from Google...');
      const userInfoResponse = await axios.get(
        'https://www.googleapis.com/oauth2/v2/userinfo',
        {
          headers: {
            Authorization: `Bearer ${access_token}`,
          },
        },
      );

      console.log('✅ User info received');
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const userInfo = userInfoResponse.data;
      console.log('👤 User info:', {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        email: userInfo.email,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        name: `${userInfo.given_name} ${userInfo.family_name}`,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        id: userInfo.id,
      });

      // Create Google user object
      const googleUser = {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        email: userInfo.email,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        firstName: userInfo.given_name,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        lastName: userInfo.family_name,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        picture: userInfo.picture,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        accessToken: access_token,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        refreshToken: refresh_token,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        googleId: userInfo.id,
      };

      console.log('🔄 Processing Google login...');
      // Process login
      const result = await this.authService.googleLogin(googleUser);
      console.log('✅ Google login successful');
      return result;
    } catch (error) {
      console.error('❌ Google OAuth2 Error:', error);
      if (axios.isAxiosError(error)) {
        console.error('❌ Axios Error Details:', {
          status: error.response?.status,
          statusText: error.response?.statusText,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          data: error.response?.data,
          config: {
            url: error.config?.url,
            method: error.config?.method,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            data: error.config?.data,
          },
        });
        if (error.response?.status === 400) {
          throw new Error(
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            `Google OAuth2 Error: ${error.response.data.error_description || error.response.data.error}`,
          );
        }
      }
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      throw new Error(`Failed to authenticate with Google: ${error.message}`);
    }
  }

  @Get('callback')
  authCallback(@Query() query: any) {
    // Xử lý callback từ Google OAuth2 redirect
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const { accessToken, refreshToken, user } = query;
    if (!accessToken || !refreshToken) {
      return { error: 'Missing tokens' };
    }
    try {
      // Decode user data nếu cần
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const userData =
        typeof user === 'string' ? JSON.parse(decodeURIComponent(user)) : user;
      return {
        success: true,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        accessToken,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        refreshToken,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        user: userData,
        message: 'Google OAuth2 login successful!',
      };
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      return { error: 'Invalid user data' };
    }
  }
}
