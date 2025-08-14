/* ===========================
   Enhanced Audio System
   =========================== */
function initAudio(){ if (!audioCtx) audioCtx = new (window.AudioContext||window.webkitAudioContext)(); }

function playSfx(f=520, type='square', dur=0.1, vol=0.15){
  if (!sfxOn || !audioCtx) return;
  const t=audioCtx.currentTime, osc=audioCtx.createOscillator(), g=audioCtx.createGain();
  osc.type=type; osc.frequency.setValueAtTime(f,t);
  g.gain.setValueAtTime(vol,t); g.gain.exponentialRampToValueAtTime(0.0001, t+dur);
  osc.connect(g).connect(audioCtx.destination); osc.start(t); osc.stop(t+dur);
}

function playLaserSound(){
  if (!sfxOn || !audioCtx) return;
  const t = audioCtx.currentTime;
  
  // Main laser beam
  const osc1 = audioCtx.createOscillator();
  const gain1 = audioCtx.createGain();
  osc1.type = 'sawtooth';
  osc1.frequency.setValueAtTime(800, t);
  osc1.frequency.exponentialRampToValueAtTime(400, t + 0.1);
  gain1.gain.setValueAtTime(0.2, t);
  gain1.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
  
  // High frequency zap
  const osc2 = audioCtx.createOscillator();
  const gain2 = audioCtx.createGain();
  osc2.type = 'square';
  osc2.frequency.setValueAtTime(1600, t);
  osc2.frequency.exponentialRampToValueAtTime(800, t + 0.05);
  gain2.gain.setValueAtTime(0.1, t);
  gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
  
  // Connect and play
  osc1.connect(gain1).connect(audioCtx.destination);
  osc2.connect(gain2).connect(audioCtx.destination);
  osc1.start(t); osc1.stop(t + 0.15);
  osc2.start(t); osc2.stop(t + 0.08);
}

async function startMusic(){
  if (!musicOn) return;
  initAudio();
  try{ await audioCtx.resume(); }catch{}
  if (!audioCtx || music.started || audioCtx.state !== 'running') return;
  
  music.started = true;
  music.time = audioCtx.currentTime;
  music.nodes = [];
  
  // Master gain
  const master = audioCtx.createGain();
  master.gain.value = 0.0;
  master.connect(audioCtx.destination);
  master.gain.linearRampToValueAtTime(0.06, music.time + 2.0);
  music.nodes.push(master);
  
  // Low pass filter for ambience
  const filter = audioCtx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 600;
  filter.Q.value = 0.3;
  filter.connect(master);
  
  // Bass drone (root note)
  const bass = audioCtx.createOscillator();
  const bassGain = audioCtx.createGain();
  bass.type = 'sine';
  bass.frequency.value = 65.4; // C2
  bassGain.gain.value = 0.4;
  bass.connect(bassGain).connect(filter);
  bass.start();
  music.nodes.push(bass, bassGain);
  
  // Harmonic layer (fifth)
  const harmony = audioCtx.createOscillator();
  const harmonyGain = audioCtx.createGain();
  harmony.type = 'sine';
  harmony.frequency.value = 98.0; // G2
  harmonyGain.gain.value = 0.25;
  harmony.connect(harmonyGain).connect(filter);
  harmony.start();
  music.nodes.push(harmony, harmonyGain);
  
  // Ambient pad
  const pad = audioCtx.createOscillator();
  const padGain = audioCtx.createGain();
  const padLFO = audioCtx.createOscillator();
  const padDepth = audioCtx.createGain();
  
  pad.type = 'triangle';
  pad.frequency.value = 130.8; // C3
  padLFO.type = 'sine';
  padLFO.frequency.value = 0.08;
  padDepth.gain.value = 8;
  padGain.gain.value = 0.15;
  
  padLFO.connect(padDepth).connect(pad.frequency);
  pad.connect(padGain).connect(filter);
  pad.start();
  padLFO.start();
  music.nodes.push(pad, padGain, padLFO, padDepth);
  
  // High sparkle
  const sparkle = audioCtx.createOscillator();
  const sparkleGain = audioCtx.createGain();
  const sparkleLFO = audioCtx.createOscillator();
  const sparkleDepth = audioCtx.createGain();
  
  sparkle.type = 'sine';
  sparkle.frequency.value = 523.3; // C5
  sparkleLFO.type = 'sine';
  sparkleLFO.frequency.value = 0.13;
  sparkleDepth.gain.value = 50;
  sparkleGain.gain.value = 0.08;
  
  sparkleLFO.connect(sparkleDepth).connect(sparkle.frequency);
  sparkle.connect(sparkleGain).connect(master); // bypass filter for brightness
  sparkle.start();
  sparkleLFO.start();
  music.nodes.push(sparkle, sparkleGain, sparkleLFO, sparkleDepth);
  
  // Subtle rhythm element
  createRhythmElement(master);
}

function createRhythmElement(destination){
  const scheduleNote = (time, freq, dur) => {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(0.03, time + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, time + dur);
    osc.connect(gain).connect(destination);
    osc.start(time);
    osc.stop(time + dur);
  };
  
  const startTime = audioCtx.currentTime + 1;
  const bpm = 60;
  const beatDuration = 60 / bpm;
  
  for (let i = 0; i < 8; i++){
    const time = startTime + i * beatDuration;
    if (i % 4 === 0) scheduleNote(time, 196.0, 0.8);
    if (i % 2 === 1) scheduleNote(time, 146.8, 0.4);
  }
  
  setTimeout(() => {
    if (music.started) createRhythmElement(destination);
  }, beatDuration * 8000);
}

function stopMusic(){
  if (!music.started) return;
  try{
    const t = audioCtx.currentTime;
    music.nodes.forEach(node => {
      if (node.gain) node.gain.linearRampToValueAtTime(0.0001, t + 0.5);
      if (node.stop) setTimeout(() => { try{ node.stop(); }catch{} }, 600);
    });
  }catch{}
  setTimeout(() => {
    music = { started:false, nodes:[], time:0 };
  }, 700);
}

function wantMenuMusic(){ return ['mainmenu','hangar','settings','paused','gameover','info'].includes(state); }
function refreshMusic(){ if (!musicOn){ stopMusic(); return; } if (wantMenuMusic()) startMusic(); else stopMusic(); }

