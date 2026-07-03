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

/** Look up a customer by phone (normalised). Phone, not name, is the identity key. */
export async function findCustomerByPhone(phone: string): Promise<Customer | undefined> {
  const normalised = normalisePhone(phone);
  if (!normalised) return undefined;
  const matches = await customerCollection().query(Q.where('phone', normalised)).fetch();
  return matches[0];
}

/**
 * Find an existing customer by phone, or create a new one. Duplicate customer *names*
 * are expected and must not cause duplicate records — phone is the match key.
 */
export async function findOrCreateCustomer(input: CustomerInput): Promise<Customer> {
  const existing = input.phone ? await findCustomerByPhone(input.phone) : undefined;
  if (existing) return existing;
  return createCustomer(input);
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
