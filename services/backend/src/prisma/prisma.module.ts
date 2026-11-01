import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { ScopedPrisma } from './scoped-prisma.service';

@Global()
@Module({
  providers: [PrismaService, ScopedPrisma],
  exports: [PrismaService, ScopedPrisma],
})
export class PrismaModule {}
