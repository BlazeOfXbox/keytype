(() => {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];
  const STORE = 'keytype-v2';
  const WORDS = {
    easy: 'the and you that was for are with this have from they will one all can just like time good make know take into year your some them then than look way more find here thing well life only over think also back after use work first even want give most'.split(' '),
    normal: 'ability about across almost always answer around become before better between change choice create different enough example family follow future happen important interest keyboard language learn little moment morning natural number people perhaps practice problem question quickly reason remember result sentence several simple something speed still story strong success system together understand usually value various website whether without wonder world typing focus rhythm'.split(' '),
    hard: 'algorithm ambiguous asynchronous bandwidth circumference conscientious consequently cryptocurrency decentralization discrepancy enthusiastic hexadecimal infrastructure juxtaposition labyrinthine meticulous nomenclature perseverance quintessential resilience synchronization transcontinental unequivocally versatility'.split(' ')
  };
  const QUOTES = [
    'Great things are done by a series of small things brought together.',
    'It always seems impossible until it is done.',
    'The secret of getting ahead is getting started.',
    'Success is the sum of small efforts, repeated day in and day out.',
    'Focus on being productive instead of busy.',
    'Practice does not make perfect. Only perfect practice makes perfect.'
  ];
  const defaults = {theme:'serika',fontSize:28,animations:true,sound:false,volume:20,punctuation:false,numbers:false,difficulty:'normal',customWords:'',customQuote:'',profile:'typist'};
  let data = loadData();
  let settings = {...defaults,...data.settings};
  let mode = 'time', duration = 30, wordCount = 25, difficulty = settings.difficulty;
  let target = [], typed = '', startedAt = 0, deadline = 0, timerId = null, finished = false, soundContext = null, samples = [], testStartLength = 0;
  const input = $('#typingInput'), display = $('#wordDisplay');

  function loadData() {
    try { const d = JSON.parse(localStorage.getItem(STORE) || '{}'); return {settings:d.settings || {}, history:Array.isArray(d.history)?d.history:[]}; }
    catch { return {settings:{},history:[]}; }
  }
  function persist() { try { localStorage.setItem(STORE, JSON.stringify(data)); } catch { $('#saveMessage').textContent = 'Browser storage is full; this result may not be saved.'; } }
  function applySettings() {
    document.body.dataset.theme = settings.theme;
    document.documentElement.style.setProperty('--font-size', `${settings.fontSize}px`);
    document.body.classList.toggle('no-animations', !settings.animations);
    $('#profileName').value = settings.profile || 'typist';
    $('#themeSelect').value = settings.theme; $('#fontSizeSelect').value = String(settings.fontSize);
    $('#animationToggle').checked = settings.animations; $('#soundToggle').checked = settings.sound;
    $('#soundVolume').value = settings.volume; $('#defaultPunctuation').checked = settings.punctuation;
    $('#defaultNumbers').checked = settings.numbers; $('#defaultDifficulty').value = settings.difficulty;
    $('#customWords').value = settings.customWords; $('#customQuote').value = settings.customQuote;
    $('#settingsProfile').value = settings.profile || 'typist';
    $('#punctuationToggle').checked = settings.punctuation; $('#numbersToggle').checked = settings.numbers;
    $$('.chip[data-difficulty]').forEach(b=>b.classList.toggle('active',b.dataset.difficulty===difficulty));
  }
  function saveSettingsFromUI() {
    settings.theme=$('#themeSelect').value; settings.fontSize=Number($('#fontSizeSelect').value);
    settings.animations=$('#animationToggle').checked; settings.sound=$('#soundToggle').checked;
    settings.volume=Number($('#soundVolume').value); settings.punctuation=$('#defaultPunctuation').checked;
    settings.numbers=$('#defaultNumbers').checked; settings.difficulty=$('#defaultDifficulty').value;
    settings.customWords=$('#customWords').value.trim(); settings.customQuote=$('#customQuote').value.trim();
    settings.profile=($('#settingsProfile').value.trim()||'typist').slice(0,20); difficulty=settings.difficulty;
    data.settings=settings; persist(); applySettings(); $('#settingsMessage').textContent='Settings saved.';
    $$('.chip[data-difficulty]').forEach(b=>b.classList.toggle('active',b.dataset.difficulty===difficulty));
  }
  function randomItem(a) { return a[Math.floor(Math.random()*a.length)]; }
  function generateWords(n) {
    const custom=settings.customWords.split(/[\s,;]+/).filter(Boolean);
    const pool=custom.length?custom:(WORDS[difficulty]||WORDS.normal);
    const out=[];
    for(let i=0;i<n;i++) {
      let w=randomItem(pool);
      if($('#punctuationToggle').checked && Math.random()<.28) w += randomItem([',','.',';','?','!']);
      if($('#numbersToggle').checked && Math.random()<.15) w = String(Math.floor(Math.random()*900+10));
      out.push(w);
    }
    return out.join(' ');
  }
  function makeTarget() {
    if(mode==='quote') {
      const q=settings.customQuote.trim()||randomItem(QUOTES);
      target=[...q]; $('#timerLabel').textContent='quote'; $('#liveTimer').textContent='—';
    } else {
      const count=mode==='words'?wordCount:mode==='zen'?100:Math.max(60,Math.ceil(duration*2.8));
      target=[...generateWords(count)]; $('#timerLabel').textContent=mode==='time'?'time':mode==='words'?'words':'zen';
      $('#liveTimer').textContent=mode==='time'?duration:mode==='words'?wordCount:'∞';
    }
    typed=''; samples=[]; startedAt=0; deadline=0; finished=false; clearInterval(timerId); timerId=null;
    testStartLength=target.length; $('#liveWpm').textContent='0'; $('#liveAccuracy').textContent='100%';
    $('#resultPanel').classList.add('hidden'); $('#saveMessage').textContent=''; input.value=''; renderText(); $('#modeHint').textContent=mode==='zen'?'Zen mode · no timer': 'Start typing to begin';
  }
  function renderText() {
    display.replaceChildren();
    const fragment=document.createDocumentFragment();
    target.forEach((char,i)=>{
      const span=document.createElement('span'); span.className='char'; span.textContent=char===' '?'\u00a0':char;
      if(i<typed.length) span.classList.add(typed[i]===char?'correct':'incorrect');
      if(i===typed.length) {span.classList.add('current'); if(i===0)span.classList.add('start');}
      fragment.append(span);
    });
    if(typed.length>target.length) for(let i=target.length;i<typed.length;i++){const s=document.createElement('span');s.className='char extra incorrect';s.textContent=typed[i];fragment.append(s);}
    display.append(fragment);
    const current=display.querySelector('.current'); if(current) current.scrollIntoView({block:'nearest',inline:'nearest'});
  }
  function metrics() {
    let correct=0,wrong=0,extra=Math.max(0,typed.length-target.length),missed=0;
    for(let i=0;i<Math.min(typed.length,target.length);i++) typed[i]===target[i]?correct++:wrong++;
    if(finished) missed=Math.max(0,target.length-typed.length);
    const elapsed=startedAt?Math.max(.001,(Date.now()-startedAt)/60000):0;
    const wpm=elapsed?Math.round((correct/5)/elapsed):0;
    const raw=elapsed?Math.round((typed.length/5)/elapsed):0;
    const accuracy=typed.length?Math.max(0,Math.round(correct/typed.length*100)):100;
    const consistency=samples.length>2?Math.max(0,Math.round(100-(Math.sqrt(samples.reduce((a,b)=>a+b*b,0)/samples.length)*100))):null;
    return {correct,wrong,extra,missed,wpm,raw,accuracy,consistency};
  }
  function updateLive() {
    const m=metrics(); $('#liveWpm').textContent=m.wpm; $('#liveAccuracy').textContent=`${m.accuracy}%`;
    if(mode==='time'&&startedAt) $('#liveTimer').textContent=Math.max(0,Math.ceil((deadline-Date.now())/1000));
    if(mode==='words') $('#liveTimer').textContent=Math.max(0,wordCount-typed.trim().split(/\s+/).filter(Boolean).length);
  }
  function beginIfNeeded() {
    if(startedAt||finished)return;
    startedAt=Date.now(); deadline=startedAt+duration*1000;
    if(mode==='time') timerId=setInterval(()=>{updateLive();if(Date.now()>=deadline)finishTest();},100);
    $('#modeHint').textContent='Keep going…';
  }
  function beep() {
    if(!settings.sound||settings.volume<=0)return;
    try { soundContext ||= new (window.AudioContext||window.webkitAudioContext)(); if(soundContext.state==='suspended')soundContext.resume();
      const osc=soundContext.createOscillator(),gain=soundContext.createGain(); osc.type='sine';osc.frequency.value=520+Math.random()*120;
      gain.gain.value=(settings.volume/100)*.035;osc.connect(gain);gain.connect(soundContext.destination);osc.start();osc.stop(soundContext.currentTime+.025);
    } catch {}
  }
  function handleTyping() {
    if(finished)return;
    let value=input.value;
    if(!startedAt && value.length)beginIfNeeded();
    if(mode==='time' && startedAt) {const remaining=Math.max(0,Math.ceil((deadline-Date.now())/1000)); if(remaining<=0){finishTest();return;} }
    const prev=typed; typed=value;
    if(value.length>prev.length) {const last=value[value.length-1];if(last===target[value.length-1])beep();}
    const elapsed=startedAt?(Date.now()-startedAt)/1000:0;
    if(elapsed>0 && value.length>prev.length) samples.push(Math.abs(value.length-prev.length));
    renderText();updateLive();
    if(mode==='quote'&&typed.length>=target.length)finishTest();
    if(mode==='words'&&typed.trim().split(/\s+/).filter(Boolean).length>=wordCount && typed.length>=target.length-2)finishTest();
    if(mode==='zen'&&typed.length>=target.length) {target=[...target,...(' '+generateWords(50))];renderText();}
  }
  function finishTest() {
    if(finished)return; finished=true;clearInterval(timerId);timerId=null;
    if(!startedAt)startedAt=Date.now()-1000;
    const m=metrics(); const elapsed=Math.max(1,Math.round((Date.now()-startedAt)/1000));
    $('#resultWpm').textContent=m.wpm; $('#resultRaw').textContent=`raw ${m.raw}`; $('#resultAccuracy').textContent=`${m.accuracy}%`;
    $('#resultChars').textContent=`${m.correct}/${m.wrong}/${m.extra}/${m.missed}`; $('#resultConsistency').textContent=m.consistency===null?'—':`${m.consistency}%`;
    $('#resultPanel').classList.remove('hidden'); $('#modeHint').textContent='Test complete';
    const record={date:new Date().toISOString(),profile:settings.profile||'typist',mode,wpm:m.wpm,raw:m.raw,accuracy:m.accuracy,correct:m.correct,wrong:m.wrong,extra:m.extra,missed:m.missed,seconds:elapsed,difficulty,chars:typed.length};
    data.history.unshift(record);data.history=data.history.slice(0,500);persist();
    const best=Math.max(0,...data.history.filter(r=>r.profile===record.profile).map(r=>r.wpm));
    $('#saveMessage').textContent=`Saved locally for ${record.profile}. Personal best: ${best} WPM.`;
    updateLive();renderStats();
  }
  function setMode(next) {
    mode=next;
    $$('.chip[data-mode]').forEach(b=>b.classList.toggle('active',b.dataset.mode===mode));
    $('#durationOptions').classList.toggle('hidden',mode!=='time'); $('#wordOptions').classList.toggle('hidden',mode!=='words');
    $$('.chip[data-duration]').forEach(b=>b.classList.toggle('active',Number(b.dataset.duration)===duration));
    $$('.chip[data-wordcount]').forEach(b=>b.classList.toggle('active',Number(b.dataset.wordcount)===wordCount));
    makeTarget();
  }
  function showView(view) {
    $$('.view').forEach(el=>el.classList.add('hidden')); ({test:$('#testView'),stats:$('#statsView'),settings:$('#settingsView')})[view].classList.remove('hidden');
    $$('.nav-btn').forEach(b=>b.classList.toggle('active',b.dataset.view===view));
    if(view==='stats')renderStats(); if(view==='test')input.focus();
  }
  function renderStats() {
    const h=data.history.filter(r=>r.profile===(settings.profile||'typist'));
    $('#totalTests').textContent=h.length; $('#bestWpm').textContent=h.length?Math.max(...h.map(r=>r.wpm)):0;
    $('#averageWpm').textContent=h.length?Math.round(h.reduce((a,r)=>a+r.wpm,0)/h.length):0;
    $('#averageAccuracy').textContent=h.length?`${Math.round(h.reduce((a,r)=>a+r.accuracy,0)/h.length)}%`:'—';
    const rows=$('#historyRows');rows.replaceChildren();
    if(!h.length){const tr=document.createElement('tr');tr.innerHTML='<td colspan="5" class="empty-row">Finish a test to see your history.</td>';rows.append(tr);}
    h.slice(0,20).forEach(r=>{const tr=document.createElement('tr');[new Date(r.date).toLocaleString(),r.mode,r.wpm,`${r.accuracy}%`,`${r.seconds}s`].forEach(v=>{const td=document.createElement('td');td.textContent=v;tr.append(td);});rows.append(tr);});
    const top=[...data.history].sort((a,b)=>b.wpm-a.wpm).slice(0,5);const lb=$('#leaderboard');lb.replaceChildren();
    if(!top.length){lb.textContent='No scores yet — finish a test to appear here.';lb.className='leaderboard muted';}
    else {lb.className='leaderboard';top.forEach((r,i)=>{const row=document.createElement('div');row.className='leader-row';const rank=document.createElement('span');rank.className='leader-rank';rank.textContent=`#${i+1}`;const name=document.createElement('strong');name.textContent=r.profile||'typist';const score=document.createElement('span');score.textContent=`${r.wpm} WPM · ${r.accuracy}%`;row.append(rank,name,score);lb.append(row);});}
  }
  function download(filename,content) {const blob=new Blob([content],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;a.click();URL.revokeObjectURL(url);}

  input.addEventListener('input',handleTyping);
  display.addEventListener('click',()=>input.focus());
  document.addEventListener('keydown',e=>{
    if(e.key==='Tab' && !$('#settingsView').classList.contains('hidden'))return;
    if(e.key==='Tab'&& !$('#statsView').classList.contains('hidden'))return;
    if(e.key==='Tab'&& !$('#testView').classList.contains('hidden')){e.preventDefault();if(e.shiftKey)return;}
    if(e.key==='Enter'&&e.target===document.body&&mode!=='quote'){makeTarget();input.focus();}
    if(e.key==='Escape'&&!$('#testView').classList.contains('hidden')){makeTarget();input.focus();}
    if(e.key==='Enter'&&e.target===document.body&&mode==='quote'){makeTarget();input.focus();}
  });
  $('#restartBtn').addEventListener('click',()=>{makeTarget();input.focus();}); $('#resultRestart').addEventListener('click',()=>{makeTarget();input.focus();});
  $$('.chip[data-mode]').forEach(b=>b.addEventListener('click',()=>setMode(b.dataset.mode)));
  $$('[data-duration]').forEach(b=>b.addEventListener('click',()=>{duration=Number(b.dataset.duration);setMode('time');}));
  $$('[data-wordcount]').forEach(b=>b.addEventListener('click',()=>{wordCount=Number(b.dataset.wordcount);setMode('words');}));
  $$('[data-difficulty]').forEach(b=>b.addEventListener('click',()=>{difficulty=b.dataset.difficulty;settings.difficulty=difficulty;data.settings=settings;persist();$$('[data-difficulty]').forEach(x=>x.classList.toggle('active',x===b));makeTarget();}));
  $$('.nav-btn').forEach(b=>b.addEventListener('click',()=>showView(b.dataset.view)));
  $('#punctuationToggle').addEventListener('change',()=>makeTarget());$('#numbersToggle').addEventListener('change',()=>makeTarget());
  $('#themeSelect').addEventListener('change',()=>{settings.theme=$('#themeSelect').value;data.settings=settings;persist();applySettings();});
  $('#fontSizeSelect').addEventListener('change',()=>{settings.fontSize=Number($('#fontSizeSelect').value);data.settings=settings;persist();applySettings();});
  $('#animationToggle').addEventListener('change',()=>{settings.animations=$('#animationToggle').checked;data.settings=settings;persist();applySettings();});
  $('#soundToggle').addEventListener('change',()=>{settings.sound=$('#soundToggle').checked;data.settings=settings;persist();});
  $('#soundVolume').addEventListener('input',()=>{settings.volume=Number($('#soundVolume').value);data.settings=settings;persist();});
  $('#saveSettingsBtn').addEventListener('click',()=>{saveSettingsFromUI();makeTarget();});
  $('#profileName').addEventListener('change',()=>{settings.profile=$('#profileName').value.trim().slice(0,20)||'typist';data.settings=settings;persist();applySettings();renderStats();});
  $('#clearHistoryBtn').addEventListener('click',()=>{if(confirm('Delete all saved test history from this browser?')){data.history=[];persist();renderStats();}});
  $('#exportBtn').addEventListener('click',()=>download('keytype-history.json',JSON.stringify(data,null,2)));
  $('#importInput').addEventListener('change',async e=>{const f=e.target.files[0];if(!f)return;try{const d=JSON.parse(await f.text());if(!Array.isArray(d.history))throw new Error('Invalid file');data.history=[...d.history,...data.history].slice(0,500);persist();renderStats();$('#settingsMessage').textContent='History imported.';}catch{$('#settingsMessage').textContent='Could not import that file. Choose a Keytype JSON export.';}e.target.value='';});
  applySettings();makeTarget();renderStats();
})();
