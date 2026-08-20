import { IsString } from 'class-validator';

export class UpdatePostContentDto {
  @IsString() content: string;
}
