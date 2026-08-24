import { Account, type AccountId } from '@restaurant-os/domain';
import type { AccountRepository } from '@restaurant-os/application';
import { PrismaClient, Prisma } from '@restaurant-os/database';
import { prisma } from './prisma-client';
import { AccountMapper } from './mappers/account-mapper';

export class PrismaAccountRepository implements AccountRepository {
  constructor(
    private readonly db: PrismaClient | Prisma.TransactionClient = prisma,
  ) {}

  async findById(id: AccountId): Promise<Account | null> {
    const prismaAccount = await this.db.account.findUnique({
      where: { id },
      include: { payments: true },
    });
    if (!prismaAccount) return null;
    return AccountMapper.toDomain(prismaAccount);
  }

  async findByTableSessionId(tableSessionId: string): Promise<Account | null> {
    const prismaAccount = await this.db.account.findFirst({
      where: { tableSessionId },
      include: { payments: true },
    });
    if (!prismaAccount) return null;
    return AccountMapper.toDomain(prismaAccount);
  }

  async findByRestaurantId(restaurantId: string): Promise<Account[]> {
    const prismaAccounts = await this.db.account.findMany({
      where: { restaurantId },
      include: { payments: true },
      orderBy: { createdAt: 'desc' },
    });
    return prismaAccounts
      .map((a) => AccountMapper.toDomain(a))
      .filter((a): a is Account => a !== null);
  }

  async save(account: Account): Promise<void> {
    const data = AccountMapper.toPrisma(account);
    await this.db.account.upsert({
      where: { id: account.id },
      update: data,
      create: data,
    });
  }
}
