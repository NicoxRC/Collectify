import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsEnum } from 'class-validator';

import { AppModule } from '../entities/userModulePermission.entity';

export class UpdateUserModulePermissionsDto {
  @ApiProperty({
    enum: AppModule,
    isArray: true,
    description:
      'The full set of modules this user can access, replacing whatever was granted before. Ignored in practice for an admin account, which always has full access regardless of these rows.',
  })
  @IsArray()
  @IsEnum(AppModule, { each: true })
  modules!: AppModule[];
}
