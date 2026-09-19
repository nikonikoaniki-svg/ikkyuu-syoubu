const PITCHES = [
  "フォーシーム","ツーシーム","カットボール",
  "スライダー","フォーク","チェンジアップ"
];

const CLOSE_PITCHES = {
  "フォーシーム": ["ツーシーム","カットボール"],
  "ツーシーム": ["フォーシーム","カットボール"],
  "カットボール": ["フォーシーム","ツーシーム","スライダー"],
  "スライダー": ["カットボール"],
  "フォーク": ["チェンジアップ"],
  "チェンジアップ": ["フォーク"]
};

const PERSONALITIES = ["強気","冷静","かわす"];
const RATING_WEIGHT = {"◎":6, "○":4, "△":2, "×":0};

// 右バッター基準：右側が内角
const ZONE_NAMES = [
  "外角高め","真ん中高め","内角高め",
  "外角真ん中","真ん中","内角真ん中",
  "外角低め","真ん中低め","内角低め"
];

let state = {};

function randInt(n){ return Math.floor(Math.random()*n); }
function pick(arr){ return arr[randInt(arr.length)]; }
function sleep(ms){ return new Promise(r=>setTimeout(r,ms)); }

function weightedPick(items){
  const total = items.reduce((s,x)=>s+Math.max(0,x.weight),0);
  if(total <= 0) return pick(items).value;
  let r = Math.random()*total;
  for(const item of items){
    r -= Math.max(0,item.weight);
    if(r <= 0) return item.value;
  }
  return items[items.length-1].value;
}

function makeArsenal(){
  let ratings = PITCHES.map(()=>pick(["×","△","○","○","◎"]));
  if(!ratings.includes("◎")) ratings[randInt(ratings.length)] = "◎";
  if(ratings.every(x=>"×"===x)) ratings[0] = "◎";
  let active = ratings.filter(x=>x!=="×").length;
  if(active < 2){
    const idx = ratings.findIndex(x=>x==="×");
    if(idx>=0) ratings[idx] = "○";
  }
  if(ratings.every(x=>x!=="×")){
    ratings[randInt(ratings.length)] = "×";
    if(!ratings.includes("◎")) ratings[0] = "◎";
  }
  return Object.fromEntries(PITCHES.map((p,i)=>[p,ratings[i]]));
}

function personalityPitchAdjustment(personality, pitch, arsenal, history){
  let adj = 0;
  const rating = arsenal[pitch];
  const recent = history.map(h=>h.pitch);
  const count = recent.filter(p=>p===pitch).length;
  const last = recent[recent.length-1];

  if(personality==="強気"){
    if(rating==="◎") adj += 5;
    if(rating==="○") adj += 1;
    if(last===pitch) adj += 1;
  }
  if(personality==="冷静"){
    if(count>=3) adj -= 4;
    else if(count===2) adj -= 2;
    if(count===0) adj += 2;
    if(last===pitch) adj -= 1;
    if(rating==="◎") adj += 2;
  }
  if(personality==="かわす"){
    if(last===pitch) adj -= 5;
    if(count===0) adj += 3;
    if(rating==="△") adj += 2;
    if(rating==="◎") adj += 1;
  }
  return adj;
}

function personalityZoneAdjustment(personality, zone, history){
  let adj = 0;
  const recentZones = history.map(h=>h.zone);
  const count = recentZones.filter(z=>z===zone).length;
  const last = recentZones[recentZones.length-1];

  if(personality==="強気"){
    if(zone===4) adj += 2;
    if(last===zone) adj += 1;
  }
  if(personality==="冷静"){
    if(count>=2) adj -= 3;
    if(count===0) adj += 1;
    if(zone===0 || zone===2 || zone===6 || zone===8) adj += 1;
  }
  if(personality==="かわす"){
    if(last===zone) adj -= 4;
    if(count===0) adj += 2;
    if(zone===0 || zone===2 || zone===6 || zone===8) adj += 2;
  }
  return adj;
}

function generateHistory(arsenal){
  const active = PITCHES.filter(p=>arsenal[p]!=="×");
  const outcomes = shuffle(["ボール","ボール","ボール","ストライク","ストライク"]);
  return Array.from({length:5},(_,i)=>({
    pitch: weightedPick(active.map(p=>({value:p, weight:RATING_WEIGHT[arsenal[p]]}))),
    zone: randInt(9),
    outcome: outcomes[i]
  }));
}

