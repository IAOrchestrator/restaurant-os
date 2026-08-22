import { Customer, type CustomerId } from '@restaurant-os/domain';
import type { CustomerRepository } from '../../ports/customer-repository';

export interface CreateCustomerInput {
  id?: CustomerId;
  name?: string | null;
  phone?: string | null;
  email?: string | null;
}

export class CreateCustomerUseCase {
  constructor(private readonly customerRepo: CustomerRepository) {}

  async execute(input: CreateCustomerInput): Promise<Customer> {
    const id = input.id ?? crypto.randomUUID();

    const customerResult = Customer.create({
      id,
      name: input.name,
      phone: input.phone,
      email: input.email,
    });

    if (!customerResult.success) {
      throw customerResult.error;
    }

    const customer = customerResult.value;
    await this.customerRepo.save(customer);
    return customer;
  }
}
