import type { GitHub } from './github';
/** The signed-in GitHub client, set once the PIN is accepted. Held in memory only. */
export const ctx: { gh: GitHub | null; lastSha: string } = { gh: null, lastSha: '' };