function shuffle(a){
  const b=[...a];
  for(let i=b.length-1;i>0;i--){
    const j=randInt(i+1);
    [b[i],b[j]]=[b[j],b[i]];
  }
  return b;
}

function chooseSixthPitch(){
  const active=PITCHES.filter(p=>state.arsenal[p]!=="×");
  const pitchItems=active.map(p=>{
    let w=RATING_WEIGHT[state.arsenal[p]];
    w += personalityPitchAdjustment(state.personality,p,state.arsenal,state.history);
    w *= (0.94 + Math.random()*0.12);
    return {value:p,weight:Math.max(.2,w)};
  });
  const pitch=weightedPick(pitchItems);

  const zoneItems=Array.from({length:9},(_,z)=>{
    let w=4 + personalityZoneAdjustment(state.personality,z,state.history);
    w *= (0.94 + Math.random()*0.12);
    return {value:z,weight:Math.max(.2,w)};
  });
  const zone=weightedPick(zoneItems);
  return {pitch,zone};
}

function areAdjacent(a,b){
  const ar=Math.floor(a/3), ac=a%3;
  const br=Math.floor(b/3), bc=b%3;
  return ar===br && Math.abs(ac-bc)===1;
}

function getPitchJudge(actualPitch, guessPitch){
  if(actualPitch===guessPitch) return "ドンピシャ！";
  if((CLOSE_PITCHES[actualPitch]||[]).includes(guessPitch)) return "おしい！";
  return "ダメ！";
}

function getZoneJudge(actualZone, guessZone){
  if(actualZone===guessZone) return "ドンピシャ！";
  if(areAdjacent(actualZone, guessZone)) return "おしい！";
  return "ダメ！";
}

function getHomeRunChanceByJudge(pitchJudge, zoneJudge){
  if(pitchJudge==="ドンピシャ！" && zoneJudge==="ドンピシャ！") return 98;
  if(pitchJudge==="ドンピシャ！" && zoneJudge==="おしい！") return 70;
  if(pitchJudge==="おしい！" && zoneJudge==="ドンピシャ！") return 50;
  if(pitchJudge==="おしい！" && zoneJudge==="おしい！") return 35;
  if(pitchJudge==="ドンピシャ！" && zoneJudge==="ダメ！") return 25;
  if(pitchJudge==="ダメ！" && zoneJudge==="ドンピシャ！") return 20;
  if(pitchJudge==="おしい！" && zoneJudge==="ダメ！") return 10;
  if(pitchJudge==="ダメ！" && zoneJudge==="おしい！") return 3;
  return 1;
}

function judgeClass(label){
  if(label==="ドンピシャ！") return "hit-good";
  if(label==="おしい！") return "hit-close";
  return "hit-bad";
}

function getHint(personality, arsenal){
  const best = [];
  const good = [];
  const ok = [];
  for(const p of PITCHES){
    if(arsenal[p]==="◎") best.push(p);
    else if(arsenal[p]==="○") good.push(p);
    else if(arsenal[p]==="△") ok.push(p);
  }
  if(personality==="強気"){
    return `強気タイプです。勝負どころでは「${best[0] || good[0] || ok[0]}」のような得意球で押してくるかもしれません。`;
  }
  if(personality==="冷静"){
    return `冷静タイプです。ここまで5球を見ながら、持ち球の中からバランスよく選ぶことが多いです。`;
  }
  return `かわすタイプです。直前と同じ球を避けたり、意外な球種で外してくることがあります。`;
}

function speak(text){
  if(!("speechSynthesis" in window)) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang="ja-JP";
  u.rate=.95;
  speechSynthesis.speak(u);
}

function initGame(){
  state={
    personality:pick(PERSONALITIES),
    arsenal:makeArsenal(),
    history:[],
    guessPitch:null,
    guessZone:null,
    locked:false
  };
  state.history=generateHistory(state.arsenal);
  render();
}

