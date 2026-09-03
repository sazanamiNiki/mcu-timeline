// 端末間同期。sync-worker/（Cloudflare Worker + KV）を介して
// 視聴済みとウォッチリストを last-write-wins で共有する。DOM には依存しない。

export const CODE_RE = /^[a-z0-9-]{8,64}$/;
export const SYNC_META_KEY = 'mcu-sync';
// デプロイ後に Worker の URL に置き換える
export const SYNC_ENDPOINT = 'https://mcu-sync.thegardenas.workers.dev/sync';

export function newSyncCode() {
  return `mcu-${crypto.randomUUID()}`;
}

function safeDecode(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/** 入力欄の値から同期コードを取り出す。#sync= 付きリンクでも生コードでもよい。 */
export function codeFromInput(text) {
  const raw = (text ?? '').trim();
  const marker = raw.indexOf('#sync=');
  const candidate = safeDecode(marker >= 0 ? raw.slice(marker + '#sync='.length) : raw).trim();
  return CODE_RE.test(candidate) ? candidate : null;
}

/** 同期ペイロードの検証。形が違えば null。文字列以外の id は捨てる。 */
export function parseState(value) {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  if (!Array.isArray(value.watched) || !Array.isArray(value.list) || typeof value.updatedAt !== 'number') return null;
  const strings = (xs) => xs.filter((x) => typeof x === 'string');
  return { watched: strings(value.watched), list: strings(value.list), updatedAt: value.updatedAt };
}

/** updatedAt が新しい方を返す。null は相手に譲り、同値は前者（ローカル）を優先。 */
export function pickNewer(a, b) {
  if (!a) return b ?? null;
  if (!b) return a;
  return b.updatedAt > a.updatedAt ? b : a;
}

function readMeta(storage) {
  try {
    const raw = storage?.getItem(SYNC_META_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (typeof parsed !== 'object' || parsed === null) return { code: null, updatedAt: 0 };
    return {
      code: typeof parsed.code === 'string' && CODE_RE.test(parsed.code) ? parsed.code : null,
      updatedAt: typeof parsed.updatedAt === 'number' ? parsed.updatedAt : 0,
    };
  } catch {
    return { code: null, updatedAt: 0 };
  }
}

/**
 * 同期エンジン。
 * - markDirty(): ローカル変更後に呼ぶ。updatedAt を進め、少し待って push する
 * - pull(): リモートが新しければ store/list を置き換え、onApply() を呼ぶ
 * - enable()/join(code)/disable(): 同期コードの発行・参加・解除
 */
export function createSync({ storage, store, list, onApply, endpoint = SYNC_ENDPOINT, fetcher = globalThis.fetch }) {
  const meta = readMeta(storage);
  let pushTimer = null;

  function saveMeta() {
    try {
      storage?.setItem(SYNC_META_KEY, JSON.stringify(meta));
    } catch {
      /* 保存できなくても動作は続ける */
    }
  }

  async function push() {
    if (!meta.code) return;
    const body = JSON.stringify({ watched: store.ids(), list: list.ids(), updatedAt: meta.updatedAt });
    try {
      await fetcher(`${endpoint}/${meta.code}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body,
      });
    } catch {
      /* オフライン時は次の変更か pull 時に再送される */
    }
  }

  function schedulePush() {
    if (!meta.code) return;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(push, 800);
  }

  return {
    get code() {
      return meta.code;
    },
    markDirty() {
      meta.updatedAt = Date.now();
      saveMeta();
      schedulePush();
    },
    async pull() {
      if (!meta.code) return false;
      let remote = null;
      try {
        const res = await fetcher(`${endpoint}/${meta.code}`);
        if (res.ok) remote = parseState(await res.json());
      } catch {
        return false;
      }
      const local = { watched: store.ids(), list: list.ids(), updatedAt: meta.updatedAt };
      if (pickNewer(local, remote) !== remote) {
        schedulePush(); // ローカルの方が新しければリモートを追い付かせる
        return false;
      }
      store.reset(remote.watched);
      list.reset(remote.list);
      meta.updatedAt = remote.updatedAt;
      saveMeta();
      if (onApply) onApply();
      return true;
    },
    enable() {
      meta.code = newSyncCode();
      meta.updatedAt = Date.now();
      saveMeta();
      push();
      return meta.code;
    },
    async join(code) {
      if (!CODE_RE.test(code)) return false;
      meta.code = code;
      saveMeta();
      const applied = await this.pull();
      if (!applied) {
        this.markDirty(); // リモートが空か古い → 手元の状態を上げる
      }
      return true;
    },
    disable() {
      meta.code = null;
      saveMeta();
    },
  };
}
