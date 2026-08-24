import { Table, type TableId } from '@restaurant-os/domain';
import type { TableRepository } from '@restaurant-os/application';
import { PrismaClient, Prisma } from '@restaurant-os/database';
import { prisma } from './prisma-client';
import { TableMapper } from './mappers/table-mapper';

export class PrismaTableRepository implements TableRepository {
  constructor(
    private readonly db: PrismaClient | Prisma.TransactionClient = prisma,
  ) {}

  async findById(id: TableId): Promise<Table | null> {
    const prismaTable = await this.db.table.findUnique({ where: { id } });
    if (!prismaTable) return null;
    return TableMapper.toDomain(prismaTable);
  }

  async findByRestaurantId(restaurantId: string): Promise<Table[]> {
    const prismaTables = await this.db.table.findMany({ where: { restaurantId } });
    return prismaTables
      .map((t) => TableMapper.toDomain(t))
      .filter((t): t is Table => t !== null);
  }

  async save(table: Table): Promise<void> {
    const data = TableMapper.toPrisma(table);
    await this.db.table.upsert({
      where: { id: table.id },
      update: data,
      create: data,
    });
  }

  async delete(id: TableId): Promise<void> {
    await this.db.table.delete({ where: { id } });
  }
}
