import { Test } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { PrismaService } from '../prisma/prisma.service';

describe('HealthController', () => {
  it('reports process up on /health', async () => {
    const module = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [{ provide: PrismaService, useValue: { $queryRaw: jest.fn() } }],
    }).compile();

    const controller = module.get(HealthController);
    expect(controller.up()).toEqual({ status: 'ok' });
  });
});
