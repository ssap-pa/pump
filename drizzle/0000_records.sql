CREATE TABLE `records` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`kind` text NOT NULL,
	`parent` text DEFAULT '' NOT NULL,
	`data` text NOT NULL,
	`created` text NOT NULL
);

--> statement-breakpoint
CREATE INDEX `records_owner_kind` ON `records` (`owner`,`kind`);
--> statement-breakpoint
CREATE INDEX `records_owner_parent` ON `records` (`owner`,`parent`);