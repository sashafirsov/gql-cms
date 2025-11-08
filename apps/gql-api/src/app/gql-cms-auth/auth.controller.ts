// auth.controller.ts
// Authentication controller for gql_cms with /gql-cms/auth prefix

import { Controller, Post, Get, Body, Req, Res, HttpException, HttpStatus } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import type { RegisterDto, LoginDto, AuthResponse } from './auth.dto';

@Controller('gql-cms/auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  /**
   * POST /gql-cms/auth/register
   * Register new user with password
   */
  @Post('register')
  async register(@Body() dto: RegisterDto, @Req() req: Request, @Res() res: Response) {
    try {
      const user = await this.authService.register(
        dto.email,
        dto.password,
        dto.fullName
      );

      // Issue token pair
      const tokens = await this.authService.issueTokenPair(
        user,
        req.headers['user-agent'],
        req.ip
      );

      // Set HttpOnly cookies
      this.setAuthCookies(res, tokens.accessToken, tokens.refreshToken);

      const response: AuthResponse = {
        success: true,
        message: 'Registration successful',
        user: {
          id: user.userId,
          email: user.email,
          fullName: user.fullName,
          authProvider: user.authProvider,
          emailVerified: user.emailVerified,
        },
      };

      res.status(HttpStatus.CREATED).json(response);
    } catch (err: any) {
      throw new HttpException(
        err.message || 'Registration failed',
        HttpStatus.BAD_REQUEST
      );
    }
  }

  /**
   * POST /gql-cms/auth/login
   * Login with email and password
   */
  @Post('login')
  async login(@Body() dto: LoginDto, @Req() req: Request, @Res() res: Response) {
    try {
      const user = await this.authService.login(dto.email, dto.password);

      // Issue token pair
      const tokens = await this.authService.issueTokenPair(
        user,
        req.headers['user-agent'],
        req.ip
      );

      // Set HttpOnly cookies
      this.setAuthCookies(res, tokens.accessToken, tokens.refreshToken);

      const response: AuthResponse = {
        success: true,
        message: 'Login successful',
        user: {
          id: user.userId,
          email: user.email,
          fullName: user.fullName,
          authProvider: user.authProvider,
          emailVerified: user.emailVerified,
        },
      };

      res.status(HttpStatus.OK).json(response);
    } catch (err: any) {
      throw new HttpException(
        'Invalid credentials',
        HttpStatus.UNAUTHORIZED
      );
    }
  }

  /**
   * POST /gql-cms/auth/refresh
   * Refresh access token using refresh token
   */
  @Post('refresh')
  async refresh(@Req() req: Request, @Res() res: Response) {
    try {
      const refreshToken = req.cookies['refresh_token'];

      if (!refreshToken) {
        throw new Error('No refresh token provided');
      }

      const tokens = await this.authService.refreshTokens(
        refreshToken,
        req.headers['user-agent'],
        req.ip
      );

      // Set new HttpOnly cookies
      this.setAuthCookies(res, tokens.accessToken, tokens.refreshToken);

      res.status(HttpStatus.OK).json({
        success: true,
        message: 'Token refreshed',
      });
    } catch (err: any) {
      throw new HttpException(
        err.message || 'Token refresh failed',
        HttpStatus.UNAUTHORIZED
      );
    }
  }

  /**
   * POST /gql-cms/auth/logout
   * Logout current device (revoke refresh token)
   */
  @Post('logout')
  async logout(@Req() req: Request, @Res() res: Response) {
    try {
      const refreshToken = req.cookies['refresh_token'];

      if (refreshToken) {
        await this.authService.logout(refreshToken);
      }

      // Clear cookies
      this.clearAuthCookies(res);

      res.status(HttpStatus.OK).json({
        success: true,
        message: 'Logout successful',
      });
    } catch (err: any) {
      throw new HttpException(
        'Logout failed',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * POST /gql-cms/auth/logout-all
   * Logout all devices (revoke all tokens for user)
   */
  @Post('logout-all')
  async logoutAll(@Req() req: any, @Res() res: Response) {
    try {
      // Get user from auth middleware
      if (!req.auth || !req.auth.userId) {
        throw new Error('Not authenticated');
      }

      await this.authService.logoutAll(req.auth.userId);

      // Clear cookies
      this.clearAuthCookies(res);

      res.status(HttpStatus.OK).json({
        success: true,
        message: 'Logged out from all devices',
      });
    } catch (err: any) {
      throw new HttpException(
        err.message || 'Logout failed',
        HttpStatus.UNAUTHORIZED
      );
    }
  }

  /**
   * GET /gql-cms/auth/me
   * Get current user info
   */
  @Get('me')
  async me(@Req() req: any, @Res() res: Response) {
    try {
      if (!req.auth || !req.auth.userId) {
        throw new Error('Not authenticated');
      }

      const user = await this.authService.getUserDetails(req.auth.userId);

      res.status(HttpStatus.OK).json({
        success: true,
        user: {
          id: user.userId,
          email: user.email,
          fullName: user.fullName,
          authProvider: user.authProvider,
          emailVerified: user.emailVerified,
          role: user.role,
        },
      });
    } catch (err: any) {
      throw new HttpException(
        'Not authenticated',
        HttpStatus.UNAUTHORIZED
      );
    }
  }

  /**
   * Helper: Set auth cookies
   */
  private setAuthCookies(res: Response, accessToken: string, refreshToken: string) {
    // Access token cookie (all paths, 15 minutes)
    res.cookie('access_token', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 15 * 60 * 1000, // 15 minutes
    });

    // Refresh token cookie (auth path only, 30 days)
    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/gql-cms/auth',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    });
  }

  /**
   * Helper: Clear auth cookies
   */
  private clearAuthCookies(res: Response) {
    res.clearCookie('access_token', { path: '/' });
    res.clearCookie('refresh_token', { path: '/gql-cms/auth' });
  }
}
