import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { RequestActor } from './actor';

/** Access the verified request actor from any injectable. */
@Injectable()
export class ActorContextService {
  constructor(private readonly cls: ClsService) {}

  get actor(): RequestActor {
    const actor = this.cls.get<RequestActor>('actor');
    if (!actor) {
      throw new InternalServerErrorException('request actor not set');
    }
    return actor;
  }
}
