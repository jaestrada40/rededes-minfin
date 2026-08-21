import { IsOptional, IsString } from 'class-validator';

export class AddPostDto {
  @IsString() urlOrId: string;
  @IsString() network: string;
  @IsOptional() @IsString() customContent?: string;
  @IsOptional() @IsString() customMediaUrl?: string;
  @IsOptional() @IsString() customAuthorName?: string;
}
