/* WebAudio 引擎：实时合成游戏音效 + 一首轻快循环 BGM（经典主题用）。
   全部受 setMuted 统一控制。需在用户手势后 ensure() 以解锁 AudioContext。 */
(function(){
'use strict';
var ctx=null, master=null, sfxGain=null, bgmGain=null, muted=false, noiseBuf=null;

function ensure(){
  if(ctx){ if(ctx.state==='suspended'){ try{ctx.resume();}catch(e){} } return ctx; }
  try{
    var AC=window.AudioContext||window.webkitAudioContext;
    ctx=new AC();
    master=ctx.createGain(); master.gain.value=muted?0:1; master.connect(ctx.destination);
    sfxGain=ctx.createGain(); sfxGain.gain.value=1.0; sfxGain.connect(master);
    bgmGain=ctx.createGain(); bgmGain.gain.value=0.9; bgmGain.connect(master);
    // noise buffer for percussive sfx
    var n=ctx.sampleRate*0.4; noiseBuf=ctx.createBuffer(1,n,ctx.sampleRate);
    var ch=noiseBuf.getChannelData(0);
    for(var i=0;i<n;i++) ch[i]=Math.random()*2-1;
  }catch(e){ ctx=null; }
  return ctx;
}
function setMuted(m){ muted=m; if(master&&ctx){ master.gain.setTargetAtTime(m?0:1, ctx.currentTime, 0.02); } }

/* ---- 基础音 ---- */
function tone(freq,dur,type,gain,sweepTo,dest){
  if(!ctx) return;
  var t=ctx.currentTime;
  var o=ctx.createOscillator(), g=ctx.createGain();
  o.type=type||'sine'; o.frequency.setValueAtTime(freq,t);
  if(sweepTo) o.frequency.exponentialRampToValueAtTime(Math.max(1,sweepTo), t+dur);
  g.gain.setValueAtTime(0.0001,t);
  g.gain.exponentialRampToValueAtTime(gain||0.2, t+0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t+dur);
  o.connect(g); g.connect(dest||sfxGain);
  o.start(t); o.stop(t+dur+0.02);
}
function noise(dur,gain,lp){
  if(!ctx) return;
  var t=ctx.currentTime;
  var s=ctx.createBufferSource(); s.buffer=noiseBuf;
  var g=ctx.createGain(); g.gain.setValueAtTime(gain||0.2,t); g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
  var f=ctx.createBiquadFilter(); f.type='lowpass'; f.frequency.value=lp||1800;
  s.connect(f); f.connect(g); g.connect(sfxGain);
  s.start(t); s.stop(t+dur+0.02);
}

/* ---- 具体音效 ---- */
var Sfx={
  ensure:ensure, setMuted:setMuted,
  jump:function(){ ensure(); tone(380,0.10,'sine',0.16,660); },
  spring:function(){ ensure(); tone(520,0.22,'square',0.16,1180); tone(780,0.20,'sine',0.08,1500); },
  brk:function(){ ensure(); noise(0.13,0.22,1500); tone(150,0.14,'square',0.12,80); },
  item:function(){ ensure(); var b=[660,880,1175]; for(var i=0;i<b.length;i++){ (function(f,d){ setTimeout(function(){ tone(f,0.12,'square',0.14); },d); })(b[i],i*55); } },
  over:function(){ ensure(); tone(520,0.5,'triangle',0.2,150); noise(0.3,0.1,900); }
};

/* ---- 合成轻快 BGM（C 大调五声，4 小节循环）---- */
var bgmOn=false, paused=false, timer=null, step=0, nextTime=0, tempo=132, stepDur=(60/132)/4;
function midi(m){ return 440*Math.pow(2,(m-69)/12); }
// 64 步（4 小节×16）旋律，0=休止
var MEL=[
 72,0,76,0, 79,0,76,0, 74,0,72,0, 76,0,0,0,
 71,0,74,0, 76,0,74,0, 72,0,69,0, 67,0,0,0,
 72,0,76,0, 79,0,84,0, 81,0,79,0, 76,0,0,0,
 74,0,72,0, 76,0,79,0, 72,0,0,0, 0,0,0,0
];
var BASS=[
 48,0,0,0, 48,0,0,0, 53,0,0,0, 53,0,0,0,
 55,0,0,0, 55,0,0,0, 50,0,0,0, 43,0,0,0,
 48,0,0,0, 48,0,0,0, 57,0,0,0, 53,0,0,0,
 55,0,0,0, 55,0,0,0, 48,0,0,0, 48,0,0,0
];
function pluck(freq,t,dur,type,gain){
  var o=ctx.createOscillator(), g=ctx.createGain();
  o.type=type; o.frequency.value=freq;
  g.gain.setValueAtTime(0.0001,t);
  g.gain.exponentialRampToValueAtTime(gain,t+0.02);
  g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
  o.connect(g); g.connect(bgmGain); o.start(t); o.stop(t+dur+0.02);
}
function hat(t){
  var s=ctx.createBufferSource(); s.buffer=noiseBuf;
  var g=ctx.createGain(); g.gain.setValueAtTime(0.05,t); g.gain.exponentialRampToValueAtTime(0.0001,t+0.04);
  var f=ctx.createBiquadFilter(); f.type='highpass'; f.frequency.value=6000;
  s.connect(f); f.connect(g); g.connect(bgmGain); s.start(t); s.stop(t+0.05);
}
function scheduleStep(i,t){
  var m=MEL[i]; if(m) pluck(midi(m),t,0.18,'square',0.14);
  var b=BASS[i]; if(b) pluck(midi(b),t,0.22,'triangle',0.17);
  if(i%2===0) hat(t);
}
function scheduler(){
  if(!ctx) return;
  while(nextTime < ctx.currentTime+0.12){
    scheduleStep(step,nextTime);
    nextTime+=stepDur; step=(step+1)%MEL.length;
  }
}
var SynthBGM={
  start:function(){   // 从头开始
    ensure(); if(!ctx) return;
    if(timer){ clearInterval(timer); timer=null; }
    bgmOn=true; paused=false; step=0; nextTime=ctx.currentTime+0.06;
    timer=setInterval(scheduler,25);
  },
  pause:function(){   // 暂停，保留拍点
    if(timer){ clearInterval(timer); timer=null; } paused=true;
  },
  resume:function(){  // 从暂停处续播
    ensure(); if(!ctx) return;
    if(!bgmOn){ this.start(); return; }
    if(paused){ paused=false; nextTime=ctx.currentTime+0.06; timer=setInterval(scheduler,25); }
  },
  stop:function(){ bgmOn=false; paused=false; if(timer){ clearInterval(timer); timer=null; } },
  setMuted:setMuted,
  isOn:function(){ return bgmOn; },
  isPaused:function(){ return paused; }
};

window.Sfx=Sfx; window.SynthBGM=SynthBGM; window.AudioEngine={ensure:ensure,setMuted:setMuted};
})();
