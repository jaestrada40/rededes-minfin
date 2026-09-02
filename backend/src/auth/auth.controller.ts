import { Body, Controller, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { MfaVerifyDto } from './dto/mfa-verify.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  private refreshTokenFrom(req: Request): string {
    const prefix = 'minfin_refresh_token=';
    return (
      (req.headers.cookie ?? '')
        .split(';')
        .map((entry) => entry.trim())
        .find((entry) => entry.startsWith(prefix))
        ?.slice(prefix.length) ?? ''
    );
  }

  @Post('mfa/setup')
  mfaSetup(@Body('setupToken') setupToken: string) {
    return this.auth.mfaSetup(setupToken);
  }

  private sendTokens(
    response: Response,
    tokens: { accessToken: string; refreshToken: string },
  ) {
    response.cookie('minfin_refresh_token', tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/auth',
      maxAge: Number(process.env.JWT_REFRESH_EXPIRES_IN_DAYS ?? 7) * 86400_000,
    });
    return response.json({ accessToken: tokens.accessToken });
  }

  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const result = await this.auth.login(dto.email, dto.password, req.ip);
    if ('accessToken' in result && result.accessToken && result.refreshToken) {
      return this.sendTokens(res, result);
    }
    return res.json(result);
  }

  @Post('mfa/setup/verify')
  async mfaSetupVerify(
    @Body() dto: MfaVerifyDto,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    return this.sendTokens(
      res,
      await this.auth.mfaSetupVerify(dto.token, dto.code, req.ip),
    );
  }

  @Post('mfa/verify')
  async mfaVerify(
    @Body() dto: MfaVerifyDto,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    return this.sendTokens(
      res,
      await this.auth.mfaVerify(dto.token, dto.code, req.ip),
    );
  }

  @Post('refresh')
  async refresh(@Req() req: Request, @Res() res: Response) {
    const tokens = await this.auth.refresh(this.refreshTokenFrom(req), req.ip);
    return this.sendTokens(res, tokens);
  }

  @Post('logout')
  async logout(@Req() req: Request, @Res() res: Response) {
    await this.auth.logout(this.refreshTokenFrom(req));
    res.clearCookie('minfin_refresh_token', { path: '/auth' });
    return res.status(204).send();
  }
}
