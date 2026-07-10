import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

import type { JwtSignOptions } from '@nestjs/jwt';

import { Configuration } from '../config/configuration';
import { User } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';

import { ChangePasswordDto } from './dto/changePassword.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refreshToken.dto';
import { JwtPayload } from './interfaces/jwtPayload.interface';

const BCRYPT_SALT_ROUNDS = 10;

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService<Configuration, true>,
  ) {}

  async login(dto: LoginDto): Promise<AuthTokens> {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordMatches = await bcrypt.compare(
      dto.password,
      user.passwordHash,
    );
    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.issueTokens(user);
  }

  async refresh(
    dto: RefreshTokenDto,
  ): Promise<Pick<AuthTokens, 'accessToken'>> {
    const payload = await this.verifyRefreshToken(dto.refreshToken);

    const user = await this.usersService.findById(payload.sub);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    return { accessToken: this.signToken(user, 'access') };
  }

  async changePassword(userId: string, dto: ChangePasswordDto): Promise<void> {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const currentPasswordMatches = await bcrypt.compare(
      dto.currentPassword,
      user.passwordHash,
    );
    if (!currentPasswordMatches) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    const newPasswordHash = await bcrypt.hash(
      dto.newPassword,
      BCRYPT_SALT_ROUNDS,
    );
    await this.usersService.updatePasswordHash(userId, newPasswordHash);
  }

  private async verifyRefreshToken(refreshToken: string): Promise<JwtPayload> {
    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(
        refreshToken,
        { secret: this.configService.get('jwt', { infer: true }).secret },
      );
      if (payload.type !== 'refresh') {
        throw new UnauthorizedException('Invalid or expired refresh token');
      }
      return payload;
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  private issueTokens(user: User): AuthTokens {
    return {
      accessToken: this.signToken(user, 'access'),
      refreshToken: this.signToken(user, 'refresh'),
    };
  }

  private signToken(user: User, type: JwtPayload['type']): string {
    const jwtConfig = this.configService.get('jwt', { infer: true });
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      type,
    };

    const expiresIn = (
      type === 'access'
        ? jwtConfig.accessExpiration
        : jwtConfig.refreshExpiration
    ) as JwtSignOptions['expiresIn'];

    return this.jwtService.sign(payload, {
      secret: jwtConfig.secret,
      expiresIn,
    });
  }
}
