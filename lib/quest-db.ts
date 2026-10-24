import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '@/app/chatgpt-auth';
export function questDb(){if(!env.DB)throw new Error('Sauvegarde indisponible');return env.DB;}
export function questBucket(){if(!env.BUCKET)throw new Error('Photos indisponibles');return env.BUCKET;}
export async function identity(){const user=await getChatGPTUser();if(!user)return null;const configured=(env as unknown as {ORGANIZER_EMAIL?:string}).ORGANIZER_EMAIL||process.env.ORGANIZER_EMAIL;return {user,role:configured&&user.email.toLowerCase()===configured.toLowerCase()?'organizer' as const:'explorer' as const};}
