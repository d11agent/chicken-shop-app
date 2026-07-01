import { Q } from '@nozbe/watermelondb';
import type { Query } from '@nozbe/watermelondb';

import { database } from '../../db';
import { Customer } from '../../db/models';
import { TableName } from '../../db/constants';

const customerCollection = () => database.get<Customer>(TableName.customers);

export interface CustomerInput {
  name: string;
  phone?: string;
  tag?: string;
}

/** Reactive list of customers, most-recent first. */
export function observeCustomers(): Query<Customer> {
  return customerCollection().query(Q.sortBy('created_at', Q.desc));
}

export function listCustomers(): Promise<Customer[]> {
  return observeCustomers().fetch();
}

export function getCustomer(id: string): Promise<Customer> {
  return customerCollection().find(id);
}

/** Normalise a phone to digits only (keeps a leading +). Empty -> undefined. */
export function normalisePhone(phone?: string): string | undefined {
  if (!phone) return undefined;
  const cleaned = phone.replace(/[^\d+]/g, '');
  return cleaned.length > 0 ? cleaned : undefined;
}

export function createCustomer(input: CustomerInput): Promise<Customer> {
  return database.write(async () =>
    customerCollection().create((c) => {
      c.name = input.name.trim();
      c.phone = normalisePhone(input.phone);
      c.tag = input.tag?.trim() || undefined;
    }),
  );
}

export interface CustomerPatch {
  name?: string;
  phone?: string;
  tag?: string;
}

export function updateCustomer(customer: Customer, patch: CustomerPatch): Promise<Customer> {
  return database.write(async () =>
    customer.update((c) => {
      if (patch.name !== undefined) c.name = patch.name.trim();
      if (patch.phone !== undefined) c.phone = normalisePhone(patch.phone);
      if (patch.tag !== undefined) c.tag = patch.tag.trim() || undefined;
    }),
  );
}
