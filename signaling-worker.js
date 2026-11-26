// Cloudflare Worker - Signaling relay for WebRTC (P2P via 4-letter room code)
// Deploy: wrangler deploy signaling-worker.js
// Gratis: 100k req/día en plan Cloudflare Workers

const handler = {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const codigo = path.split('/').pop().toUpperCase();

    // CORS headers
    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: cors });
    }

    // WebSocket upgrade for real-time ICE candidates
    if (request.headers.get('Upgrade') === 'websocket') {
      return handleWebSocket(request, env, codigo, cors);
    }

    // REST endpoints for SDP offer/answer
    if (path.startsWith('/offer/')) {
      if (request.method === 'POST') {
        return handleOffer(request, env, codigo, cors);
      }
      if (request.method === 'GET') {
        return handleGetOffer(env, codigo, cors);
      }
    }

    if (path.startsWith('/answer/')) {
      if (request.method === 'POST') {
        return handleAnswer(request, env, codigo, cors);
      }
      if (request.method === 'GET') {
        return handleGetAnswer(env, codigo, cors);
      }
    }

    if (path === '/health') {
      return new Response('OK', { headers: cors });
    }

    return new Response('Not found', { status: 404, headers: cors });
  }
};

async function handleOffer(request, env, codigo, cors) {
  try {
    const body = await request.json();
    if (!body || !body.sdp) {
      return json({ error: 'sdp required' }, 400, cors);
    }
    // Store offer with 10 min TTL
    await env.SIGNALING.put(`offer:${codigo}`, JSON.stringify({
      sdp: body.sdp,
      timestamp: Date.now()
    }), { expirationTtl: 600 });
    return json({ ok: true }, 200, cors);
  } catch (e) {
    return json({ error: e.message }, 500, cors);
  }
}

async function handleGetOffer(env, codigo, cors) {
  const data = await env.SIGNALING.get(`offer:${codigo}`);
  if (!data) return json({ error: 'no offer yet' }, 404, cors);
  return new Response(data, { headers: { ...cors, 'Content-Type': 'application/json' } });
}

async function handleAnswer(request, env, codigo, cors) {
  try {
    const body = await request.json();
    if (!body || !body.sdp) {
      return json({ error: 'sdp required' }, 400, cors);
    }
    await env.SIGNALING.put(`answer:${codigo}`, JSON.stringify({
      sdp: body.sdp,
      timestamp: Date.now()
    }), { expirationTtl: 600 });
    // Notify waiting WebSocket clients
    await notifyWebSockets(env, codigo, { type: 'answer', sdp: body.sdp });
    return json({ ok: true }, 200, cors);
  } catch (e) {
    return json({ error: e.message }, 500, cors);
  }
}

async function handleGetAnswer(env, codigo, cors) {
  const data = await env.SIGNALING.get(`answer:${codigo}`);
  if (!data) return json({ error: 'no answer yet' }, 404, cors);
  return new Response(data, { headers: { ...cors, 'Content-Type': 'application/json' } });
}

async function handleWebSocket(request, env, codigo, cors) {
  const pair = new WebSocketPair();
  const [client, server] = Object.values(pair);

  server.accept();
  
  // Register this WebSocket for the room
  const wsKey = `ws:${codigo}`;
  let sockets = [];
  const existing = await env.SIGNALING.get(wsKey);
  if (existing) sockets = JSON.parse(existing);
  
  // We can't store WebSocket objects in KV, so we use Durable Objects for real-time
  // For now, fallback to polling via REST (simpler, works without Durable Objects)
  server.close(1001, 'Use REST polling for ICE; WebSocket not implemented in this worker');
  
  return new Response(null, { status: 101, webSocket: client, headers: cors });
}

async function notifyWebSockets(env, codigo, message) {
  // With plain Workers, we can't push to WebSockets without Durable Objects
  // Clients will poll /answer/:codigo instead
  return;
}

function json(data, status, cors) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' }
  });
}

// Export for Cloudflare Workers (ES module)
export default handler;