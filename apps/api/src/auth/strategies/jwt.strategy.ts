import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

import { Configuration } from '../../config/configuration';
import { UserRole } from '../../users/entities/user.entity';
import { UserModulePermissionsService } from '../../users/userModulePermissions.service';
import { UsersService } from '../../users/users.service';
import { AuthenticatedUser } from '../interfaces/authenticatedUser.interface';
import { JwtPayload } from '../interfaces/jwtPayload.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService<Configuration, true>,
    private readonly usersService: UsersService,
    private readonly userModulePermissionsService: UserModulePermissionsService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get('jwt', { infer: true }).secret,
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    if (payload.type !== 'access') {
      throw new UnauthorizedException('Invalid token type');
    }

    const user = await this.usersService.findById(payload.sub);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found or inactive');
    }

    // Skipped entirely for an admin — full access is unconditional, so
    // there's no reason to query rows that would never be consulted. See
    // UserModulePermission's doc comment.
    const modules =
      user.role === UserRole.Admin
        ? []
        : await this.userModulePermissionsService.getModulesForUser(user.id);

    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      createdAt: user.createdAt,
      modules,
    };
  }
}
