import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { User } from './entities/user.entity';
import { UserModulePermission } from './entities/userModulePermission.entity';
import { UserModulePermissionsService } from './userModulePermissions.service';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [TypeOrmModule.forFeature([User, UserModulePermission])],
  controllers: [UsersController],
  providers: [UsersService, UserModulePermissionsService],
  // UserModulePermissionsService is exported for JwtStrategy (AuthModule),
  // which needs it to populate AuthenticatedUser.modules on every request.
  exports: [UsersService, UserModulePermissionsService],
})
export class UsersModule {}
