let simpleChart, detailChart, candleSeries, detailCandle, emaLine;
const $=id=>document.getElementById(id);
const fmt=n=>n==null?"—":Number(n).toFixed(2);
function cls(v){return v==="BULLISH"?"up":v==="BEARISH"?"down":"neutral"}
function makeChart(id,tall=false){
 const el=$(id); if(!window.LightweightCharts){el.innerHTML='<div class="empty">Chart library needs internet access. Dashboard calculations still work.</div>';return null;}
 const chart=LightweightCharts.createChart(el,{width:el.clientWidth,height:tall?390:290,layout:{background:{color:"#111821"},textColor:"#91a1b2"},grid:{vertLines:{color:"#1d2936"},horzLines:{color:"#1d2936"}},rightPriceScale:{borderColor:"#293747"},timeScale:{borderColor:"#293747",timeVisible:true,secondsVisible:false},crosshair:{mode:1}});
 const series=chart.addCandlestickSeries({upColor:"#42c99a",downColor:"#ef747b",borderUpColor:"#42c99a",borderDownColor:"#ef747b",wickUpColor:"#42c99a",wickDownColor:"#ef747b"});
 return {chart,series};
}
function drawFallbackChart(id,bars,height){
 const el=$(id); if(!el)return;
 const w=Math.max(el.clientWidth||600,320), h=height, data=bars.slice(-90);
 const lo=Math.min(...data.map(b=>b.low)), hi=Math.max(...data.map(b=>b.high)), span=(hi-lo)||1;
 const x=i=>12+i*(w-24)/Math.max(data.length-1,1), y=v=>10+(hi-v)/span*(h-22);
 let svg=`<svg viewBox="0 0 ${w} ${h}" width="100%" height="${h}" role="img" aria-label="Fallback candlestick chart">`;
 for(let k=0;k<5;k++){const yy=10+k*(h-20)/4;svg+=`<line x1="0" y1="${yy}" x2="${w}" y2="${yy}" stroke="#263342" stroke-width="1"/>`;}
 data.forEach((b,i)=>{const xx=x(i),up=b.close>=b.open,col=up?"#42c99a":"#ef747b",top=y(Math.max(b.open,b.close)),bot=y(Math.min(b.open,b.close)),bh=Math.max(2,bot-top);svg+=`<line x1="${xx}" y1="${y(b.high)}" x2="${xx}" y2="${y(b.low)}" stroke="${col}" stroke-width="1.2"/><rect x="${xx-2.2}" y="${top}" width="4.4" height="${bh}" fill="${col}"/>`;});
 svg+="</svg>";el.innerHTML=svg;
}
function renderCards(target,state){
 const tfs=target==="tfCards"?["H1","M15","M5","M1"]:["H1","M15","M5","M1"];
 $(target).innerHTML=tfs.map(tf=>{const x=state.timeframes[tf];return `<div class="tf-card"><div class="tf-top"><b>${tf} TIMEFRAME</b><span>●</span></div><div class="tf-value ${cls(x.trend)}">${x.trend}</div><div class="tf-sub">RSI ${fmt(x.rsi)} · EMA50 ${fmt(x.ema50)}</div></div>`}).join("");
}
function renderState(s){
 $("price").textContent=fmt(s.price);$("updated").textContent=new Date(s.updatedAt).toLocaleTimeString();
 $("sourcePill").textContent=s.source;
 const sig=s.signal==="BUY SETUP"?"buy":s.signal==="SELL SETUP"?"sell":"wait";
 $("signalCard").className="signal-card "+sig;$("signalText").textContent=s.signal;
 $("signalDesc").textContent=s.triggerConfirmed?"M1 candle pattern detected — inspect structure and risk before acting.": "Trend filters only. No confirmed entry trigger.";
 renderCards("tfCards",s);renderCards("detailTf",s);
 $("guidance").innerHTML=s.reasons.map(x=>`<div class="guide-item"><span class="guide-icon">◆</span><span>${x}</span></div>`).join("");
 $("warnings").innerHTML=s.warnings.length?s.warnings.map(x=>`• ${x}`).join("<br>"):"No extreme RSI warning detected.";
 const p=s.plan;
 if(p && p.valid){
   const levels=[["ENTRY REFERENCE",p.entry],["ENTRY ZONE LOW",p.entryLow],["STOP LOSS",p.stop],["TAKE PROFIT 1",p.tp1],["TAKE PROFIT 2",p.tp2]];
   $("tradePlan").innerHTML=levels.map(([label,value],i)=>`<div class="plan-level"><span>${label}</span><b class="${i===2?"down":i>=3?"up":""}">${fmt(value)}</b></div>`).join("")+`<div class="plan-reason"><b>${p.side} plan · TP1 ${p.rr1.toFixed(2)}R · TP2 ${p.rr2.toFixed(2)}R</b><br>${p.reason}<br><b>Important:</b> Entry is a reference, not a live order instruction. Check current spread, candle close, support/resistance and broker execution before acting.</div>`;
 } else { $("tradePlan").innerHTML=`<div class="plan-empty">NO TRADE PLAN — ${p?.reason||"Waiting for enough candle data and aligned conditions."}</div>`; }
 const t=s.timeframes;
 $("indicators").innerHTML=[
 ["H1 trend",t.H1.trend],["H1 EMA 50",fmt(t.H1.ema50)],["H1 EMA 200",fmt(t.H1.ema200)],
 ["M15 RSI (14)",fmt(t.M15.rsi)],["M15 MACD histogram",fmt(t.M15.macd.hist)],
 ["M15 ATR (approx.)",fmt(t.M15.atr)],["M5 EMA 20",fmt(t.M5.ema20)],["M5 EMA 50",fmt(t.M5.ema50)],
 ["M1 RSI (14)",fmt(t.M1.rsi)],["M1 ATR (approx.)",fmt(t.M1.atr)]
 ].map(([a,b])=>`<div class="indicator-row"><span>${a}</span><b>${b}</b></div>`).join("");
 const rows=[["H1 bullish trend",t.H1.trend==="BULLISH"],["M15 bullish momentum",t.M15.rsi>50&&t.M15.macd.hist>0],["M5 bullish trend",t.M5.trend==="BULLISH"],["H1 bearish trend",t.H1.trend==="BEARISH"],["M15 bearish momentum",t.M15.rsi<50&&t.M15.macd.hist<0],["M5 bearish trend",t.M5.trend==="BEARISH"],["M15 overbought warning",t.M15.rsi>=70],["M15 oversold warning",t.M15.rsi<=30]];
 $("checklist").innerHTML=rows.map(([name,ok])=>`<div class="check"><span>${name}</span><b class="${ok?"up":"neutral"}">${ok?"YES":"NO"}</b></div>`).join("");

 const st=s.structure||{}, st5=st.M5||{}, st15=st.M15||{};
 const plan=s.plan||{};
 if($("structureSummary")) $("structureSummary").innerHTML=[
  ["M5 liquidity sweep",st5.sweep||"—"],["M5 BOS",st5.bos||"—"],
  ["M5 swing high",st5.swingHigh==null?"—":Number(st5.swingHigh).toFixed(2)],
  ["M5 swing low",st5.swingLow==null?"—":Number(st5.swingLow).toFixed(2)],
  ["M15 sweep",st15.sweep||"—"],["M15 BOS",st15.bos||"—"]
 ].map(([k,v])=>`<div class="indicator-row"><span>${k}</span><b>${v}</b></div>`).join("");
 $("tradePlan").innerHTML=[
  ["Potential entry",plan.entry==null?"Not available":Number(plan.entry).toFixed(2)],
  ["Entry zone",plan.entryLow==null?"—":Number(plan.entryLow).toFixed(2)+" – "+Number(plan.entryHigh).toFixed(2)],
  ["Stop loss",plan.stop==null?"—":Number(plan.stop).toFixed(2)],
  ["TP1",plan.tp1==null?"—":Number(plan.tp1).toFixed(2)],
  ["TP2",plan.tp2==null?"—":Number(plan.tp2).toFixed(2)],
  ["Plan status",plan.valid?"PROVISIONAL":"NO TRADE"]
 ].map(([k,v])=>`<div class="plan-cell"><small>${k}</small><b>${v}</b></div>`).join("");
 const conf=s.confidence||{passed:0,total:3};
 if($("confidence")) $("confidence").innerHTML=`<p>Rule alignment: ${Math.round(conf.passed/conf.total*100)}% (${conf.passed}/${conf.total}) — not a win probability.</p><div class="confidence-meter"><i style="width:${conf.passed/conf.total*100}%"></i></div>`;

 const bars=s.bars||[];
 if(bars.length&&window.LightweightCharts){
   if(!simpleChart){simpleChart=makeChart("simpleChart");candleSeries=simpleChart?.series;}
   if(!detailChart){detailChart=makeChart("detailChart",true);detailCandle=detailChart?.series;}
   if(candleSeries){candleSeries.setData(bars);simpleChart.chart.timeScale().fitContent();}
   if(detailCandle){detailCandle.setData(bars);detailChart.chart.timeScale().fitContent();}
 } else if(bars.length) {
   drawFallbackChart("simpleChart",bars,290);
   drawFallbackChart("detailChart",bars,390);
 }
}
async function refresh(){try{const r=await fetch("/api/state");const s=await r.json();renderState(s);$("connDot").style.background="#42c99a";$("connText").textContent="Local engine running";}catch(e){$("connDot").style.background="#ef747b";$("connText").textContent="Engine disconnected";}}
document.querySelectorAll(".nav").forEach(b=>b.addEventListener("click",()=>{document.querySelectorAll(".nav").forEach(x=>x.classList.remove("active"));document.querySelectorAll(".page").forEach(x=>x.classList.remove("active"));b.classList.add("active");$("page-"+b.dataset.page).classList.add("active");setTimeout(()=>{[simpleChart,detailChart].forEach(c=>c?.chart.applyOptions({width:c.chart.chartElement?.clientWidth||c.chart.options().width}));},60);}));
$("demoBtn").onclick=async()=>{await fetch("/api/demo",{method:"POST"});refresh();};
$("csvFile").onchange=async e=>{const f=e.target.files[0];if(!f)return;const r=await fetch("/api/csv",{method:"POST",headers:{"Content-Type":"text/plain"},body:await f.text()});const j=await r.json();alert(j.ok?`Imported ${j.count} candles.`:j.error);refresh();e.target.value="";};
function calculate(){
 const balance=Number($("balance").value),pct=Number($("riskPct").value),sl=Number($("slDistance").value),contract=Number($("contract").value),vol=Number($("volume").value),lev=Number($("leverage").value);
 const riskBudget=balance*pct/100/100, loss=sl*contract*vol, price=Number($("price").textContent)||3880, margin=price*contract*vol/lev;
 $("riskBudget").textContent=riskBudget.toFixed(2)+" USD";$("stopRisk").textContent=loss.toFixed(2)+" USD ("+(loss*100).toFixed(0)+" USC)";
 $("riskActual").textContent=(loss/(balance/100)*100).toFixed(2)+"%";$("marginReq").textContent=margin.toFixed(2)+" USD ("+(margin*100).toFixed(0)+" USC)";
 $("afterStop").textContent=((balance/100)-loss).toFixed(2)+" USD";
}
$("calcBtn").onclick=calculate;["balance","riskPct","slDistance","contract","volume","leverage"].forEach(id=>$(id).addEventListener("input",calculate));
window.addEventListener("resize",()=>{if(simpleChart)simpleChart.chart.applyOptions({width:$("simpleChart").clientWidth});if(detailChart)detailChart.chart.applyOptions({width:$("detailChart").clientWidth});});
refresh();calculate();setInterval(refresh,3000);

