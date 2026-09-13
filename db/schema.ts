import { sqliteTable, text, index, integer } from 'drizzle-orm/sqlite-core';
export const records = sqliteTable('records', { id: text('id').primaryKey(), owner: text('owner').notNull(), kind: text('kind').notNull(), parent: text('parent').notNull().default(''), data: text('data').notNull(), created: text('created').notNull() }, t => [index('records_owner_kind').on(t.owner, t.kind), index('records_owner_parent').on(t.owner, t.parent)]);
// Billing data is deliberately separate from user-editable field records.
export const subscriptions = sqliteTable('subscriptions', {
  owner: text('owner').primaryKey(), data: text('data').notNull(),
  dueAt: integer('due_at').notNull().default(0),
  lockToken: text('lock_token'), lockUntil: integer('lock_until').notNull().default(0),
}, t => [index('subscriptions_due').on(t.dueAt)]);
export const subscriptionPayments = sqliteTable('subscription_payments', {
  orderId: text('order_id').primaryKey(), owner: text('owner').notNull(),
  data: text('data').notNull(), created: integer('created').notNull(),
}, t => [index('subscription_payments_owner').on(t.owner, t.created)]);
