CREATE TABLE `files` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`hash` text NOT NULL,
	`data` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `files_user_hash` ON `files` (`user_id`,`hash`);--> statement-breakpoint
CREATE TABLE `members` (
	`email` text PRIMARY KEY NOT NULL,
	`role` text DEFAULT 'student' NOT NULL,
	`active` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`id` text PRIMARY KEY NOT NULL,
	`data` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `shares` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`recipient` text NOT NULL,
	`data` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `shares_recipient` ON `shares` (`recipient`);--> statement-breakpoint
CREATE TABLE `studies` (
	`user_id` text PRIMARY KEY NOT NULL,
	`data` text NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `usage` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`month` text NOT NULL,
	`created` text NOT NULL,
	`reserved` integer NOT NULL,
	`actual` integer,
	`status` text NOT NULL,
	`model` text NOT NULL,
	`input` integer DEFAULT 0 NOT NULL,
	`output` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `usage_month_user` ON `usage` (`month`,`user_id`);