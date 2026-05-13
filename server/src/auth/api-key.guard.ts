import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { SKIP_API_KEY } from './decorators/skip-api-key.decorator';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly configService: ConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_API_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (skip) return true;

    const request = context.switchToHttp().getRequest<Request>();

    if (request.headers['authorization']?.startsWith('Bearer ')) {
      return true;
    }

    const apiKey = request.headers['apikey'];
    const expectedKey = this.configService.get<string>('API_KEY');

    if (!apiKey || apiKey !== expectedKey) {
      throw new UnauthorizedException('API key inválida ou ausente');
    }

    return true;
  }
}
