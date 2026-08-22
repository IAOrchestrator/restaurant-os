export type UnitOfMeasure = 'KG' | 'G' | 'L' | 'ML' | 'UNIT';

export interface RawMaterialProps {
  id: string;
  restaurantId: string;
  name: string;
  unit: UnitOfMeasure;
  currentStock: number;
  minStockAlert: number;
  unitCost: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export class RawMaterial {
  public readonly id: string;
  public readonly restaurantId: string;
  public name: string;
  public unit: UnitOfMeasure;
  public currentStock: number;
  public minStockAlert: number;
  public unitCost: number;
  public readonly createdAt: Date;
  public updatedAt: Date;

  constructor(props: RawMaterialProps) {
    if (!props.id) throw new Error('RawMaterial ID is required');
    if (!props.restaurantId) throw new Error('Restaurant ID is required');
    if (!props.name || props.name.trim() === '') throw new Error('RawMaterial name is required');
    if (props.currentStock < 0) throw new Error('Current stock cannot be negative');
    if (props.minStockAlert < 0) throw new Error('Min stock alert cannot be negative');
    if (props.unitCost < 0) throw new Error('Unit cost cannot be negative');

    this.id = props.id;
    this.restaurantId = props.restaurantId;
    this.name = props.name.trim();
    this.unit = props.unit;
    this.currentStock = props.currentStock;
    this.minStockAlert = props.minStockAlert;
    this.unitCost = props.unitCost;
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
  }

  public deduct(amount: number): { isBelowMinAlert: boolean; newStock: number } {
    if (amount < 0) throw new Error('Deduction amount cannot be negative');
    this.currentStock = Math.max(0, this.currentStock - amount);
    this.updatedAt = new Date();
    return {
      isBelowMinAlert: this.currentStock <= this.minStockAlert,
      newStock: this.currentStock,
    };
  }

  public restock(amount: number): number {
    if (amount <= 0) throw new Error('Restock amount must be positive');
    this.currentStock += amount;
    this.updatedAt = new Date();
    return this.currentStock;
  }

  public isLowStock(): boolean {
    return this.currentStock <= this.minStockAlert;
  }
}
