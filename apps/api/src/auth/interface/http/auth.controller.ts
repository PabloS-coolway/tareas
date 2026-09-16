import { BadRequestException, Body, Controller, Get, Headers, HttpCode, Post } from '@nestjs/common';
import { CambiarPasswordDto, ForgotPasswordDto, LoginRequest, LoginResponse, ResetPasswordDto, UserDto } from '@yorga/contracts';
import { AuthService } from '../../application/auth.service';
import { CurrentUser, Public } from './decorators';
import { JwtPayload } from '../../application/auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('login')
  login(@Body() body: LoginRequest): Promise<LoginResponse> {
    if (!body?.email || !body?.password) throw new BadRequestException('Indica email y contraseña.');
    return this.auth.login(body.email, body.password, !!body.remember);
  }

  /** "He olvidado mi contraseña": siempre 204. */
  @Public()
  @Post('forgot')
  @HttpCode(204)
  async forgot(@Body() body: ForgotPasswordDto, @Headers('origin') origin?: string): Promise<void> {
    if (!body?.email) throw new BadRequestException('Indica tu email.');
    await this.auth.forgotPassword(body.email, process.env.APP_URL || origin || '');
  }

  @Public()
  @Get('forgot/info')
  forgotInfo(): { email: boolean } {
    return { email: this.auth.correoDisponible() };
  }

  @Public()
  @Post('reset')
  @HttpCode(204)
  async reset(@Body() body: ResetPasswordDto): Promise<void> {
    if (!body?.token || !body?.password) throw new BadRequestException('Faltan datos.');
    await this.auth.resetPassword(body.token, body.password);
  }

  @Get('me')
  me(@CurrentUser() user: JwtPayload): Promise<UserDto> {
    return this.auth.me(user.sub);
  }

  /** El propio usuario cambia su contraseña (exige la actual). */
  @Post('cambiar-password')
  @HttpCode(204)
  async cambiarPassword(@CurrentUser() user: JwtPayload, @Body() body: CambiarPasswordDto): Promise<void> {
    if (!body?.actual || !body?.nueva) throw new BadRequestException('Indica la contraseña actual y la nueva.');
    await this.auth.changePassword(user.sub, body.actual, body.nueva);
  }
}
