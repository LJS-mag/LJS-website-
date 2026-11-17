import type { RepoCfg } from './crypto';

/* Minimal GitHub client: read files, make one commit containing many files, and watch the build.
   Uses the Git Data API so an issue with 30 page images is a single commit (and a single site rebuild). */

export type FileChange = { path: string; text?: string; b64?: string; del?: boolean };

export const utf8ToB64 = (s: string) => {
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
};

export class GitHub {
  constructor(public cfg: RepoCfg, private token: string) {}
  private get root() {
    return `${this.cfg.api}/repos/${this.cfg.owner}/${this.cfg.name}`;
  }
  private async req(path: string, init: RequestInit = {}, accept = 'application/vnd.github+json') {
    const res = await fetch(this.root + path, {
      ...init,
      cache: 'no-store',
      headers: { Authorization: `Bearer ${this.token}`, Accept: accept, 'X-GitHub-Api-Version': '2022-11-28', ...(init.body ? { 'Content-Type': 'application/json' } : {}) },
    });
    if (!res.ok) {
      let msg = res.statusText;
      try { msg = (await res.json()).message || msg; } catch { /* ignore */ }
      const err: Error & { auth?: boolean } = new Error(res.status === 401 ? 'GitHub no longer accepts the saved token. It has most likely expired. Press Lock, choose "Set this device up again", and paste a new token.' : res.status === 403 ? `GitHub refused: ${msg}` : res.status === 404 ? `Not found: ${path}` : `${res.status} ${msg}`);
      if (res.status === 401) err.auth = true; // lets the admin show the renewal steps
      throw err;
    }
    return res;
  }

  async verify() {
    const r = await (await this.req('')).json();
    if (!r.permissions?.push) throw new Error('This token can read the repository but not write to it. It needs "Contents: Read and write".');
    return r as { full_name: string; html_url: string };
  }
  async head(): Promise<string> {
    return (await (await this.req(`/git/ref/heads/${this.cfg.branch}`)).json()).object.sha;
  }
  /** Raw text of a file on the branch, or null if it does not exist. */
  async getText(path: string): Promise<string | null> {
    try {
      return await (await this.req(`/contents/${encodeURI(path)}?ref=${this.cfg.branch}`, {}, 'application/vnd.github.raw+json')).text();
    } catch (e: any) {
      if (String(e.message).startsWith('Not found')) return null;
      throw e;
    }
  }
  async list(path: string): Promise<{ name: string; path: string; type: string }[]> {
    try {
      return await (await this.req(`/contents/${encodeURI(path)}?ref=${this.cfg.branch}`)).json();
    } catch (e: any) {
      if (String(e.message).startsWith('Not found')) return [];
      throw e;
    }
  }

  /** One commit with all the changes. Fails if someone else changed the branch since `expectedHead`. */
  async commit(changes: FileChange[], message: string, expectedHead: string, onProgress?: (done: number, total: number) => void): Promise<string> {
    const head = await this.head();
    if (head !== expectedHead) throw new Error('The site was changed somewhere else since you opened this page. Reload the admin, then make your change again.');
    const baseTree = (await (await this.req(`/git/commits/${head}`)).json()).tree.sha;
    const tree: any[] = [];
    let done = 0;
    const adds = changes.filter((c) => !c.del);
    const queue = [...adds];
    const worker = async () => {
      for (let c = queue.shift(); c; c = queue.shift()) {
        const content = c.b64 ?? utf8ToB64(c.text ?? '');
        const blob = await (await this.req('/git/blobs', { method: 'POST', body: JSON.stringify({ content, encoding: 'base64' }) })).json();
        tree.push({ path: c.path, mode: '100644', type: 'blob', sha: blob.sha });
        onProgress?.(++done, adds.length);
      }
    };
    await Promise.all([worker(), worker(), worker(), worker()]);
    for (const c of changes.filter((c) => c.del)) tree.push({ path: c.path, mode: '100644', type: 'blob', sha: null });
    const newTree = await (await this.req('/git/trees', { method: 'POST', body: JSON.stringify({ base_tree: baseTree, tree }) })).json();
    const commit = await (await this.req('/git/commits', { method: 'POST', body: JSON.stringify({ message, tree: newTree.sha, parents: [head] }) })).json();
    await this.req(`/git/refs/heads/${this.cfg.branch}`, { method: 'PATCH', body: JSON.stringify({ sha: commit.sha }) });
    return commit.sha as string;
  }

  /** Status of the site build for a commit: waiting, building, live, failed. */
  async build(sha?: string): Promise<{ state: 'none' | 'building' | 'live' | 'failed'; url?: string }> {
    const q = sha ? `?head_sha=${sha}&per_page=3` : '?per_page=1';
    const runs = (await (await this.req('/actions/runs' + q)).json()).workflow_runs as any[];
    const r = runs?.[0];
    if (!r) return { state: 'none' };
    if (r.status !== 'completed') return { state: 'building', url: r.html_url };
    return { state: r.conclusion === 'success' ? 'live' : 'failed', url: r.html_url };
  }
}
