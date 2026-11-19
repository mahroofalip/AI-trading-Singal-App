const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

const PORT = Number(process.env.PORT || 3030);
const PUBLIC = path.join(__dirname, "public");
const TIMEFRAMES = ["M1", "M5", "M15", "H1"];
const store = { symbol: "XAUUSD.vxc", source: "DEMO", updatedAt: Date.now(), bars: {} };
for (const tf of TIMEFRAMES) store.bars[tf] = [];

function seedDemo() {
  const now = Math.floor(Date.now()/60000)*60;
  let p = 3880;
  const m1 = [];
  for (let i=260; i>=0; i--) {
    const t = now - i*60;
    const drift = Math.sin(i/27)*0.045 + Math.cos(i/11)*0.025;
    const change = drift + (Math.random()-0.5)*0.72;
    const o = p; p = Math.max(1, p+change);
    const c = p, spread = Math.random()*0.32+0.04;
    m1.push({time:t, open:o, high:Math.max(o,c)+spread, low:Math.min(o,c)-spread, close:c, volume:Math.floor(40+Math.random()*180)});
  }
  store.bars.M1 = m1;
  for (const tf of ["M5","M15","H1"]) store.bars[tf] = aggregate(m1, tf);
}
function aggregate(bars, tf) {
  const sec = ({M1:60,M5:300,M15:900,H1:3600})[tf];
  const groups = new Map();
  for (const b of bars) {
    const t = Math.floor(b.time/sec)*sec;
    if (!groups.has(t)) groups.set(t, []);
    groups.get(t).push(b);
  }
  return [...groups.entries()].sort((a,b)=>a[0]-b[0]).map(([time, xs]) => ({
    time, open:xs[0].open, high:Math.max(...xs.map(x=>x.high)),
    low:Math.min(...xs.map(x=>x.low)), close:xs[xs.length-1].close,
    volume:xs.reduce((s,x)=>s+(x.volume||0),0)
  }));
}
function ema(values, period) {
  if (!values.length) return [];
  const k=2/(period+1), out=[]; let prev=values[0];
  for(let i=0;i<values.length;i++){ prev=i===0?values[i]:values[i]*k+prev*(1-k); out.push(prev); }
  return out;
}
function rsi(values, period=14) {
  if(values.length<period+1) return 50;
  let gain=0, loss=0;
  for(let i=values.length-period;i<values.length;i++){
    const d=values[i]-values[i-1]; if(d>0) gain+=d; else loss-=d;
  }
  if(loss===0) return 100;
  const rs=(gain/period)/(loss/period);
  return 100-100/(1+rs);
}
function macd(values) {
  if(values.length<35) return {line:0, signal:0, hist:0};
  const e12=ema(values,12), e26=ema(values,26);
  const line=values.map((_,i)=>e12[i]-e26[i]);
  const sig=ema(line,9);
  const n=values.length-1;
  return {line:line[n],signal:sig[n],hist:line[n]-sig[n]};
}
function analyse(bars) {
  const closes=bars.map(b=>b.close);
  if(closes.length<30) return {trend:"WAIT", rsi:50, ema20:null, ema50:null, ema200:null, macd:{line:0,signal:0,hist:0}, atr:null};
  const e20=ema(closes,20), e50=ema(closes,50), e200=ema(closes,Math.min(200,closes.length));
  const n=closes.length-1, m=macd(closes), rv=rsi(closes);
  const tr=[];
  for(let i=Math.max(1,closes.length-14);i<bars.length;i++){
    const b=bars[i], prev=bars[i-1].close;
    tr.push(Math.max(b.high-b.low,Math.abs(b.high-prev),Math.abs(b.low-prev)));
  }
  const atr=tr.reduce((a,b)=>a+b,0)/(tr.length||1);
  const trend=closes[n]>e50[n] && e50[n]>e200[n] ? "BULLISH" :
    closes[n]<e50[n] && e50[n]<e200[n] ? "BEARISH" : "NEUTRAL";
  return {trend,rsi:rv,ema20:e20[n],ema50:e50[n],ema200:e200[n],macd:m,atr};
}

function structureAnalysis(bars) {
  const highs=[], lows=[], left=2, right=2;
  for(let i=left;i<bars.length-right;i++){
    let hi=true,lo=true;
    for(let j=i-left;j<=i+right;j++){if(i===j)continue;if(bars[j].high>=bars[i].high)hi=false;if(bars[j].low<=bars[i].low)lo=false;}
    if(hi)highs.push(bars[i].high); if(lo)lows.push(bars[i].low);
  }
  const last=bars[bars.length-1], prev=bars[bars.length-2];
  const sh=highs[highs.length-1], sl=lows[lows.length-1];
  const sweepHigh=!!(last&&sh&&last.high>sh&&last.close<sh);
  const sweepLow=!!(last&&sl&&last.low<sl&&last.close>sl);
  const bosUp=!!(prev&&last&&sh&&prev.close<=sh&&last.close>sh);
  const bosDown=!!(prev&&last&&sl&&prev.close>=sl&&last.close<sl);
  return {swingHigh:sh??null,swingLow:sl??null,
    sweep:sweepLow?"LOW SWEEP":sweepHigh?"HIGH SWEEP":"NONE",
    bos:bosUp?"BULLISH BOS":bosDown?"BEARISH BOS":"NONE",
    choch:"Requires prior confirmed structure trend; not yet classified"};
}

