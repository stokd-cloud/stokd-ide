import WebSocket from 'ws';
const ws = process.argv[2];
const expr = process.argv[3] || 'document.body.innerText';
const sock = new WebSocket(ws);
let id = 0;
const pending = new Map();
function send(method, params) { return new Promise((res)=>{ const i=++id; pending.set(i,res); sock.send(JSON.stringify({id:i,method,params})); }); }
sock.on('message', (d)=>{ const m=JSON.parse(d); if(m.id && pending.has(m.id)){ pending.get(m.id)(m); pending.delete(m.id); } });
sock.on('open', async ()=>{
  await send('Runtime.enable',{});
  const r = await send('Runtime.evaluate',{expression:expr, returnByValue:true});
  console.log(JSON.stringify(r.result?.result?.value ?? r.result?.exceptionDetails ?? r.result, null, 2));
  sock.close(); process.exit(0);
});
sock.on('error',(e)=>{ console.error('WSERR',e.message); process.exit(1); });
