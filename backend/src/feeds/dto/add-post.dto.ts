import { IsOptional, IsString } from 'class-validator';

export class AddPostDto {
  @IsString() urlOrId: string;
  @IsString() network: string;
  @IsOptional() @IsString() customContent?: string;
}
