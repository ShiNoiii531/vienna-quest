CREATE TABLE `quest_memories` (
	`id` text PRIMARY KEY NOT NULL,
	`mission_id` text NOT NULL,
	`comment` text NOT NULL,
	`object_key` text NOT NULL,
	`bytes` integer NOT NULL,
	`uploaded_at` text NOT NULL,
	`original_key` text NOT NULL,
	`original_content_type` text NOT NULL,
	`original_bytes` integer NOT NULL,
	`original_name` text NOT NULL,
	`original_last_modified` integer,
	CONSTRAINT "quest_memories_comment_required" CHECK(length(trim("quest_memories"."comment")) BETWEEN 1 AND 1000)
);
--> statement-breakpoint
CREATE INDEX `quest_memories_mission_date_idx` ON `quest_memories` (`mission_id`,`uploaded_at`);