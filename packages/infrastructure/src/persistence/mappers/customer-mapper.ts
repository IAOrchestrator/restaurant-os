import { Customer } from '@restaurant-os/domain';
import type { Customer as PrismaCustomer } from '@restaurant-os/database';

export class CustomerMapper {
  static toDomain(prismaCustomer: PrismaCustomer): Customer | null {
    const result = Customer.create({
      id: prismaCustomer.id,
      name: prismaCustomer.name,
      phone: prismaCustomer.phone,
      email: prismaCustomer.email,
      createdAt: prismaCustomer.createdAt,
      updatedAt: prismaCustomer.updatedAt,
    });

    return result.success ? result.value : null;
  }

  static toPrisma(customer: Customer): Omit<PrismaCustomer, 'waitlistEntries' | 'preOrders' | 'orders' | 'reviews'> {
    return {
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
      email: customer.email,
      createdAt: customer.createdAt,
      updatedAt: customer.updatedAt,
    };
  }
}
