import type { QuestMemory } from './quest-types';
export const MAX_MEMORY_COMMENT = 1000;
export function normalizeMemoryComment(value:unknown):string|null {
  if(typeof value!=='string')return null;
  const comment=value.trim();
  return comment.length>0&&comment.length<=MAX_MEMORY_COMMENT?comment:null;
}
export type MemorySummary = {id:string;mission_id:string;comment:string;uploaded_at:string;original_name:string};
export function memoryInfo(row:MemorySummary):QuestMemory {
  const url=`/api/memories?mission=${encodeURIComponent(row.mission_id)}&photo=${encodeURIComponent(row.id)}`;
  return {id:row.id,url,comment:row.comment,uploadedAt:row.uploaded_at,originalUrl:`${url}&original=1`,originalName:row.original_name};
}
