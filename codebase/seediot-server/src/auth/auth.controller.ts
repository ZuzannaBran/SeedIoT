import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { UserJwtPayload } from './auth.types';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { UserAuthGuard } from './guards/user-auth.guard';

type RequestWithUser = Request & { user: UserJwtPayload };

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @ApiOperation({ summary: 'Register a new user account' })
  @ApiCreatedResponse({
    schema: {
      example: {
        accessToken: 'jwt-access-token',
        refreshToken: 'jwt-refresh-token',
      },
    },
  })
  @Post('register')
  register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @ApiOperation({ summary: 'Log in and receive JWT tokens' })
  @ApiOkResponse({
    schema: {
      example: {
        accessToken: 'jwt-access-token',
        refreshToken: 'jwt-refresh-token',
      },
    },
  })
  @Post('login')
  login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @ApiOperation({ summary: 'Refresh JWT tokens using a refresh token' })
  @ApiOkResponse({
    schema: {
      example: {
        accessToken: 'jwt-access-token',
        refreshToken: 'jwt-refresh-token',
      },
    },
  })
  @Post('refresh')
  refresh(@Body() refreshDto: RefreshTokenDto) {
    return this.authService.refreshTokens(refreshDto);
  }

  @ApiBearerAuth('user-bearer')
  @ApiOperation({ summary: 'Get the current authenticated user profile' })
  @ApiOkResponse({
    schema: {
      example: {
        id: '1fba8bb4-71ca-49f1-95d3-1b05b0583cc6',
        email: 'user@example.com',
        role: 'user',
      },
    },
  })
  @UseGuards(UserAuthGuard)
  @Get('me')
  me(@Req() request: RequestWithUser) {
    return this.authService.getProfile(request.user.sub);
  }
}
