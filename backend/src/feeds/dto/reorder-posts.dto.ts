import { IsArray, IsString } from 'class-validator';

export class ReorderPostsDto {
  @IsArray() @IsString({ each: true }) orderedPostIds: string[];
}
