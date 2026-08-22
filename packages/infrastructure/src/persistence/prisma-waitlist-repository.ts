import { WaitlistEntry, type WaitlistEntryId } from '@restaurant-os/domain';
import type { WaitlistRepository } from '@restaurant-os/application';
import { prisma } from './prisma-client';
import { WaitlistMapper } from './mappers/waitlist-mapper';

export class PrismaWaitlistRepository implements WaitlistRepository {
  async findById(id: WaitlistEntryId): Promise<WaitlistEntry | null> {
    const prismaEntry = await prisma.waitlistEntry.findUnique({ where: { id } });
    if (!prismaEntry) return null;
    return WaitlistMapper.toDomain(prismaEntry);
  }

  async findByRestaurantId(restaurantId: string): Promise<WaitlistEntry[]> {
    const prismaEntries = await prisma.waitlistEntry.findMany({
      where: { restaurantId },
      orderBy: { enteredAt: 'asc' },
    });
    return prismaEntries
      .map((e) => WaitlistMapper.toDomain(e))
      .filter((e): e is WaitlistEntry => e !== null);
  }

  async findActiveByCustomerId(customerId: string): Promise<WaitlistEntry | null> {
    const prismaEntry = await prisma.waitlistEntry.findFirst({
      where: {
        customerId,
        status: { notIn: ['SEATED', 'CANCELLED', 'TAKEAWAY', 'EXPIRED', 'NO_SHOW'] },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!prismaEntry) return null;
    return WaitlistMapper.toDomain(prismaEntry);
  }

  async save(entry: WaitlistEntry): Promise<void> {
    const data = WaitlistMapper.toPrisma(entry);
    await prisma.waitlistEntry.upsert({
      where: { id: entry.id },
      update: data,
      create: data,
    });
  }

  async delete(id: WaitlistEntryId): Promise<void> {
    await prisma.waitlistEntry.delete({ where: { id } });
  }
}
