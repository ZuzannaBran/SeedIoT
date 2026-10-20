import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { StringValue } from 'ms';
import { DatabaseService } from '../database/database.service';
import { AuthenticatedUser, UserJwtPayload } from './auth.types';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';

interface UserRecord {
  id: string;
  email: string;
  password_hash: string;
  role: string;
  current_refresh_token_hash: string | null;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async register(registerDto: RegisterDto): Promise<AuthTokens> {
    const existingUser = await this.findUserByEmail(registerDto.email);

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    const passwordHash = await bcrypt.hash(registerDto.password, 10);
    const userId = randomUUID();

    await this.databaseService.query(
      `
        INSERT INTO users (id, email, password_hash, role)
        VALUES ($1, $2, $3, $4)
      `,
      [userId, registerDto.email.toLowerCase(), passwordHash, 'user'],
    );

    return this.issueTokens({
      id: userId,
      email: registerDto.email.toLowerCase(),
      role: 'user',
    });
  }

  async login(loginDto: LoginDto): Promise<AuthTokens> {
    const user = await this.findUserByEmail(loginDto.email);

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordMatches = await bcrypt.compare(
      loginDto.password,
      user.password_hash,
    );

    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.issueTokens({
      id: user.id,
      email: user.email,
      role: user.role,
    });
  }

  async refreshTokens(refreshDto: RefreshTokenDto): Promise<AuthTokens> {
    let payload: UserJwtPayload;

    try {
      payload = await this.jwtService.verifyAsync<UserJwtPayload>(
        refreshDto.refreshToken,
        {
          secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
        },
      );
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const user = await this.findUserById(payload.sub);

    if (!user?.current_refresh_token_hash) {
      throw new UnauthorizedException('Refresh token not recognized');
    }

    const refreshMatches = await bcrypt.compare(
      refreshDto.refreshToken,
      user.current_refresh_token_hash,
    );

    if (!refreshMatches) {
      throw new UnauthorizedException('Refresh token not recognized');
    }

    return this.issueTokens({
      id: user.id,
      email: user.email,
      role: user.role,
    });
  }

  async getProfile(userId: string): Promise<AuthenticatedUser> {
    const user = await this.findUserById(userId);

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return {
      id: user.id,
      email: user.email,
      role: user.role,
    };
  }

  private async issueTokens(user: AuthenticatedUser): Promise<AuthTokens> {
    const payload: UserJwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      type: 'user',
    };
    const accessExpiresIn = this.configService.get<string>(
      'JWT_ACCESS_EXPIRES_IN',
      '15m',
    );
    const refreshExpiresIn = this.configService.get<string>(
      'JWT_REFRESH_EXPIRES_IN',
      '7d',
    );

    const accessToken = await this.jwtService.signAsync(payload, {
      secret: this.configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
      expiresIn: accessExpiresIn as StringValue,
    });

    const refreshToken = await this.jwtService.signAsync(payload, {
      secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
      expiresIn: refreshExpiresIn as StringValue,
    });

    const refreshTokenHash = await bcrypt.hash(refreshToken, 10);

    await this.databaseService.query(
      `
        UPDATE users
        SET current_refresh_token_hash = $2
        WHERE id = $1
      `,
      [user.id, refreshTokenHash],
    );

    return {
      accessToken,
      refreshToken,
    };
  }

  private async findUserByEmail(email: string): Promise<UserRecord | null> {
    const result = await this.databaseService.query<UserRecord>(
      `
        SELECT id, email, password_hash, role, current_refresh_token_hash
        FROM users
        WHERE email = $1
      `,
      [email.toLowerCase()],
    );

    return result.rows[0] ?? null;
  }

  private async findUserById(id: string): Promise<UserRecord | null> {
    const result = await this.databaseService.query<UserRecord>(
      `
        SELECT id, email, password_hash, role, current_refresh_token_hash
        FROM users
        WHERE id = $1
      `,
      [id],
    );

    return result.rows[0] ?? null;
  }
}
