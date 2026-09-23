const PORT = 8800 + Math.floor(Math.random()*100);
const puppeteer = require('puppeteer-core'); const http=require('http'),fs=require('fs'),path=require('path');
const root=path.join(__dirname,'dist');
const srv=http.createServer((q,r)=>{let f=path.join(root,q.url.split('?')[0]);if(f.endsWith('/'))f+='index.html';fs.readFile(f,(e,d)=>{if(e){r.writeHead(404);r.end();return;}r.writeHead(200,{'Content-Type':f.endsWith('.js')?'text/javascript':f.endsWith('.css')?'text/css':'text/html'});r.end(d);});}).listen(PORT);
(async()=>{const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
const p=await b.newPage();await p.setViewport({width:320,height:180});await p.goto(`http://localhost:${PORT}/index.html?play=1`);
await new Promise(r=>setTimeout(r,8000));
const res=await p.evaluate(()=>{const out=[];window.__game.scene.traverse(o=>{if(!o.isMesh)return;const g=o.geometry;const t=(g.index?g.index.count:g.attributes.position.count)/3;const n=o.isInstancedMesh?o.count:1;out.push([o.name||o.material.type+(o.material.map?'+map':'')+(o.isInstancedMesh?' inst':''),Math.round(t),n,Math.round(t*n),o.castShadow]);});out.sort((a,b)=>b[3]-a[3]);return out.slice(0,15);});
console.log(res.map(r=>r.join('\t')).join('\n'));await b.close();srv.close();})();
