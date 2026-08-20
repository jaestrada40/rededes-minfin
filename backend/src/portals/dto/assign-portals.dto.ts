import { IsArray, IsString } from 'class-validator';

export class AssignPortalsDto {
  @IsArray() @IsString({ each: true }) portalIds: string[];
}
