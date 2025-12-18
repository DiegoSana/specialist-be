import { Controller, Post, Body, Get, UseGuards, HttpCode, HttpStatus, Req, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Response } from 'express';
// Import from identity module
import { AuthenticationService } from '../../identity/application/services/authentication.service';
import { RegisterDto } from '../../identity/application/dto/register.dto';
import { LoginDto } from '../../identity/application/dto/login.dto';
import { AuthResponseDto } from '../../identity/application/dto/auth-response.dto';
import { GoogleAuthGuard } from '../../identity/infrastructure/guards/google-auth.guard';
import { FacebookAuthGuard } from '../../identity/infrastructure/guards/facebook-auth.guard';
import { Public } from '../../shared/presentation/decorators/public.decorator';

@ApiTags('Authentication')
@Controller('auth')
export class AuthenticationController {
  constructor(private readonly authenticationService: AuthenticationService) {}

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({ status: 201, description: 'User registered successfully', type: AuthResponseDto })
  @ApiResponse({ status: 409, description: 'Email already exists' })
  async register(@Body() registerDto: RegisterDto): Promise<AuthResponseDto> {
    return this.authenticationService.register(registerDto);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login user' })
  @ApiResponse({ status: 200, description: 'Login successful', type: AuthResponseDto })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(@Body() loginDto: LoginDto): Promise<AuthResponseDto> {
    return this.authenticationService.login(loginDto);
  }

  @Public()
  @Get('google')
  @UseGuards(GoogleAuthGuard)
  @ApiOperation({ summary: 'Initiate Google OAuth login' })
  @ApiResponse({ status: 302, description: 'Redirects to Google login page' })
  async googleAuth() {
    // Guard redirects to Google
  }

  @Public()
  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  @ApiOperation({ summary: 'Google OAuth callback' })
  @ApiResponse({ status: 302, description: 'Redirects to frontend with token' })
  async googleAuthCallback(@Req() req: any, @Res() res: Response) {
    const result = await this.authenticationService.googleLogin(req.user);
    
    // Redirect to frontend with token in URL
    const redirectUrl = `${result.redirectUrl}/es/auth/callback?token=${result.accessToken}&user=${encodeURIComponent(JSON.stringify(result.user))}`;
    
    return res.redirect(redirectUrl);
  }

  @Public()
  @Get('facebook')
  @UseGuards(FacebookAuthGuard)
  @ApiOperation({ summary: 'Initiate Facebook OAuth login' })
  @ApiResponse({ status: 302, description: 'Redirects to Facebook login page' })
  async facebookAuth() {
    // Guard redirects to Facebook
  }

  @Public()
  @Get('facebook/callback')
  @UseGuards(FacebookAuthGuard)
  @ApiOperation({ summary: 'Facebook OAuth callback' })
  @ApiResponse({ status: 302, description: 'Redirects to frontend with token' })
  async facebookAuthCallback(@Req() req: any, @Res() res: Response) {
    const result = await this.authenticationService.facebookLogin(req.user);
    
    // Redirect to frontend with token in URL
    const redirectUrl = `${result.redirectUrl}/es/auth/callback?token=${result.accessToken}&user=${encodeURIComponent(JSON.stringify(result.user))}`;
    
    return res.redirect(redirectUrl);
  }
}
