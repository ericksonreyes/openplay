import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ClsService } from 'nestjs-cls';
import type { Request } from 'express';
import { IS_PUBLIC } from './public.decorator';
import { REQUIRED_PERMISSIONS } from './require-permissions.decorator';
import { publicActor } from './actor';
import { JwtService } from './jwt.service';
import { TokenBlacklistService } from './token-blacklist.service';
import { unwrapJsonApiBody } from '../jsonapi/jsonapi-body.middleware';

/** Global default-deny guard: signature → iss/aud/exp → claims → permission policy. */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly blacklist: TokenBlacklistService,
    private readonly cls: ClsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    unwrapJsonApiBody(context.switchToHttp().getRequest<Request>());
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      this.cls.set('actor', publicActor());
      return true;
    }

    const req = context.switchToHttp().getRequest<Request>();
    const header = req.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
    const actor = token ? await this.jwt.verify(token) : null;
    if (!actor || (await this.blacklist.isRevoked(actor.jti))) {
      throw new UnauthorizedException('Authentication required');
    }
    this.cls.set('actor', actor);

    const required = this.reflector.getAllAndOverride<string[]>(REQUIRED_PERMISSIONS, [
      context.getHandler(),
      context.getClass(),
    ]) ?? [];
    if (required.length && !required.every((p) => actor.permissions.includes(p))) {
      throw new ForbiddenException('Insufficient permissions');
    }
    return true;
  }
}
