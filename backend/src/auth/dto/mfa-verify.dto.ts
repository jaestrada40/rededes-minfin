import { IsString, Length } from 'class-validator';

export class MfaVerifyDto {
  @IsString()
  token: string;

  @IsString()
  @Length(6, 6)
  code: string;
}
