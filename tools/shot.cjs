const PORT = 8200 + Math.floor(Math.random()*500);
const puppeteer = require('puppeteer-core');
const http = require('http'), fs = require('fs'), path = require('path');
const root = path.join(__dirname, 'dist');
const srv = http.createServer((q, r) => { let f = path.join(root, decodeURIComponent(q.url.split('?')[0])); if (f.endsWith('/')) f += 'index.html'; fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'Content-Type': f.endsWith('.js') ? 'text/javascript' : f.endsWith('.css') ? 'text/css' : 'text/html' }); r.end(d); }); }).listen(PORT);
(async () => {
  const args = process.argv.slice(2); const query = args[0] || 'auto=1&fixed=1'; const times = (args[1] || '2,6,10,14').split(',').map(Number); const out = args[2] || '/tmp/shots'; const vp = (args[3] || '1280x720').split('x').map(Number);
  fs.mkdirSync(out, { recursive: true });
  const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
  const p = await b.newPage(); await p.setViewport({ width: vp[0], height: vp[1] });
  const logs = []; p.on('console', m => logs.push(m.type() + ': ' + m.text())); p.on('pageerror', e => logs.push('ERR ' + e.message));
  await p.goto(`http://localhost:${PORT}/index.html?` + query, { waitUntil: 'load' });
  const t0 = Date.now();
  for (const [k, t] of times.entries()) {
    // wait until game time reaches t (sim uses fixed dt=1/30 per frame when fixed)
    for (;;) { const gt = await p.evaluate(() => window.__gt ? window.__gt() : -1).catch(() => -1); if (gt >= t || Date.now() - t0 > 170000) break; await new Promise(r => setTimeout(r, 300)); }
    const info = await p.evaluate(() => { const g = window.__game; if (!g) return null; const pl = g.player; return { t: window.__gt(), state: pl.state, p: pl.p.toArray().map(v => +v.toFixed(1)), spd: +pl.speed().toFixed(1), fps: +g.fps.toFixed(1), calls: g.renderer.info.render.calls, tris: g.renderer.info.render.triangles }; });
    console.log(JSON.stringify(info));
    await p.screenshot({ path: `${out}/f${k}.jpg`, type: 'jpeg', quality: 80 });
  }
  console.log(logs.slice(0, 20).join('\n'));
  await b.close(); srv.close();
})();
