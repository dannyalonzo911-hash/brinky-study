const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT || 3000);
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
const PUBLIC_DIR = path.join(__dirname, 'public');

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
};

function send(res, status, body, type = 'application/json; charset=utf-8') {
  res.writeHead(status, {
    'Content-Type': type,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  });
  res.end(body);
}

async function readJson(req) {
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 8_000_000) throw new Error('Request too large');
  }
  return raw ? JSON.parse(raw) : {};
}

function normalizeHistory(messages) {
  if (!Array.isArray(messages)) return [];
  return messages
    .filter(m => m && typeof m.content === 'string' && (m.role === 'user' || m.role === 'assistant'))
    .slice(-20)
    .map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content.slice(0, 12000) }]
    }));
}

async function handleChat(req, res) {
  if (!GEMINI_API_KEY) {
    return send(res, 503, JSON.stringify({ error: 'GEMINI_API_KEY is not configured on the server.' }));
  }

  try {
    const body = await readJson(req);
    const message = typeof body.message === 'string' ? body.message.trim() : '';
    if (!message) return send(res, 400, JSON.stringify({ error: 'Message is required.' }));

    const contents = normalizeHistory(body.history);
    const userParts = [{ text: message.slice(0, 12000) }];

    if (typeof body.image === 'string' && body.image.startsWith('data:image/')) {
      const match = body.image.match(/^data:(image\/(?:png|jpeg|jpg|webp));base64,([A-Za-z0-9+/=]+)$/);
      if (!match) return send(res, 400, JSON.stringify({ error: 'Unsupported image format.' }));
      const [, mimeType, data] = match;
      if (data.length > 6_500_000) return send(res, 413, JSON.stringify({ error: 'Image is too large.' }));
      userParts.push({ inline_data: { mime_type: mimeType === 'image/jpg' ? 'image/jpeg' : mimeType, data } });
    }

    contents.push({ role: 'user', parts: userParts });

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`;
    const apiRes = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: 'You are Brinky Study, a helpful study assistant. Explain school topics clearly, show steps for math, and keep answers concise unless the student asks for more detail.' }]
        },
        contents,
        generationConfig: {
          temperature: 0.5,
          maxOutputTokens: 1400
        }
      })
    });

    const data = await apiRes.json().catch(() => ({}));
    if (!apiRes.ok) {
      const msg = data?.error?.message || `Gemini API error (${apiRes.status})`;
      return send(res, apiRes.status, JSON.stringify({ error: msg }));
    }

    const text = (data?.candidates?.[0]?.content?.parts || [])
      .map(p => p.text || '')
      .join('')
      .trim();

    if (!text) return send(res, 502, JSON.stringify({ error: 'The AI returned an empty response.' }));
    return send(res, 200, JSON.stringify({ reply: text }));
  } catch (err) {
    return send(res, 500, JSON.stringify({ error: err?.message || 'Server error.' }));
  }
}

function serveStatic(req, res) {
  let pathname = decodeURIComponent(new URL(req.url, `http://${req.headers.host || 'localhost'}`).pathname);
  if (pathname === '/') pathname = '/index.html';
  const safePath = path.normalize(pathname).replace(/^([.][.][/\\])+/, '');
  let filePath = path.join(PUBLIC_DIR, safePath);
  if (!filePath.startsWith(PUBLIC_DIR)) return send(res, 403, 'Forbidden', 'text/plain; charset=utf-8');

  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      filePath = path.join(PUBLIC_DIR, 'index.html');
    }
    fs.readFile(filePath, (readErr, data) => {
      if (readErr) return send(res, 404, 'Not found', 'text/plain; charset=utf-8');
      send(res, 200, data, mime[path.extname(filePath)] || 'application/octet-stream');
    });
  });
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'GET' && req.url.startsWith('/api/health')) {
    return send(res, 200, JSON.stringify({ ok: true, aiConfigured: Boolean(GEMINI_API_KEY), model: GEMINI_MODEL }));
  }
  if (req.method === 'POST' && req.url.startsWith('/api/chat')) return handleChat(req, res);
  if (req.method === 'GET' || req.method === 'HEAD') return serveStatic(req, res);
  return send(res, 405, JSON.stringify({ error: 'Method not allowed' }));
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Brinky Study Cloud running at http://localhost:${PORT}`);
  console.log(`Gemini model: ${GEMINI_MODEL}`);
  console.log(GEMINI_API_KEY ? 'Gemini API key detected.' : 'GEMINI_API_KEY is not set yet.');
});
