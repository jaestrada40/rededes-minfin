import { IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';

export class CreatePortalDto {
  @IsString() name: string;
  @IsString() domain: string;
  @IsIn(['Institucional', 'Transparencia', 'Finanzas', 'Sistemas', 'Direcciones'])
  category: string;
  @IsString() ipAddress: string;
  @IsString() wpVersion: string;
  @IsString() pluginVersion: string;
  @IsString() description: string;
  @IsOptional() @IsBoolean() webhookEnabled?: boolean;
}
