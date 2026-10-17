const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
app.use(express.static('public'));
app.get('/', (req,res)=>res.redirect('/player.html'+(req.query.code?'?code='+encodeURIComponent(req.query.code):'')));
// Short Host links: /host or /admin open the Host page directly
app.get(['/host','/admin'], (req,res)=>res.redirect('/host.html'));
app.use(express.json({limit:'2mb'}));

const HOST_ID = process.env.HOST_ID || 'admin';
const HOST_PW = process.env.HOST_PW || 'gyan2026';

const fs = require('fs');
const path = require('path');

// ---- Game settings (edit config.json to change round names, Box points, timers, scoring) ----
const CFG_DEF = {
  rounds: 7, perRound: 5,
  roundNames: ['શરૂઆત','ગુજરાતની ઓળખ','ઉખાણાં અને કહેવત','લાઇટનિંગ','ઇમોજી રાઉન્ડ','હું કોણ છું?','ગ્રાન્ડ ફિનાલે'],
  correctPts: 2, wrongPts: 1,
  boxPool: [1,2,3,3,5,0],   // 6 Mystery Boxes per round (shuffled for every player)
  lastRoundMult: 2,          // Box points of the LAST round are multiplied by this
  boxSec: 20,                // seconds to pick a Box
  cardCounts: [4,4,4,4,3,3,3] // answers on each player's card from Round 1..7 (sum must be 25)
};
function loadConfig(){
  let c = {};
  try { c = JSON.parse(fs.readFileSync(path.join(__dirname,'config.json'),'utf8')); } catch(e){ console.log('config.json not read, using defaults'); }
  const o = Object.assign({}, CFG_DEF, c);
  if (!Array.isArray(o.boxPool) || o.boxPool.length !== 6) o.boxPool = CFG_DEF.boxPool;
  if (!Array.isArray(o.cardCounts) || o.cardCounts.length !== o.rounds || o.cardCounts.reduce((a,b)=>a+b,0) !== 25) o.cardCounts = CFG_DEF.cardCounts;
  o.roundNames = Array.from({length:o.rounds}, (_,i)=> (o.roundNames && o.roundNames[i]) || ('Round '+(i+1)));
  return o;
}
const CFG = loadConfig();
function publicCfg(){ return { rounds:CFG.rounds, perRound:CFG.perRound, roundNames:CFG.roundNames, correctPts:CFG.correctPts, wrongPts:CFG.wrongPts, lastMult:CFG.lastRoundMult, boxSec:CFG.boxSec }; }
function defaultQuestionsText(){
  try { return fs.readFileSync(path.join(__dirname,'questions.txt'),'utf8'); } catch(e){ return ''; }
}
app.get('/api/default-questions', (req,res)=>{ res.type('text/plain; charset=utf-8').send(defaultQuestionsText()); });
app.get('/api/config', (req,res)=>res.json(publicCfg()));

const LINES = (() => {
  const L = [];
  for (let r = 0; r < 5; r++) L.push([0,1,2,3,4].map(c => r*5+c));
  for (let c = 0; c < 5; c++) L.push([0,1,2,3,4].map(r => r*5+c));
  L.push([0,6,12,18,24]); L.push([4,8,12,16,20]);
  return L;
})();
const WINNER_ORDER = ['line1','line2','line3','line4','line5','full','top3','top2','top1'];
const WINNER_LABELS = {line1:'1 Line',line2:'2 Line',line3:'3 Line',line4:'4 Line',line5:'5 Line',full:'Full House',top3:'3rd Score',top2:'2nd Score',top1:'Overall Champion'};

