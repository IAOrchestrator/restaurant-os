import { Table, TableStatus } from '@restaurant-os/domain';
import type { Table as PrismaTable } from '@restaurant-os/database';

export class TableMapper {
  static toDomain(prismaTable: PrismaTable): Table | null {
    const result = Table.create({
      id: prismaTable.id,
      restaurantId: prismaTable.restaurantId,
      number: prismaTable.number,
      capacity: prismaTable.capacity,
      status: prismaTable.status as TableStatus,
      createdAt: prismaTable.createdAt,
      updatedAt: prismaTable.updatedAt,
    });

    return result.success ? result.value : null;
  }

  static toPrisma(table: Table): Omit<PrismaTable, 'tableSessions'> {
    return {
      id: table.id,
      restaurantId: table.restaurantId,
      number: table.number,
      capacity: table.capacity,
      status: table.status,
      createdAt: table.createdAt,
      updatedAt: table.updatedAt,
    };
  }
}