let lastSignalForSound="";
function signalTone(){try{const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;const c=new AC(),o=c.createOscillator(),g=c.createGain();o.connect(g);g.connect(c.destination);o.frequency.value=680;g.gain.value=.05;o.start();o.stop(c.currentTime+.16);}catch(e){}}
const originalRefreshRender=renderState;
renderState=function(s){originalRefreshRender(s);if(lastSignalForSound&&s.signal!==lastSignalForSound)signalTone();lastSignalForSound=s.signal;};
function renderJournal(){const rows=JSON.parse(localStorage.getItem("aurumTradeJournal")||"[]");const el=$("journalRows");if(el)el.innerHTML=rows.map(r=>`<div class="journal-row"><span>${r.date}</span><span>${r.side}</span><span>${r.entry}</span><span>SL ${r.sl}</span><span>TP ${r.tp}</span><span>${r.result}</span></div>`).join("")||"No trades recorded.";}
$("saveJournal")?.addEventListener("click",()=>{const rows=JSON.parse(localStorage.getItem("aurumTradeJournal")||"[]");rows.unshift({date:new Date().toLocaleString(),side:$("jSide").value,entry:$("jEntry").value,sl:$("jSL").value,tp:$("jTP").value,result:$("jResult").value});localStorage.setItem("aurumTradeJournal",JSON.stringify(rows.slice(0,250)));renderJournal();});
renderJournal();
