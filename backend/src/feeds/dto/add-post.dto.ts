import {
  IsIn,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  MaxLength,
  ValidateIf,
} from 'class-validator';

export const POST_NETWORKS = [
  'x',
  'facebook',
  'instagram',
  'youtube',
  'linkedin',
  'tiktok',
] as const;

export class AddPostDto {
  @IsString() @Length(1, 2048) urlOrId: string;
  @IsIn(POST_NETWORKS) network: string;
  @IsOptional() @IsString() @MaxLength(10000) customContent?: string;
  // Solo https: el valor se publica en portales públicos y se muestra en <img>.
  @ValidateIf((o: AddPostDto) => !!o.customMediaUrl)
  @IsUrl({ protocols: ['https'], require_protocol: true })
  @MaxLength(2048)
  customMediaUrl?: string;
  @IsOptional() @IsString() @MaxLength(200) customAuthorName?: string;
  @IsOptional() @IsString() @MaxLength(16) mfaCode?: string;
}
