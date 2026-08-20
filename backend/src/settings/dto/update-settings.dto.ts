import { IsBoolean, IsEmail, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class UpdateSettingsDto {
  @IsOptional() @IsString() institutionName?: string;
  @IsOptional() @IsString() shortcodeTag?: string;
  @IsOptional() @IsInt() @Min(0) apiCacheDurationSeconds?: number;
  @IsOptional() @IsBoolean() autoInvalidateCache?: boolean;
  @IsOptional() allowedCorsDomains?: string[];
  @IsOptional() officialAccounts?: Record<string, unknown>;
  @IsOptional() @IsEmail() contactSupportEmail?: string;
  @IsOptional() @IsBoolean() maintenanceMode?: boolean;
}
