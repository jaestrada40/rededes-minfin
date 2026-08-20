import { IsEmail, IsIn, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsString()
  name: string;

  @IsIn(['admin', 'editor', 'auditor', 'viewer'])
  role: string;

  @IsOptional()
  @IsString()
  department?: string;
}
