const NL_BASE = 'http://127.0.0.1:27432';

async function nlFetch(method, path, body, token) {
  const opts = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-NL-Token': token || ''
    },
    signal: AbortSignal.timeout(3000)
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(NL_BASE + path, opts);
  return res.ok ? await res.json() : null;
}
