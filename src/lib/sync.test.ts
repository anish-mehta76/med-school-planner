import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { backupOf, defaultState, getState, replaceFromSync, setState } from '../store/useStore';
import { _resetForTests, connect, DATA_PATH, fromBase64, getConfig, getSyncStatus, resolveConflict, startSync, SYNC_KEY, syncNow, toBase64 } from './sync';

const TOKEN = 'github_pat_TEST_ONLY_not_real';
const NOTE = 'Hindi हिन्दी · Català · “quotes”';

/** A tiny stand-in for GitHub's contents API holding one file. */
function fakeGitHub(opts: { private?: boolean } = {}) {
  const repo = { private: opts.private ?? true };
  let file: { sha: string; text: string } | undefined;
  let n = 0;
  const calls: string[] = [];
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  const fetchMock = vi.fn(async (url: string, init: RequestInit = {}) => {
    const method = init.method ?? 'GET';
    calls.push(`${method} ${url}`);
    expect((init.headers as Record<string, string>).Authorization).toBe(`Bearer ${TOKEN}`);
    if (url.endsWith('/repos/me/data')) return json(repo);
    if (!url.endsWith(`/contents/${DATA_PATH}`)) return json({}, 404);
    if (method === 'GET') return file ? json({ sha: file.sha, encoding: 'base64', content: toBase64(file.text) }) : json({}, 404);
    const body = JSON.parse(init.body as string) as { content: string; sha?: string };
    if (file && body.sha !== file.sha) return json({ message: 'sha mismatch' }, 409);
    file = { sha: `sha${++n}`, text: fromBase64(body.content) };
    return json({ content: { sha: file.sha } }, file && n === 1 ? 201 : 200);
  });
  return {
    fetchMock,
    calls,
    file: () => file,
    /** Simulates the other device saving. */
    otherDeviceSaves(name: string) {
      const data = { ...defaultState(), profile: { ...defaultState().profile, name } };
      file = { sha: `sha${++n}`, text: JSON.stringify({ format: 1, updatedAt: '2026-10-15T12:00:00Z', device: 'iPhone', data }) };
    },
  };
}

function memoryStorage() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
  };
}

let gh: ReturnType<typeof fakeGitHub>;

beforeAll(() => {
  vi.stubGlobal('document', { addEventListener() {} });
  vi.stubGlobal('window', { addEventListener() {} });
});

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('localStorage', memoryStorage());
  gh = fakeGitHub();
  vi.stubGlobal('fetch', gh.fetchMock);
  replaceFromSync(defaultState());
  _resetForTests();
  startSync();
});

const editName = (name: string) => setState((s) => ({ ...s, profile: { ...s.profile, name } }));

describe('sync with a private GitHub repo', () => {
  it('refuses a public repo and saves nothing', async () => {
    gh = fakeGitHub({ private: false });
    vi.stubGlobal('fetch', gh.fetchMock);
    await connect('me', 'data', TOKEN);
    expect(getSyncStatus()).toMatchObject({ kind: 'error', message: expect.stringMatching(/public/) });
    expect(getConfig()).toBeUndefined();
  });

  it('pushes this device’s data to an empty repo, keeping UTF-8 text intact', async () => {
    setState((s) => ({ ...s, outreach: { R01: { status: 'sent', notes: NOTE } } }));
    await connect('me', 'data', TOKEN);
    expect(getSyncStatus().kind).toBe('idle');
    const saved = JSON.parse(gh.file()!.text);
    expect(saved.data.outreach.R01.notes).toBe(NOTE);
    expect(getConfig()).toMatchObject({ lastSha: 'sha1', dirty: false });
  });

  it('takes the other device’s data when this one has no unsynced edits', async () => {
    await connect('me', 'data', TOKEN);
    gh.otherDeviceSaves('From phone');
    await syncNow();
    expect(getState().profile.name).toBe('From phone');
    expect(getConfig()?.dirty).toBe(false);
  });

  it('a pristine device joining takes the existing data without asking', async () => {
    gh.otherDeviceSaves('From Mac');
    await connect('me', 'data', TOKEN);
    expect(getState().profile.name).toBe('From Mac');
  });

  it('asks when both devices changed, and keeping this device’s overwrites GitHub', async () => {
    await connect('me', 'data', TOKEN);
    editName('From Mac');
    gh.otherDeviceSaves('From phone');
    await syncNow();
    expect(getSyncStatus()).toMatchObject({ kind: 'conflict', remoteDevice: 'iPhone' });
    expect(getState().profile.name).toBe('From Mac');
    await resolveConflict('this');
    expect(JSON.parse(gh.file()!.text).data.profile.name).toBe('From Mac');
    expect(getSyncStatus().kind).toBe('idle');
  });

  it('can take the other device’s copy instead', async () => {
    await connect('me', 'data', TOKEN);
    editName('From Mac');
    gh.otherDeviceSaves('From phone');
    await syncNow();
    await resolveConflict('other');
    expect(getState().profile.name).toBe('From phone');
  });

  it('turns a rejected push (other device saved first) into a question, not an overwrite', async () => {
    await connect('me', 'data', TOKEN);
    editName('From Mac');
    // The phone saves between our pull and our push.
    const realFetch = gh.fetchMock.getMockImplementation()!;
    gh.fetchMock.mockImplementationOnce(async (url, init) => {
      const r = await realFetch(url, init);
      gh.otherDeviceSaves('From phone');
      return r;
    });
    // Our pull saw the old sha, so the push uses it and gets a 409.
    await syncNow();
    expect(gh.calls.some((c) => c.startsWith('PUT'))).toBe(true);
    expect(getSyncStatus().kind).toBe('conflict');
    expect(JSON.parse(gh.file()!.text).data.profile.name).toBe('From phone');
  });

  it('pushes edits a few seconds after you stop typing', async () => {
    await connect('me', 'data', TOKEN);
    editName('Anish');
    expect(getConfig()?.dirty).toBe(true);
    await vi.advanceTimersByTimeAsync(3500);
    await syncNow();
    expect(JSON.parse(gh.file()!.text).data.profile.name).toBe('Anish');
    expect(getConfig()?.dirty).toBe(false);
  });

  it('never puts the token in the planner data or a backup', async () => {
    await connect('me', 'data', TOKEN);
    expect(JSON.stringify(backupOf(getState()))).not.toContain(TOKEN);
    expect(gh.file()!.text).not.toContain(TOKEN);
    expect(localStorage.getItem(SYNC_KEY)).toContain(TOKEN);
  });
});