// One "Question::Answer" line (optional picture: [img:file.jpg] or [img:https://...])
function parseLine(l){
  let img = '';
  l = l.replace(/\[img:\s*(\S+?)\s*\]/i, (m,u)=>{ img=u; return ''; }).trim();
  if (img && !/^(https?:|data:|\/)/i.test(img)) img = '/qimg/' + encodeURIComponent(img.replace(/^qimg\//i,''));
  let parts = null;
  if (l.includes('::')) parts = [l.split('::')[0], l.split('::').slice(1).join('::')];
  else if (l.includes(' - ')) parts = [l.split(' - ')[0], l.split(' - ').slice(1).join(' - ')];
  else if ((l.match(/:/g)||[]).length===1) parts = l.split(':');
  if (parts && parts[0].trim() && parts[1] && parts[1].trim()) return img?{q:parts[0].trim(), a:parts[1].trim(), img}:{q:parts[0].trim(), a:parts[1].trim()};
  return null;
}
// Round-wise questions: a line "Round 3" starts round 3, followed by exactly 5 Question::Answer lines.
function parseRounds(text){
  const R = CFG.rounds, P = CFG.perRound;
  const lines = (text||'').split('\n').map(l=>l.trim()).filter(Boolean);
  const rounds = Array.from({length:R}, ()=>[]); const errors = []; const bad = [];
  let cur = -1; const flat = [];
  for (const l of lines){
    const m = l.match(/^(?:round|રાઉન્ડ|રાઉંડ)\s*[-:]?\s*(\d+)\s*(?:[-:].*)?$/i);
    if (m){ cur = +m[1]-1; if (cur<0 || cur>=R){ errors.push('Round '+m[1]+' માન્ય નથી (1 થી '+R+' જ)'); cur=-1; } continue; }
    if (l.startsWith('#') || l.startsWith('//')) continue;
    const qa = parseLine(l);
    if (!qa){ bad.push(l); continue; }
    if (cur>=0) rounds[cur].push(qa); else flat.push(qa);
  }
  if (flat.length && rounds.every(r=>r.length===0) && flat.length===R*P){ for (let i=0;i<R;i++) rounds[i]=flat.slice(i*P,(i+1)*P); }
  else if (flat.length){ errors.push('Round ની લાઇન (જેમ કે "Round 1") પહેલાં '+flat.length+' Question છે.'); }
  if (bad.length) errors.push(bad.length+' લાઇન સમજાઈ નહિ (format Question::Answer): '+bad.slice(0,3).join(' | '));
  rounds.forEach((r,i)=>{ if (r.length!==P) errors.push('Round '+(i+1)+' માં '+r.length+' Question છે, '+P+' જોઈએ.'); });
  const seen = {};
  rounds.forEach((r,i)=>r.forEach(q=>{ const k=q.a.toLowerCase(); if(seen[k]!==undefined) errors.push('જવાબ "'+q.a+'" Round '+(seen[k]+1)+' અને Round '+(i+1)+' બંનેમાં છે (દરેક જવાબ અલગ જોઈએ).'); else seen[k]=i; }));
  const questions = [].concat(...rounds);
  return { ok: errors.length===0, errors, questions, counts: rounds.map(r=>r.length) };
}
function shuffle(a){ const arr=a.slice(); for(let i=arr.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1)); [arr[i],arr[j]]=[arr[j],arr[i]];} return arr; }
// Card = 25 answers. From every round we take a FIXED number of answers (Rounds 1-4: 4 each, Rounds 5-7: 3 each),
// but WHICH answers and WHERE they sit is random for every player. A round never has all 5 answers on a card.
function makeCard(questions){
  const P = CFG.perRound, out = [];
  for (let r=0; r<CFG.rounds; r++){
    const pool = shuffle(questions.slice(r*P,(r+1)*P).map(q=>q.a));
    out.push(...pool.slice(0, CFG.cardCounts[r]));
  }
  return shuffle(out);
}
function makeBoxVals(){ return Array.from({length:CFG.rounds}, ()=>shuffle(CFG.boxPool)); }
function randCode(){ const c='ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let s='GYAN'; for(let i=0;i<4;i++) s+=c[Math.floor(Math.random()*c.length)]; return s; }

const rooms = {}; // code -> room object

function playerResults(room, pname){
  const p = room.players[pname];
  const cellState = Array(25).fill('none');
  Object.entries(p.marks).forEach(([ci,qi]) => {
    ci = +ci;
    cellState[ci] = (room.questions[qi] && room.questions[qi].a === p.card[ci]) ? 'green' : 'red';
  });
  const usedAnswers = room.usedIdx.map(i => room.questions[i].a);
  for (let ci=0; ci<25; ci++) if (cellState[ci]==='none' && usedAnswers.includes(p.card[ci])) cellState[ci]='yellow';
  const correctRows = LINES.filter(line => line.every(ci=>cellState[ci]==='green')).length;
  const correctCount = cellState.filter(s=>s==='green').length;
  const wrongCount = cellState.filter(s=>s==='red').length;
  const rounds = roundBreakdown(room, p);
  const netScore = rounds.reduce((a,o)=>a+o.score,0); // FINAL SCORE = correct x2 - wrong x1 + Mystery Box points
  const boxTotal = rounds.reduce((a,o)=>a+o.box,0);
  const fullHouse = cellState.every(s=>s==='green');
  return { cellState, correctRows, correctCount, wrongCount, netScore, boxTotal, rounds, fullHouse };
}
// Round wise marks: a click is judged by the round of the question it was made for.
function roundBreakdown(room, p){
  const P = CFG.perRound, n = CFG.rounds;
  const rd = Array.from({length:n}, ()=>({correct:0,wrong:0,box:0,score:0}));
  Object.entries(p.marks).forEach(([ci,qi])=>{
    const ri = Math.floor(qi/P); if(!rd[ri]) return;
    if (room.questions[qi] && room.questions[qi].a === p.card[+ci]) rd[ri].correct++; else rd[ri].wrong++;
  });
  rd.forEach((o,ri)=>{
    const pick = (p.boxPick||[])[ri];
    const v = (pick!=null && p.boxVals && p.boxVals[ri]) ? p.boxVals[ri][pick] : 0;
    o.box = v * (ri===n-1 ? CFG.lastRoundMult : 1);
    o.score = o.correct*CFG.correctPts - o.wrong*CFG.wrongPts + o.box;
  });
  return rd;
}
function computeWinners(room){
  const winners = {};
  for (const cat of ['line1','line2','line3','line4','line5','full']){
    let best=null, tied=[];
    for (const [name,p] of Object.entries(room.players)){
      if (!p.claims || !p.claims[cat]) continue;
      const valid = p.claims[cat].valid === true; // judged when the claim was made
      if (valid){
        const ts=p.claims[cat].ts;
        if(!best || ts<best.ts){ best={name,ts}; tied=[name]; }
        else if(ts===best.ts){ tied.push(name); }
      }
    }
    winners[cat] = best?best.name:null;
    winners[cat+'_ts'] = best?best.ts:null;
    winners[cat+'_ms'] = best?Math.max(0,best.ts-(room.startedAt||room.createdAt)):null; // time taken from game start
    winners[cat+'_tie'] = tied.length>1 ? tied : null; // more than one player claimed validly at the exact same moment
  }
  // Top 3 by Final Score (ties: more correct answers, then fewer wrong, then who joined first)
  const ranked = Object.entries(room.players).map(([name,p])=>({name,p,res:playerResults(room,name)}))
    .sort((a,b)=> b.res.netScore-a.res.netScore || b.res.correctCount-a.res.correctCount || a.res.wrongCount-b.res.wrongCount || a.p.joinedAt-b.p.joinedAt);
  [['top1',0],['top2',1],['top3',2]].forEach(([k,i])=>{ const x=ranked[i]; winners[k]=x?x.name:null; winners[k+'_score']=x?x.res.netScore:null; winners[k+'_correct']=x?x.res.correctCount:null; winners[k+'_wrong']=x?x.res.wrongCount:null; });
  // Zone winner: zone with the highest AVERAGE net score (ties -> higher total)
  const zs={};
  for (const [name,p] of Object.entries(room.players)){
    const zn=(p.zone||'').trim(); if(!zn) continue;
    const k=zn.toLowerCase(); const res=playerResults(room,name);
    if(!zs[k]) zs[k]={zone:zn,count:0,total:0};
    zs[k].count++; zs[k].total+=res.netScore;
  }
  let bz=null;
  for (const z of Object.values(zs)){ z.avg=z.total/z.count; if(!bz || z.avg>bz.avg || (z.avg===bz.avg && z.total>bz.total)) bz=z; }
  winners.zone = bz && bz.avg>0 ? bz.zone : null;
  winners.zone_avg = bz && bz.avg>0 ? Math.round(bz.avg*100)/100 : null;
  winners.zone_total = bz && bz.avg>0 ? bz.total : null;
  winners.zone_count = bz && bz.avg>0 ? bz.count : null;
  return winners;
}
function publicRoom(room){
  // Until results are revealed, never send correct answers or claim validity to browsers.
  if (room.status==='revealed') return {...room, cfg:publicCfg()};
  const players = {};
  for (const [n,p] of Object.entries(room.players)){
    const claims = {};
    for (const [k,c] of Object.entries(p.claims||{})) claims[k] = {ts:(c.shownTs||c.ts), marks:c.marks};
    const pp = {...p, claims, boxVals: undefined};   // Mystery Box contents never leave the server before the Box Opening
    if (room.status==='opening') pp.boxRes = (p.boxPick||[]).map((pk,i)=> pk==null?null:(p.boxVals[i][pk]*(i===CFG.rounds-1?CFG.lastRoundMult:1)));
    players[n] = pp;
  }
  return {...room, cfg:publicCfg(), questions: room.questions.map(q=>({q:q.q, img:q.img})), players};
}
// Host-only backup: the host's browser keeps the FULL room (with answers) so that if the server
// sleeps/restarts (Render free tier), the host can restore the game instantly.
const bkTimers = {};
function scheduleBackup(code){
  if (bkTimers[code]) return;
  bkTimers[code] = setTimeout(()=>{ delete bkTimers[code]; if (rooms[code]) io.to(code+'#h').emit('backup', rooms[code]); }, 1500);
}
function broadcast(code){
  if (rooms[code]){ io.to(code).emit('state', publicRoom(rooms[code])); scheduleBackup(code); }
}

// Players who did not pick a Box in time get a random one (so everyone ends with 7 Boxes)
function autoPickBoxes(r, round){
  for (const p of Object.values(r.players)){
    if (!p.boxPick) p.boxPick = Array(CFG.rounds).fill(null);
    if (p.boxPick[round]==null) p.boxPick[round] = Math.floor(Math.random()*6);
  }
}
setInterval(() => {
  for (const code of Object.keys(rooms)){
    const r = rooms[code];
    if (r.status==='question' && !r.paused && r.timerEnd && Date.now()>=r.timerEnd){
      r.status='locked';
      broadcast(code);
    }
    if (r.status==='box' && r.boxEnd && Date.now()>=r.boxEnd && !r.boxAuto){
      r.boxAuto = true; autoPickBoxes(r, r.round); broadcast(code);
    }
  }
}, 1000);

io.on('connection', (socket) => {
  socket.on('subscribe', ({code, host}, cb) => {
    if (rooms[code]){
      socket.join(code);
      if (host){ socket.join(code+'#h'); scheduleBackup(code); }
      cb && cb({ok:true, room: publicRoom(rooms[code])});
    }
    else cb && cb({ok:false, error:'Room code મળ્યો નહિ.'});
  });

  // Players call this every few seconds: re-joins the room after a server restart/restore.
  socket.on('resync', ({code}, cb) => {
    const r = rooms[code];
    if (!r){ cb && cb({ok:false}); return; }
    if (socket.rooms.has(code)) { cb && cb({ok:true}); return; }
    socket.join(code); cb && cb({ok:true, room: publicRoom(r)});
  });

  // Host restores a game from the backup kept in the host's browser (after server sleep/restart).
  socket.on('host:restore', ({room}, cb) => {
    try{
      if (!room || typeof room.code!=='string' || !room.players || !Array.isArray(room.questions)){ cb&&cb({ok:false,error:'Backup ખરાબ છે.'}); return; }
      const code = room.code;
      if (!rooms[code]){
        const r = room;
        // a spin that never completed is cancelled; give the question back to the wheel
        if (r.status==='spinning' || r.status==='revealing'){
          r.usedIdx = (r.usedIdx||[]).filter(i=>i!==r.curIdx); r.curIdx=null; r.status='active'; r.timerEnd=null;
        }
        if (r.status==='question' && !r.paused && (!r.timerEnd || r.timerEnd<Date.now())) r.status='locked';
        r.clientMap = r.clientMap || {};
        rooms[code] = r;
      }
      socket.join(code); socket.join(code+'#h');
      cb && cb({ok:true, code});
      broadcast(code);
    }catch(e){ cb && cb({ok:false, error:String(e.message||e)}); }
  });

  // ---- Pause / Resume the question timer ----
  socket.on('host:pause', ({code}) => {
    const r = rooms[code]; if(!r || r.status!=='question' || r.paused) return;
    r.paused = true; r.pausedMs = Math.max(0, (r.timerEnd||0)-Date.now()); r.timerEnd = null;
    broadcast(code);
  });
  socket.on('host:resume', ({code}) => {
    const r = rooms[code]; if(!r || !r.paused) return;
    r.paused = false; r.timerEnd = Date.now() + (r.pausedMs||0); r.pausedMs = null;
    broadcast(code);
  });

  // ---- Undo the last spin (only if nobody has claimed since that spin) ----
  socket.on('host:undoSpin', ({code}, cb) => {
    const r = rooms[code]; if(!r){ cb&&cb({ok:false}); return; }
    if (r.curIdx==null || !['question','locked','revealing'].includes(r.status) || !r.usedIdx.includes(r.curIdx)){ cb&&cb({ok:false,error:'Undo કરવા જેવું કોઈ Question નથી.'}); return; }
    for (const p of Object.values(r.players)){
      for (const c of Object.values(p.claims||{})){
        if (c.shownTs>=r.lastSpinAt || c.ts>=r.lastSpinAt){ cb&&cb({ok:false,error:'આ Question પછી કોઈ Player એ Claim કરી દીધી છે, એટલે Undo થઈ શકશે નહિ.'}); return; }
      }
    }
    const idx = r.curIdx;
    r.usedIdx = r.usedIdx.filter(i=>i!==idx);
    for (const p of Object.values(r.players)){
      for (const ci of Object.keys(p.marks)) if (p.marks[ci]===idx) delete p.marks[ci];
    }
    r.status='active'; r.curIdx=null; r.timerEnd=null; r.paused=false; r.pausedMs=null;
    cb && cb({ok:true});
    broadcast(code);
  });

  socket.on('host:login', ({id,pw}, cb) => {
    cb && cb({ok: id===HOST_ID && pw===HOST_PW});
  });

  socket.on('host:create', ({hostName, maxPlayers, qaText}, cb) => {
    const code = randCode();
    const useDefault = !(qaText||'').trim();
    const parsed = parseRounds(useDefault ? defaultQuestionsText() : qaText);
    if (!parsed.ok){ cb && cb({ok:false, error:(useDefault?'questions.txt માં ભૂલ:\n':'Questions માં ભૂલ:\n')+parsed.errors.join('\n')}); return; }
    rooms[code] = {
      code, hostName, maxPlayers: maxPlayers||null, status:'lobby',
      questions: parsed.questions, usedIdx:[], curIdx:null, timerEnd:null,
      round:0, roundsDone:0, boxEnd:null, boxAuto:false,
      players:{}, winners:null, revealStep:0, createdAt: Date.now()
    };
    socket.join(code);
    cb && cb({ok:true, code, parseInfo:{count:parsed.questions.length, usedDefault:useDefault}});
    broadcast(code);
  });

  socket.on('host:start', ({code}) => { const r=rooms[code]; if(!r) return; r.status='active'; if(!r.startedAt) r.startedAt=Date.now(); broadcast(code); });

  const REVEAL_MS=1600;       // how long the big number popup stays up before the question appears
  const SPIN_SAFETY_MS=6000;  // safety net only — if host's browser never confirms, auto-advance so the game can't get stuck
  socket.on('host:spin', ({code}) => {
    const r = rooms[code]; if(!r) return;
    if(r.status!=='active' && r.status!=='locked') return; // ignore duplicate/racing spin clicks — fixes skipped questions
    const avail=[]; for(let i=r.round*CFG.perRound;i<(r.round+1)*CFG.perRound;i++) if(!r.usedIdx.includes(i)) avail.push(i);
    if (avail.length===0) return; // this round is finished: Host starts the Mystery Box instead
    const idx = avail[Math.floor(Math.random()*avail.length)];
    r.status='spinning'; r.curIdx=idx; r.usedIdx=[...r.usedIdx, idx]; r.timerEnd=null; r.paused=false; r.pausedMs=null; r.lastSpinAt=Date.now();
    broadcast(code);
    // Safety net only: if the host's own wheel never confirms completion (tab closed, crash, etc.),
    // reveal anyway after a generous timeout so the game never gets permanently stuck.
    setTimeout(()=>{
      const rr=rooms[code]; if(!rr||rr.status!=='spinning'||rr.curIdx!==idx) return;
      advanceToRevealing(code, idx);
    }, SPIN_SAFETY_MS);
  });
  function advanceToRevealing(code, idx){
    const r=rooms[code]; if(!r||r.status!=='spinning'||r.curIdx!==idx) return;
    r.status='revealing'; broadcast(code);
    setTimeout(()=>{
      const rr=rooms[code]; if(!rr||rr.status!=='revealing'||rr.curIdx!==idx) return;
      rr.status='question'; rr.timerEnd=Date.now()+(rr.qSec||30)*1000; broadcast(code);
    }, REVEAL_MS);
  }
  // Host's own wheel tells us exactly when its CSS animation visually finished — no guessing, no drift.
  socket.on('host:spinComplete', ({code, idx}) => { advanceToRevealing(code, idx); });

  // Host: question timer length (10-60 s) and skip the remaining time
  socket.on('host:setTimer', ({code, sec}) => {
    const r = rooms[code]; if(!r) return;
    sec = Math.round(+sec); if(!(sec>=10 && sec<=60)) return;
    r.qSec = sec; broadcast(code);
  });
  socket.on('host:skipTimer', ({code}) => {
    const r = rooms[code]; if(!r || r.status!=='question') return;
    r.status='locked'; r.paused=false; r.pausedMs=null; r.timerEnd=null; broadcast(code);
  });

  // ---- Round finished -> Mystery Box (every player picks 1 of 6 boxes; contents stay secret) ----
  socket.on('host:startBox', ({code}) => {
    const r = rooms[code]; if(!r || r.status!=='locked') return;
    const done = r.usedIdx.filter(i=>Math.floor(i/CFG.perRound)===r.round).length;
    if (done < CFG.perRound) return;
    r.status='box'; r.roundsDone = r.round+1; r.boxEnd = Date.now()+CFG.boxSec*1000; r.boxAuto=false;
    broadcast(code);
  });
  // Host: next round (new wheel) — after the LAST round it opens the "Box Opening" screen instead
  socket.on('host:nextRound', ({code}) => {
    const r = rooms[code]; if(!r || r.status!=='box') return;
    autoPickBoxes(r, r.round); r.boxAuto = true;
    if (r.round >= CFG.rounds-1){ r.status='opening'; r.boxEnd=null; }
    else { r.round++; r.status='active'; r.curIdx=null; r.timerEnd=null; r.boxEnd=null; r.boxAuto=false; }
    broadcast(code);
  });
  socket.on('player:boxPick', ({code,name,idx}) => {
    const r = rooms[code]; if(!r || r.status!=='box') return;
    const p = r.players[name]; if(!p) return;
    idx = Math.round(+idx); if(!(idx>=0 && idx<6)) return;
    if (!p.boxPick) p.boxPick = Array(CFG.rounds).fill(null);
    if (p.boxPick[r.round]!=null) return;       // one pick only, can't change
    p.boxPick[r.round] = idx; broadcast(code);
  });

  socket.on('host:end', ({code}) => { const r=rooms[code]; if(!r) return; r.status='ended'; r.paused=false; broadcast(code); });

  // Host's live note shown under every player's Scratch Card message
  socket.on('host:scNote', ({code, text}, cb) => {
    const r = rooms[code]; if(!r){ cb&&cb({ok:false}); return; }
    r.scNote = String(text||'').replace(/[\u0000-\u001f]+/g,' ').trim().slice(0,140);
    broadcast(code); cb&&cb({ok:true});
  });

  // Host reveals the Scratch Card to every player
  socket.on('host:scReveal', ({code, on}, cb) => {
    const r = rooms[code]; if(!r){ cb&&cb({ok:false}); return; }
    r.scReveal = !!on; broadcast(code); cb&&cb({ok:true});
  });

  socket.on('host:reveal', ({code}) => {
    const r = rooms[code]; if(!r) return;
    for (let i=0;i<=Math.min(r.round, CFG.rounds-1);i++){ if (i<r.roundsDone) autoPickBoxes(r, i); }
    r.winners = computeWinners(r); r.status='revealed'; r.revealStep=1;
    broadcast(code);
  });

  socket.on('host:nextWinner', ({code}) => {
    const r = rooms[code]; if(!r) return;
    r.revealStep = (r.revealStep||0)+1;
    broadcast(code);
  });

  socket.on('player:join', ({code,name,zone,avatar,clientId}, cb) => {
    const r = rooms[code]; if(!r){ cb&&cb({ok:false,error:'Room code મળ્યો નહિ.'}); return; }
    name=(name||'').trim(); zone=(zone||'').trim();
    if(!name){ cb&&cb({ok:false,error:'નામ લખો.'}); return; }
    if(!r.clientMap) r.clientMap = {};
    const norm = x => (x||'').trim().toLowerCase();
    // 1) same device + same name + same zone => reconnecting (refresh / network drop): resume own card
    const mine = clientId && r.clientMap[clientId];
    if(mine && r.players[mine] && norm(r.players[mine].baseName)===norm(name) && norm(r.players[mine].zone)===norm(zone)){
      socket.join(code);
      cb && cb({ok:true, room: publicRoom(r), yourKey:mine, resumed:true});
      broadcast(code);
      return;
    }
    // 2) another player with the same name AND same zone already exists => ask for a different name
    const dup = Object.values(r.players).some(p => norm(p.baseName)===norm(name) && norm(p.zone)===norm(zone));
    if(dup){ cb&&cb({ok:false,error:'⚠️ આ નામ અને Zone વાળા Player પહેલેથી Join થઈ ગયા છે. કૃપા કરીને બીજું નામ (અથવા અટક/ઉપનામ સાથે) વાપરો.'}); return; }
    if (r.maxPlayers && Object.keys(r.players).length>=r.maxPlayers){ cb&&cb({ok:false,error:'Room ભરાઈ ગયો છે.'}); return; }
    // 3) same name in a different zone is allowed; give it a unique internal key "Name (2)"
    let key = name;
    if(r.players[key]){
      let n=2; while(r.players[`${name} (${n})`]) n++;
      key = `${name} (${n})`;
    }
    r.players[key] = { card: makeCard(r.questions), boxVals: makeBoxVals(), boxPick: Array(CFG.rounds).fill(null), baseName: name, zone, avatar: avatar||'🦁', marks:{}, claims:{}, joinedAt: Date.now() };
    if(clientId) r.clientMap[clientId] = key;
    socket.join(code);
    cb && cb({ok:true, room: publicRoom(r), yourKey:key});
    broadcast(code);
  });

  socket.on('player:mark', ({code,name,ci}) => {
    const r = rooms[code]; if(!r || r.status!=='question' || r.paused) return;
    const p = r.players[name]; if(!p) return;
    const already = Object.values(p.marks).includes(r.curIdx);
    if (already || p.marks[ci]!==undefined) return;
    p.marks[ci] = r.curIdx;
    broadcast(code);
  });

  socket.on('player:claim', ({code,name,type}) => {
    const r = rooms[code]; if(!r) return;
    const p = r.players[name]; if(!p) return;
    if(!p.claims) p.claims={};
    if(!/^(line[1-5]|full)$/.test(type)) return;
    const now = Date.now();
    const res = playerResults(r, name);       // validity is judged at the moment of the claim
    const marks = Object.keys(p.marks).length;
    const put = (key, need) => {
      const valid = key==='full' ? res.fullHouse : res.correctRows>=need;
      const old = p.claims[key];
      if(old && old.valid){ old.marks = marks; return; }   // an earlier valid claim always stays (earliest time wins)
      // shownTs = time of the player's FIRST click; it never changes, so a player can't tell from the clock
      // whether an earlier claim was wrong. ts = official time used for winners (only revealed at the end).
      p.claims[key] = {ts: now, shownTs: old ? (old.shownTs||old.ts) : now, valid, marks};
    };
    put(type, type==='full'?null:+type.replace('line',''));
    // Claiming "N Line" also registers 1..N-1 Line, each judged on its own truth.
    // So: 1 Line claimed wrongly earlier + 2 Line claimed rightly later => 1 Line also becomes valid (at the later time).
    if(/^line[2-5]$/.test(type)){
      const n = +type.replace('line','');
      for(let k=1;k<n;k++) put('line'+k, k);
    }
    broadcast(code);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log('Gyan Shodh Quiz server running on port '+PORT));
