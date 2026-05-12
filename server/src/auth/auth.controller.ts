import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { SkipApiKey } from './decorators/skip-api-key.decorator';

@ApiTags('Autenticação')
@Controller('auth')
@SkipApiKey()
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Login de usuário',
    description:
      'Autentica um usuário com email e senha, retornando tokens de acesso e atualização.',
  })
  @ApiResponse({
    status: 200,
    description:
      'Login realizado com sucesso. Retorna accessToken, refreshToken e dados do usuário.',
  })
  @ApiResponse({ status: 401, description: 'Credenciais inválidas.' })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto.email, dto.password);
  }

  @Post('refresh')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Renovar access token',
    description:
      'Gera um novo access token utilizando um refresh token válido.',
  })
  @ApiResponse({
    status: 200,
    description: 'Novo access token gerado com sucesso.',
  })
  @ApiResponse({
    status: 401,
    description: 'Refresh token inválido ou não encontrado.',
  })
  refresh(@Body() dto: RefreshDto) {
    return this.authService.refresh(dto.refreshToken);
  }
}
