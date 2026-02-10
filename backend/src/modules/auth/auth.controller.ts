// backend/src/modules/auth/auth.controller.ts
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request, Response as ExpressResponse } from 'express';

import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from '../../modules/auth/jwt-auth.guard';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private readonly authService: AuthService) {}

  @ApiOperation({ summary: 'Login con email o username' })
  @ApiResponse({ status: 200, description: 'Login exitoso, devuelve token y datos del usuario' })
  @ApiResponse({ status: 400, description: 'Request inválido (faltan campos)' })
  @ApiResponse({ status: 401, description: 'Credenciales incorrectas' })
  @ApiResponse({ status: 403, description: 'Usuario inactivo o sin permiso' })
  @HttpCode(HttpStatus.OK)
  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: ExpressResponse,
  ) {
    if ((!dto.email && !dto.username) || !dto.password) {
      throw new BadRequestException('Debes enviar email o username, y password.');
    }

    const identifier = dto.email ?? dto.username;
    this.logger.debug({ action: 'login', user: identifier });

    const ip =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.socket?.remoteAddress ||
      null;

    const userAgent = req.headers['user-agent'] as string | undefined;

    const result = await this.authService.login(dto, { ip, userAgent });

    /**
     * Cookies para que el middleware de Next permita navegar
     * Importante: Secure SOLO si la request viene por HTTPS.
     * Si estás en HTTP (sin SSL), el navegador NO guarda cookies Secure.
     */
    const xfp = String(req.headers['x-forwarded-proto'] ?? '');
    const isHttps = xfp.includes('https');
    const cookieDomain = process.env.COOKIE_DOMAIN || undefined;

    const cookieBase = {
      httpOnly: true,
      sameSite: 'lax' as const,
      secure: isHttps,
      domain: cookieDomain,
      path: '/',
    };

    res.cookie('drizatx-auth', '1', cookieBase);
    res.cookie('drizatx-role', String(result?.user?.role ?? ''), cookieBase);

    const token = result?.access_token ?? result?.token;
    if (token) {
      res.cookie('drizatx-token', token, cookieBase);
    }

    return result;
  }

  // ========= Perfil del usuario autenticado =========
  @ApiOperation({ summary: 'Obtiene el perfil del usuario autenticado' })
  @ApiBearerAuth() // Swagger: requiere Authorization: Bearer <token>
  @ApiResponse({ status: 200, description: 'Perfil del usuario autenticado' })
  @ApiResponse({ status: 401, description: 'No autenticado o token inválido' })
  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@Req() req: Request) {
    // JwtStrategy debería haber puesto el payload en req.user
    // Usamos `sub` como id del operador (así fue emitido en el token).
    const payload = req.user as { sub?: number } | undefined;
    const operatorId = payload?.sub;

    if (!operatorId) {
      throw new BadRequestException('No se pudo resolver el usuario del token.');
    }

    return this.authService.profile(operatorId);
  }

  @ApiOperation({ summary: 'Obtiene los permisos del usuario autenticado' })
  @ApiBearerAuth()
  @ApiResponse({ status: 200, description: 'Listado de permisos del usuario autenticado' })
  @ApiResponse({ status: 401, description: 'No autenticado o token inválido' })
  @UseGuards(JwtAuthGuard)
  @Get('me/permissions')
  async myPermissions(@Req() req: Request) {
    const payload = req.user as { sub?: number } | undefined;
    const operatorId = payload?.sub;

    if (!operatorId) {
      throw new BadRequestException('No se pudo resolver el usuario del token.');
    }

    return this.authService.myPermissions(operatorId);
  }
}
