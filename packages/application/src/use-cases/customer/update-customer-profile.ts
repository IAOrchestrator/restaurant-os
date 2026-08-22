import { type Customer, type CustomerId } from '@restaurant-os/domain';
import type { CustomerRepository } from '../../ports/customer-repository';

export interface UpdateCustomerProfileInput {
  id: CustomerId;
  name?: string | null;
  phone?: string | null;
  email?: string | null;
}

export class UpdateCustomerProfileUseCase {
  constructor(private readonly customerRepo: CustomerRepository) {}

  async execute(input: UpdateCustomerProfileInput): Promise<Customer> {
    const customer = await this.customerRepo.findById(input.id);
    if (!customer) {
      throw new Error(`Customer not found: ${input.id}`);
    }

    const updateResult = customer.updateProfile({
      name: input.name,
      phone: input.phone,
      email: input.email,
    });

    if (!updateResult.success) {
      throw updateResult.error;
    }

    const updatedCustomer = updateResult.value;
    await this.customerRepo.save(updatedCustomer);
    return updatedCustomer;
  }
}
