import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { Public } from '../common/auth/public.decorator';
import { PrismaService } from '../prisma/prisma.service';

@Controller('health')
@Public()
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  up() {
    return { status: 'ok' };
  }

  @Get('ready')
  async ready() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      throw new ServiceUnavailableException({ status: 'unavailable', database: 'unreachable' });
    }
    return { status: 'ok', database: 'reachable' };
  }
}
