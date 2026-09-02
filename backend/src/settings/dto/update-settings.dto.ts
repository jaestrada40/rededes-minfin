import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';

export class UpdateSettingsDto {
  @IsOptional() @IsString() institutionName?: string;
  @IsOptional() @IsString() shortcodeTag?: string;
  @IsOptional() @IsInt() @Min(0) apiCacheDurationSeconds?: number;
  @IsOptional() @IsBoolean() autoInvalidateCache?: boolean;
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allowedCorsDomains?: string[];
  @IsOptional() @IsObject() officialAccounts?: Record<string, unknown>;
  @IsOptional() @IsEmail() contactSupportEmail?: string;
  @IsOptional() @IsBoolean() maintenanceMode?: boolean;
  @IsOptional() @IsString() logoUrl?: string;
  @IsOptional() @IsObject() apiKeys?: Record<string, string>;
  @IsOptional() @IsBoolean() mfaRequired?: boolean;
  @IsOptional() @IsString() @MinLength(16) webhookSecret?: string;
}
