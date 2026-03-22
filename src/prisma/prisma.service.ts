import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '../../generated/prisma/client';
import { agentLog } from '../debug-agent-log';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  async onModuleInit(): Promise<void> {
    // #region agent log
    agentLog({
      runId: 'post-fix',
      hypothesisId: 'H2',
      location: 'prisma.service.ts:onModuleInit',
      message: 'prisma_connect_attempt',
      data: {},
    });
    // #endregion
    try {
      await this.$connect();
      // #region agent log
      agentLog({
        runId: 'post-fix',
        hypothesisId: 'H2',
        location: 'prisma.service.ts:onModuleInit',
        message: 'prisma_connect_ok',
        data: {},
      });
      // #endregion
    } catch (e) {
      // #region agent log
      agentLog({
        runId: 'post-fix',
        hypothesisId: 'H2',
        location: 'prisma.service.ts:onModuleInit',
        message: 'prisma_connect_failed',
        data: {
          name: e instanceof Error ? e.name : 'non-Error',
          message: e instanceof Error ? e.message : String(e),
        },
      });
      // #endregion
      throw e;
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
