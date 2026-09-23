const PORT = 9000 + Math.floor(Math.random()*300);
const puppeteer = require('puppeteer-core'); const http=require('http'),fs=require('fs'),path=require('path');
const root=path.join(__dirname,'dist');
const srv=http.createServer((q,r)=>{let f=path.join(root,q.url.split('?')[0]);fs.readFile(f,(e,d)=>{if(e){r.writeHead(404);r.end();return;}r.writeHead(200,{'Content-Type':f.endsWith('.js')?'text/javascript':f.endsWith('.css')?'text/css':'text/html'});r.end(d);});}).listen(PORT);
(async()=>{const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
const p=await b.newPage();await p.setViewport({width:200,height:120});const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto(`http://localhost:${PORT}/index.html?auto=1&fixed=1&desktop=1&norender=1&spawn=${process.argv[2]||''}`);
const log=[];const t0=Date.now();
while(Date.now()-t0<(+process.argv[3]||80000)){await new Promise(r=>setTimeout(r,2000));const s=await p.evaluate(()=>{const g=window.__game,pl=g.player;return {t:+window.__gt().toFixed(0),st:pl.state,p:pl.p.toArray().map(v=>Math.round(v)),v:+pl.speed().toFixed(0),ev:g.hud.event?g.hud.event.type.name:null,xp:g.hud.xp,lv:g.hud.level,seen:[...g.hud.seen]}});log.push(s);}
console.log(log.map(x=>JSON.stringify(x)).join('\n'));console.log('errors',errs);await b.close();srv.close();})();
