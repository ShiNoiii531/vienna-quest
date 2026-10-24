CREATE TABLE `quest_photos` (
	`mission_id` text PRIMARY KEY NOT NULL,
	`id` text NOT NULL,
	`object_key` text NOT NULL,
	`content_type` text NOT NULL,
	`bytes` integer NOT NULL,
	`uploaded_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `quest_photos_id_unique` ON `quest_photos` (`id`);