import { Customer, type CustomerId } from '@restaurant-os/domain';
import type { CustomerRepository } from '@restaurant-os/application';
import { prisma } from './prisma-client';
import { CustomerMapper } from './mappers/customer-mapper';

export class PrismaCustomerRepository implements CustomerRepository {
  async findById(id: CustomerId): Promise<Customer | null> {
    const prismaCustomer = await prisma.customer.findUnique({
      where: { id },
    });
    if (!prismaCustomer) return null;
    return CustomerMapper.toDomain(prismaCustomer);
  }

  async findByEmail(email: string): Promise<Customer | null> {
    const prismaCustomer = await prisma.customer.findFirst({
      where: { email },
    });
    if (!prismaCustomer) return null;
    return CustomerMapper.toDomain(prismaCustomer);
  }

  async findByPhone(phone: string): Promise<Customer | null> {
    const prismaCustomer = await prisma.customer.findFirst({
      where: { phone },
    });
    if (!prismaCustomer) return null;
    return CustomerMapper.toDomain(prismaCustomer);
  }

  async save(customer: Customer): Promise<void> {
    const data = CustomerMapper.toPrisma(customer);
    await prisma.customer.upsert({
      where: { id: customer.id },
      update: data as any,
      create: data as any,
    });
  }

  async delete(id: CustomerId): Promise<void> {
    await prisma.customer.delete({
      where: { id },
    });
  }
}
