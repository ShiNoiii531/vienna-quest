import { sqliteTable, text, integer, index, check } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
export const progress=sqliteTable('quest_progress',{missionId:text('mission_id').primaryKey(),revealed:integer('revealed').notNull().default(0),completed:integer('completed').notNull().default(0),updatedAt:text('updated_at').notNull()});
export const details=sqliteTable('quest_details',{missionId:text('mission_id').primaryKey(),data:text('data').notNull(),updatedAt:text('updated_at').notNull()});
export const photos=sqliteTable('quest_photos',{missionId:text('mission_id').primaryKey(),id:text('id').notNull().unique(),objectKey:text('object_key').notNull(),contentType:text('content_type').notNull(),bytes:integer('bytes').notNull(),uploadedAt:text('uploaded_at').notNull(),originalKey:text('original_key'),originalContentType:text('original_content_type'),originalBytes:integer('original_bytes'),originalName:text('original_name'),originalLastModified:integer('original_last_modified')});
// A separate append-only album leaves the original single-photo quests untouched.
export const memories=sqliteTable('quest_memories',{
  id:text('id').primaryKey(),missionId:text('mission_id').notNull(),comment:text('comment').notNull(),
  objectKey:text('object_key').notNull(),bytes:integer('bytes').notNull(),uploadedAt:text('uploaded_at').notNull(),
  originalKey:text('original_key').notNull(),originalContentType:text('original_content_type').notNull(),
  originalBytes:integer('original_bytes').notNull(),originalName:text('original_name').notNull(),originalLastModified:integer('original_last_modified')
},table=>[
  index('quest_memories_mission_date_idx').on(table.missionId,table.uploadedAt),
  check('quest_memories_comment_required',sql`length(trim(${table.comment})) BETWEEN 1 AND 1000`)
]);
