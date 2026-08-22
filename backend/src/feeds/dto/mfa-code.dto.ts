import { IsOptional, IsString } from 'class-validator';

export class MfaCodeDto {
  @IsOptional() @IsString() mfaCode?: string;
}
