import { Account, type AccountId } from '@restaurant-os/domain';
import type { AccountRepository } from '@restaurant-os/application';
import { prisma } from './prisma-client';
import { AccountMapper } from './mappers/account-mapper';

export class PrismaAccountRepository implements AccountRepository {
  async findById(id: AccountId): Promise<Account | null> {
    const prismaAccount = await prisma.account.findUnique({
      where: { id },
      include: { payments: true },
    });
    if (!prismaAccount) return null;
    return AccountMapper.toDomain(prismaAccount);
  }

  async findByTableSessionId(tableSessionId: string): Promise<Account | null> {
    const prismaAccount = await prisma.account.findFirst({
      where: { tableSessionId },
      include: { payments: true },
    });
    if (!prismaAccount) return null;
    return AccountMapper.toDomain(prismaAccount);
  }

  async findByRestaurantId(restaurantId: string): Promise<Account[]> {
    const prismaAccounts = await prisma.account.findMany({
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
    await prisma.account.upsert({
      where: { id: account.id },
      update: data,
      create: data,
    });
  }
}
