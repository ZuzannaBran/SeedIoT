import { Module } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { RolesGuard } from './guards/roles.guard';
import { UserAuthGuard } from './guards/user-auth.guard';

@Module({
  imports: [JwtModule.register({})],
  controllers: [AuthController],
  providers: [AuthService, UserAuthGuard, RolesGuard, Reflector],
  exports: [AuthService, UserAuthGuard, RolesGuard, JwtModule],
})
export class AuthModule {}
