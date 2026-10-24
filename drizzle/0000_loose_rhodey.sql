CREATE TABLE `quest_details` (
	`mission_id` text PRIMARY KEY NOT NULL,
	`data` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `quest_progress` (
	`mission_id` text PRIMARY KEY NOT NULL,
	`revealed` integer DEFAULT 0 NOT NULL,
	`completed` integer DEFAULT 0 NOT NULL,
	`updated_at` text NOT NULL
);