function buildState() {
  const a={}; for(const tf of TIMEFRAMES) a[tf]=analyse(store.bars[tf]);
  const h=a.H1, m=a.M15, s=a.M5, x=a.M1;
  const bull=h.trend==="BULLISH" && m.rsi>50 && m.macd.hist>0 && s.trend==="BULLISH";
  const bear=h.trend==="BEARISH" && m.rsi<50 && m.macd.hist<0 && s.trend==="BEARISH";
  const m1=store.bars.M1, prev=m1[m1.length-2], last=m1[m1.length-1];
  const trigger=prev && last ? (prev.close<=prev.open && last.close>last.open && last.close>prev.high) ||
    (prev.close>=prev.open && last.close<last.open && last.close<prev.low) : false;
  // Conservative status: directional alignment is a setup; no auto-entry without a confirmed structure trigger.
  const signal=bull ? "BUY SETUP" : bear ? "SELL SETUP" : "WAIT";
  const warnings=[];
  if(m.rsi>=70) warnings.push("M15 RSI is overbought — this is not an automatic sell.");
  if(m.rsi<=30) warnings.push("M15 RSI is oversold — this is not an automatic buy.");
  if(h.trend==="NEUTRAL") warnings.push("H1 trend is not clearly aligned.");
  if(!bull && !bear) warnings.push("Timeframes are mixed. Wait for alignment.");
  const reasons=[
    `H1 trend: ${h.trend}`,
    `M15 RSI: ${m.rsi.toFixed(1)}; MACD histogram: ${m.macd.hist.toFixed(4)}`,
    `M5 trend: ${s.trend}`,
    `M1 latest candle: ${x.trend}`
  ];
  // Educational planning levels: use recent M5 swing extremes plus an ATR buffer.
  // Levels are proposed only when higher-timeframe filters align; they are not orders.
  const m5=store.bars.M5, px=last?last.close:null, atr5=s.atr;
  let plan={valid:false,side:"NONE",entry:null,entryLow:null,entryHigh:null,stop:null,tp1:null,tp2:null,rr1:null,rr2:null,reason:"No aligned setup. Wait for a clearer structure and confirmation."};
  if(px && atr5 && m5.length>=25 && (bull||bear)) {
    const recent=m5.slice(-20,-1);
    const swingLow=Math.min(...recent.map(b=>b.low));
    const swingHigh=Math.max(...recent.map(b=>b.high));
    const buffer=atr5*0.15;
    const entry=px;
    if(bull){
      const stop=swingLow-buffer, risk=entry-stop;
      const resistance=swingHigh;
      const tp1=Math.min(entry+risk, resistance>entry?resistance:entry+risk);
      const tp2=entry+2*risk;
      plan={valid:risk>0,side:"BUY",entry,entryLow:entry-atr5*0.15,entryHigh:entry+atr5*0.15,stop,tp1,tp2,rr1:(tp1-entry)/risk,rr2:2,
        reason:"H1 bullish + M15 momentum + M5 trend aligned. Entry is a planning reference; wait for a pullback/trigger. Stop is below recent M5 swing low with an ATR buffer."};
    } else {
      const stop=swingHigh+buffer, risk=stop-entry;
      const support=swingLow;
      const tp1=Math.max(entry-risk, support<entry?support:entry-risk);
      const tp2=entry-2*risk;
      plan={valid:risk>0,side:"SELL",entry,entryLow:entry-atr5*0.15,entryHigh:entry+atr5*0.15,stop,tp1,tp2,rr1:(entry-tp1)/risk,rr2:2,
        reason:"H1 bearish + M15 momentum + M5 trend aligned. Entry is a planning reference; wait for a pullback/trigger. Stop is above recent M5 swing high with an ATR buffer."};
    }
    if(!plan.valid) plan={valid:false,side:"NONE",reason:"Invalid stop distance. No trade plan."};
  }
  return {symbol:store.symbol,source:store.source,updatedAt:store.updatedAt,price:px,
    signal, bias:bull?"BULLISH":bear?"BEARISH":"MIXED", triggerConfirmed:!!trigger,
    warnings,reasons,plan,timeframes:a,bars:store.bars.M1.slice(-180),
    structure:{M5:structureAnalysis(store.bars.M5),M15:structureAnalysis(store.bars.M15)},
    confidence:{passed:[h.trend!=="NEUTRAL",m.rsi>50&&m.macd.hist>0||m.rsi<50&&m.macd.hist<0,s.trend!=="NEUTRAL"].filter(Boolean).length,total:3}};
}
function send(res, code, data) {
  res.writeHead(code, {"Content-Type":"application/json","Access-Control-Allow-Origin":"*","Cache-Control":"no-store"});
  res.end(JSON.stringify(data));
}
const server=http.createServer((req,res)=>{
  const u=new URL(req.url,`http://${req.headers.host||"localhost"}`);
  if(req.method==="OPTIONS"){res.writeHead(204,{"Access-Control-Allow-Origin":"*","Access-Control-Allow-Methods":"GET,POST,OPTIONS","Access-Control-Allow-Headers":"Content-Type"});return res.end();}
  if(req.method==="GET" && u.pathname==="/api/state") return send(res,200,buildState());
  if(req.method==="POST" && u.pathname==="/api/ingest"){
    let raw=""; req.on("data",d=>raw+=d); req.on("end",()=>{
      try{
        const payload=JSON.parse(raw);
        if(payload.symbol) store.symbol=String(payload.symbol).slice(0,40);
        if(payload.timeframe && TIMEFRAMES.includes(payload.timeframe) && Array.isArray(payload.bars)){
          const clean=payload.bars.slice(-600).filter(b=>Number.isFinite(+b.time)&&["open","high","low","close"].every(k=>Number.isFinite(+b[k])))
            .map(b=>({time:Math.floor(+b.time),open:+b.open,high:+b.high,low:+b.low,close:+b.close,volume:+b.volume||0}));
          if(clean.length) store.bars[payload.timeframe]=clean;
        }
        store.source="MT5 LIVE BRIDGE"; store.updatedAt=Date.now();
        send(res,200,{ok:true,received:payload.timeframe||"payload"});
      }catch(e){send(res,400,{ok:false,error:"Invalid JSON payload"});}
    }); return;
  }
  if(req.method==="POST" && u.pathname==="/api/demo"){
    seedDemo(); store.source="DEMO"; store.updatedAt=Date.now(); return send(res,200,{ok:true});
  }
  if(req.method==="POST" && u.pathname==="/api/csv"){
    let raw=""; req.on("data",d=>raw+=d); req.on("end",()=>{
      try{
        const lines=raw.trim().split(/\r?\n/); const header=lines.shift().split(/[;,\t]/).map(x=>x.trim().toLowerCase());
        const idx=(names)=>header.findIndex(h=>names.includes(h));
        const ti=idx(["time","date","datetime","timestamp"]), oi=idx(["open"]), hi=idx(["high"]), li=idx(["low"]), ci=idx(["close"]), vi=idx(["volume","tick_volume"]);
        if([ti,oi,hi,li,ci].some(x=>x<0)) throw new Error("CSV needs time, open, high, low, close columns.");
        const bars=lines.map(line=>{
          const c=line.split(/[;,\t]/).map(x=>x.trim()); let t=Date.parse(c[ti]);
          if(!Number.isFinite(t)){const num=Number(c[ti]); if(Number.isFinite(num)) t=num>1e12?num:num*1000;}
          return {time:Math.floor(t/1000),open:Number(c[oi]),high:Number(c[hi]),low:Number(c[li]),close:Number(c[ci]),volume:vi>=0?Number(c[vi])||0:0};
        }).filter(b=>Number.isFinite(b.time)&&[b.open,b.high,b.low,b.close].every(Number.isFinite)).sort((a,b)=>a.time-b.time);
        if(!bars.length) throw new Error("No valid candles found.");
        store.bars.M1=bars.slice(-2000); store.bars.M5=aggregate(store.bars.M1,"M5"); store.bars.M15=aggregate(store.bars.M1,"M15"); store.bars.H1=aggregate(store.bars.M1,"H1");
        store.source="CSV IMPORT"; store.updatedAt=Date.now(); send(res,200,{ok:true,count:bars.length});
      }catch(e){send(res,400,{ok:false,error:e.message});}
    }); return;
  }
  if(req.method==="GET"){
    const file=u.pathname==="/"?"index.html":u.pathname.replace(/^\/+/,"");
    const full=path.join(PUBLIC,file);
    if(!full.startsWith(PUBLIC)){res.writeHead(403);return res.end("Forbidden");}
    fs.readFile(full,(err,buf)=>{
      if(err){res.writeHead(404);return res.end("Not found");}
      const ext=path.extname(full); const types={".html":"text/html",".css":"text/css",".js":"text/javascript",".svg":"image/svg+xml"};
      res.writeHead(200,{"Content-Type":types[ext]||"application/octet-stream"});res.end(buf);
    });return;
  }
  send(res,404,{error:"Not found"});
});
seedDemo();
server.listen(PORT,"127.0.0.1",()=>console.log(`Gold Trading Terminal running at http://127.0.0.1:${PORT}`));
