import { type Customer, type CustomerId } from '@restaurant-os/domain';
import type { CustomerRepository } from '../../ports/customer-repository';

export class GetCustomerUseCase {
  constructor(private readonly customerRepo: CustomerRepository) {}

  async execute(id: CustomerId): Promise<Customer | null> {
    return this.customerRepo.findById(id);
  }
}
