import { PrismaClient } from '@restaurant-os/database';
import type { TransactionRunner, TransactionContext } from '@restaurant-os/application';
import { prisma } from './prisma-client';
import { PrismaTableRepository } from './prisma-table-repository';
import { PrismaTableSessionRepository } from './prisma-table-session-repository';
import { PrismaOrderRepository } from './prisma-order-repository';
import { PrismaKitchenOrderRepository } from './prisma-kitchen-order-repository';
import { PrismaAccountRepository } from './prisma-account-repository';

export class PrismaTransactionRunner implements TransactionRunner {
  constructor(private readonly prismaClient: PrismaClient = prisma) {}

  async run<T>(fn: (ctx: TransactionContext) => Promise<T>): Promise<T> {
    return this.prismaClient.$transaction(async (tx) => {
      const context: TransactionContext = {
        tableRepo: new PrismaTableRepository(tx),
        sessionRepo: new PrismaTableSessionRepository(tx),
        orderRepo: new PrismaOrderRepository(tx),
        kitchenOrderRepo: new PrismaKitchenOrderRepository(tx),
        accountRepo: new PrismaAccountRepository(tx),
      };
      return fn(context);
    });
  }
}
