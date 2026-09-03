// 視聴済み・ウォッチリスト同期用の小さな KV 中継。
// GET/PUT /sync/{key} を KV にそのまま読み書きする。key を知らない限り触れない。

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,PUT,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};
const PATH_RE = /^\/sync\/([a-z0-9-]{8,64})$/;
const MAX_BYTES = 4096;

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    const match = new URL(request.url).pathname.match(PATH_RE);
    if (!match) return json({ error: 'not found' }, 404);
    const key = match[1];

    if (request.method === 'GET') {
      const value = await env.SYNC.get(key);
      if (value === null) return json({ error: 'no data' }, 404);
      return new Response(value, { headers: { ...CORS, 'Content-Type': 'application/json' } });
    }

    if (request.method === 'PUT') {
      const body = await request.text();
      if (new TextEncoder().encode(body).length > MAX_BYTES) return json({ error: 'too large' }, 413);
      let parsed;
      try {
        parsed = JSON.parse(body);
      } catch {
        return json({ error: 'invalid json' }, 400);
      }
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return json({ error: 'invalid json' }, 400);
      await env.SYNC.put(key, body);
      return new Response(null, { status: 204, headers: CORS });
    }

    return json({ error: 'method not allowed' }, 405);
  },
};
