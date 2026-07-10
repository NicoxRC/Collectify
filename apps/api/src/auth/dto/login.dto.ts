import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'owner@collectify.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'a-strong-password' })
  @IsString()
  @IsNotEmpty()
  password!: string;
}