function render(){
  document.getElementById("personality").textContent=state.personality;
  document.getElementById("hintText").textContent=getHint(state.personality, state.arsenal);

  const arsenal=document.getElementById("arsenal");
  arsenal.innerHTML="";
  for(const p of PITCHES){
    const row=document.createElement("div");
    row.className="arsenal-row";
    row.innerHTML=`<span>${p}</span><span class="rating">${state.arsenal[p]}</span>`;
    arsenal.appendChild(row);
  }

  const history=document.getElementById("history");
  history.innerHTML="";
  state.history.forEach((h,i)=>{
    const item=document.createElement("div");
    item.className="history-item";
    const mini=Array.from({length:9},(_,z)=>`<div class="mini-cell">${z===h.zone?"●":""}</div>`).join("");
    item.innerHTML=`
      <div class="ball-num">${i+1}</div>
      <div class="history-main"><strong>${h.pitch}</strong><small>${ZONE_NAMES[h.zone]}／${h.outcome}</small></div>
      <div class="mini-zone">${mini}</div>`;
    history.appendChild(item);
  });

  const choices=document.getElementById("pitchChoices");
  choices.innerHTML="";
  PITCHES.forEach(p=>{
    const b=document.createElement("button");
    b.className="pitch-btn";
    b.textContent=p;
    b.addEventListener("click",()=>{
      if(state.locked)return;
      state.guessPitch=p;
      updateSelection();
    });
    choices.appendChild(b);
  });

  const zone=document.getElementById("zone");
  zone.innerHTML="";
  for(let i=0;i<9;i++){
    const c=document.createElement("button");
    c.className="zone-cell";
    c.textContent=i+1;
    c.title=ZONE_NAMES[i];
    c.addEventListener("click",()=>{
      if(state.locked)return;
      state.guessZone=i;
      updateSelection();
    });
    zone.appendChild(c);
  }
  updateSelection();

  document.getElementById("overlay").classList.add("hidden");
  document.getElementById("retryBtn").classList.add("hidden");
  document.getElementById("resultDetails").classList.add("hidden");
  document.getElementById("resultSummary").classList.add("hidden");
}

function updateSelection(){
  document.querySelectorAll(".pitch-btn").forEach(b=>{
    b.classList.toggle("selected",b.textContent===state.guessPitch);
  });
  document.querySelectorAll(".zone-cell").forEach((c,i)=>{
    c.classList.toggle("selected",i===state.guessZone);
  });
  const ready=state.guessPitch!==null && state.guessZone!==null;
  document.getElementById("decideBtn").disabled=!ready || state.locked;
  document.getElementById("selectionText").textContent=ready
    ? `予想：${state.guessPitch}／${ZONE_NAMES[state.guessZone]}`
    : "球種とコースを選んでください。";
}

async function play(){
  if(state.locked || state.guessPitch===null || state.guessZone===null)return;
  state.locked=true;
  updateSelection();

  const overlay=document.getElementById("overlay");
  const pbp=document.getElementById("playByPlay");
  const summary=document.getElementById("resultSummary");
  const details=document.getElementById("resultDetails");
  const retry=document.getElementById("retryBtn");
  overlay.classList.remove("hidden");
  details.classList.add("hidden");
  summary.classList.add("hidden");
  retry.classList.add("hidden");

  pbp.textContent="ピッチャー振りかぶって――";
  await sleep(900);
  pbp.textContent="第6球、投げた！";
  await sleep(1500);

  const actual=chooseSixthPitch();
  const pitchJudge = getPitchJudge(actual.pitch, state.guessPitch);
  const zoneJudge = getZoneJudge(actual.zone, state.guessZone);
  const hrPercent = getHomeRunChanceByJudge(pitchJudge, zoneJudge);
  const homer=Math.random() < (hrPercent/100);

  if(homer){
    pbp.innerHTML="打ったー！<br><span style='font-size:.78em'>逆転サヨナラ満塁ホームラン！</span>";
    speak("ホームラン！");
  }else{
    pbp.innerHTML="三振！<br><span style='font-size:.82em'>ゲームセット！</span>";
    speak("ゲームセット！");
  }

  summary.innerHTML = `
    <div class="result-summary-grid">
      <div class="summary-box">
        <strong>球種</strong>
        <span class="${judgeClass(pitchJudge)}">${pitchJudge}</span>
      </div>
      <div class="summary-box">
        <strong>コース</strong>
        <span class="${judgeClass(zoneJudge)}">${zoneJudge}</span>
      </div>
      <div class="summary-box">
        <strong>ホームラン確率</strong>
        <span>${hrPercent}%</span>
      </div>
    </div>`;
  summary.classList.remove("hidden");

  details.innerHTML=`
    <div class="detail-box">
      <strong>第6球</strong>
      ${actual.pitch}<br>${ZONE_NAMES[actual.zone]}
    </div>
    <div class="detail-box">
      <strong>あなたの読み</strong>
      ${state.guessPitch}<br>${ZONE_NAMES[state.guessZone]}
    </div>`;
  details.classList.remove("hidden");
  retry.classList.remove("hidden");
}

document.getElementById("decideBtn").addEventListener("click",play);
document.getElementById("retryBtn").addEventListener("click",initGame);

initGame();
