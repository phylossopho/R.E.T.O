// Cloudflare Worker - Signaling relay (minimal working version)
const handler = {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const parts = path.split('/').filter(p => p);
    const codigo = parts[parts.length - 1]?.toUpperCase() || '';

    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: cors });
    }

    if (parts[0] === 'offer') {
      if (request.method === 'GET') {
        try {
          const data = await env.SIGNALING.get(`offer:${codigo}`);
          if (!data) return json({ error: 'no offer yet' }, 404, cors);
          return new Response(data, { headers: { ...cors, 'Content-Type': 'application/json' } });
        } catch (e) {
          return json({ error: e.message }, 500, cors);
        }
      }
      if (request.method === 'POST') {
        try {
          const body = await request.json();
          if (!body || !body.sdp) return json({ error: 'sdp required' }, 400, cors);
          await env.SIGNALING.put(`offer:${codigo}`, JSON.stringify({ sdp: body.sdp, timestamp: Date.now() }), { expirationTtl: 600 });
          return json({ ok: true }, 200, cors);
        } catch (e) {
          return json({ error: e.message }, 500, cors);
        }
      }
    }

    if (parts[0] === 'answer') {
      if (request.method === 'GET') {
        try {
          const data = await env.SIGNALING.get(`answer:${codigo}`);
          if (!data) return json({ error: 'no answer yet' }, 404, cors);
          return new Response(data, { headers: { ...cors, 'Content-Type': 'application/json' } });
        } catch (e) {
          return json({ error: e.message }, 500, cors);
        }
      }
      if (request.method === 'POST') {
        try {
          const body = await request.json();
          if (!body || !body.sdp) return json({ error: 'sdp required' }, 400, cors);
          await env.SIGNALING.put(`answer:${codigo}`, JSON.stringify({ sdp: body.sdp, timestamp: Date.now() }), { expirationTtl: 600 });
          return json({ ok: true }, 200, cors);
        } catch (e) {
          return json({ error: e.message }, 500, cors);
        }
      }
    }

    if (path === '/health') return new Response('OK', { headers: cors });
    if (path === '/test-kv') {
      try {
        await env.SIGNALING.put('test:key', 'test-value', { expirationTtl: 60 });
        const value = await env.SIGNALING.get('test:key');
        return new Response(JSON.stringify({ success: true, value }), { headers: { ...cors, 'Content-Type': 'application/json' } });
      } catch (e) {
        return new Response(JSON.stringify({ success: false, error: e.message }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } });
      }
    }

    return new Response('Not found', { status: 404, headers: cors });
  }
};

function json(data, status, cors) {
  return new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
}

export default handler;

if (typeof module !== 'undefined' && module.exports) module.exports = handler;