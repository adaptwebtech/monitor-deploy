import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserQueryDto } from './dto/user-query.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { GithubUserResolutionDto } from './dto/github-user-resolution.dto';

interface AuthedRequest extends Request {
  user: { id: string; email: string; root: boolean };
}

@ApiTags('Usuários')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @ApiOperation({
    summary: 'Criar usuário',
    description: 'Cria um novo usuário no sistema. Requer API key.',
  })
  @ApiResponse({
    status: 201,
    description: 'Usuário criado com sucesso.',
    type: UserResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Dados inválidos.' })
  @ApiResponse({ status: 409, description: 'E-mail já cadastrado.' })
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  @Get()
  @ApiOperation({
    summary: 'Listar usuários',
    description: 'Retorna lista paginada de usuários com filtros opcionais.',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de usuários retornada com sucesso.',
  })
  findAll(@Query() query: UserQueryDto) {
    return this.usersService.findAll(query);
  }

  @Get('by-github/:githubId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Resolve usuário pelo GitHub login' })
  @ApiResponse({ status: 200, type: GithubUserResolutionDto })
  @ApiResponse({ status: 404, description: 'Usuário não encontrado' })
  @ApiResponse({ status: 401, description: 'Não autenticado' })
  async getByGithubId(
    @Param('githubId') githubId: string,
  ): Promise<GithubUserResolutionDto> {
    const result = await this.usersService.findByGithubIdCached(githubId);
    if (!result) throw new NotFoundException('Usuário não encontrado');
    return result;
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Buscar usuário por ID',
    description: 'Retorna os dados de um usuário específico.',
  })
  @ApiResponse({
    status: 200,
    description: 'Usuário encontrado.',
    type: UserResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Usuário não encontrado.' })
  findById(@Param('id') id: string) {
    return this.usersService.findById(id);
  }

  @Patch(':id')
  @ApiBearerAuth('bearer')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Atualizar usuário',
    description:
      'Atualiza dados de um usuário. Apenas root pode editar outros usuários.',
  })
  @ApiResponse({
    status: 200,
    description: 'Usuário atualizado com sucesso.',
    type: UserResponseDto,
  })
  @ApiResponse({
    status: 403,
    description: 'Sem permissão para editar este usuário.',
  })
  @ApiResponse({ status: 404, description: 'Usuário não encontrado.' })
  @ApiResponse({ status: 409, description: 'E-mail já em uso.' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @Req() req: AuthedRequest,
  ) {
    const { user } = req;
    if (!user.root && user.id !== id) {
      throw new ForbiddenException('Sem permissão para editar este usuário');
    }
    return this.usersService.update(id, dto);
  }

  @Delete(':id')
  @ApiBearerAuth('bearer')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Excluir usuário (soft delete)',
    description:
      'Marca o usuário como deletado. Apenas root pode executar esta ação.',
  })
  @ApiResponse({ status: 200, description: 'Usuário removido com sucesso.' })
  @ApiResponse({
    status: 403,
    description: 'Apenas root pode excluir usuários.',
  })
  @ApiResponse({ status: 404, description: 'Usuário não encontrado.' })
  async softDelete(@Param('id') id: string, @Req() req: AuthedRequest) {
    const { user } = req;
    if (!user.root) {
      throw new ForbiddenException('Apenas root pode excluir usuários');
    }
    await this.usersService.softDelete(id);
    return { message: 'Usuário removido com sucesso' };
  }

  @Post(':id/regenerate-token')
  @HttpCode(200)
  @ApiBearerAuth('bearer')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Regenerar refresh token',
    description: 'Gera um novo refresh token para o usuário. Apenas root.',
  })
  @ApiResponse({
    status: 200,
    description: 'Refresh token regenerado com sucesso.',
  })
  @ApiResponse({
    status: 403,
    description: 'Apenas root pode regenerar tokens.',
  })
  @ApiResponse({ status: 404, description: 'Usuário não encontrado.' })
  async regenerateToken(@Param('id') id: string, @Req() req: AuthedRequest) {
    const { user } = req;
    if (!user.root) {
      throw new ForbiddenException('Apenas root pode regenerar tokens');
    }
    const refreshToken = await this.usersService.regenerateToken(id);
    return { refreshToken };
  }
}
