import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreateFeedDto {
  @IsOptional() @IsString() slug?: string;
  @IsString() name: string;
  @IsString() description: string;
  @IsString() network: string;
  @IsOptional() @IsIn(['active', 'draft', 'paused']) status?: string;
  @IsOptional() @IsIn(['grid', 'list', 'carousel', 'single']) layoutDefault?: string;
  @IsOptional() @IsInt() @Min(1) maxItemsDefault?: number;
  @IsOptional() @IsBoolean() showMetrics?: boolean;
  @IsOptional() @IsBoolean() showMedia?: boolean;
  @IsOptional() @IsInt() @Min(0) autoRefreshMinutes?: number;
  @IsOptional() @IsString() mfaCode?: string;
}
