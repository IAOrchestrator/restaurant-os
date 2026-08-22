import { RawMaterial, UnitOfMeasure } from '@restaurant-os/domain';
import { RawMaterialRepository } from '@restaurant-os/application';
import { prisma } from './prisma-client';

export class PrismaRawMaterialRepository implements RawMaterialRepository {
  async findById(id: string): Promise<RawMaterial | null> {
    const record = await prisma.rawMaterial.findUnique({
      where: { id },
    });
    if (!record) return null;
    return this.mapToDomain(record);
  }

  async findByRestaurantId(restaurantId: string): Promise<RawMaterial[]> {
    const records = await prisma.rawMaterial.findMany({
      where: { restaurantId },
      orderBy: { name: 'asc' },
    });
    return records.map((r) => this.mapToDomain(r));
  }

  async findLowStockByRestaurantId(restaurantId: string): Promise<RawMaterial[]> {
    const all = await this.findByRestaurantId(restaurantId);
    return all.filter((r) => r.isLowStock());
  }

  async save(rawMaterial: RawMaterial): Promise<void> {
    await prisma.rawMaterial.upsert({
      where: { id: rawMaterial.id },
      create: {
        id: rawMaterial.id,
        restaurantId: rawMaterial.restaurantId,
        name: rawMaterial.name,
        unit: rawMaterial.unit,
        currentStock: rawMaterial.currentStock,
        minStockAlert: rawMaterial.minStockAlert,
        unitCost: rawMaterial.unitCost,
        createdAt: rawMaterial.createdAt,
        updatedAt: rawMaterial.updatedAt,
      },
      update: {
        name: rawMaterial.name,
        unit: rawMaterial.unit,
        currentStock: rawMaterial.currentStock,
        minStockAlert: rawMaterial.minStockAlert,
        unitCost: rawMaterial.unitCost,
        updatedAt: rawMaterial.updatedAt,
      },
    });
  }

  async saveMany(rawMaterials: RawMaterial[]): Promise<void> {
    for (const rm of rawMaterials) {
      await this.save(rm);
    }
  }

  async delete(id: string): Promise<void> {
    await prisma.rawMaterial.delete({
      where: { id },
    });
  }

  private mapToDomain(record: any): RawMaterial {
    return new RawMaterial({
      id: record.id,
      restaurantId: record.restaurantId,
      name: record.name,
      unit: record.unit as UnitOfMeasure,
      currentStock: Number(record.currentStock),
      minStockAlert: Number(record.minStockAlert),
      unitCost: Number(record.unitCost),
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }
}
