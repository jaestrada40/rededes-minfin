import { Body, Controller, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { MfaVerifyDto } from './dto/mfa-verify.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto.email, dto.password);
  }

  @Post('mfa/setup')
  mfaSetup(@Body('setupToken') setupToken: string) {
    return this.auth.mfaSetup(setupToken);
  }

  @Post('mfa/setup/verify')
  mfaSetupVerify(@Body() dto: MfaVerifyDto, @Req() req: Request) {
    return this.auth.mfaSetupVerify(dto.token, dto.code, req.ip);
  }

  @Post('mfa/verify')
  mfaVerify(@Body() dto: MfaVerifyDto, @Req() req: Request) {
    return this.auth.mfaVerify(dto.token, dto.code, req.ip);
  }

  @Post('refresh')
  refresh(@Body('refreshToken') refreshToken: string, @Req() req: Request) {
    return this.auth.refresh(refreshToken, req.ip);
  }

  @Post('logout')
  logout(@Body('refreshToken') refreshToken: string) {
    return this.auth.logout(refreshToken);
  }
}
