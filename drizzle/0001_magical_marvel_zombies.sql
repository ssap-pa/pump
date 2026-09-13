CREATE TABLE `subscription_payments` (
	`order_id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`data` text NOT NULL,
	`created` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `subscription_payments_owner` ON `subscription_payments` (`owner`,`created`);--> statement-breakpoint
CREATE TABLE `subscriptions` (
	`owner` text PRIMARY KEY NOT NULL,
	`data` text NOT NULL,
	`due_at` integer DEFAULT 0 NOT NULL,
	`lock_token` text,
	`lock_until` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `subscriptions_due` ON `subscriptions` (`due_at`);