(function(){
'use strict';
/* ---------- 毛球皮肤 ---------- */
var SKINS=[
  {key:'brown', name:'棕', src:'assets/char_brown.png'},
  {key:'pink',  name:'粉', src:'assets/char_pink.png'},
  {key:'purple',name:'紫', src:'assets/char_purple.png'},
  {key:'blue',  name:'蓝', src:'assets/char_blue.png'},
  {key:'white', name:'白', src:'assets/char_white.png'}
];
var imgs={};
SKINS.forEach(function(s){var im=new Image();im.src=s.src;imgs[s.key]=im;});

/* ---------- 主题 ---------- */
var THEMES=window.THEMES||[];
var LIGHT_FALLBACK={bg:'#fff7ed',dimTop:'rgba(255,247,237,0)',dimBot:'rgba(255,247,237,0)',
  grid:'rgba(120,100,70,0.10)',pN:'#a8d84f',pNe:'#6f9a2e',pM:'#7fc8f0',pMe:'#3f93c8',
  pB:'#c79b6a',pBe:'#8c6438',spring:'#ffcf5b',springEdge:'#c89a2e',accent:'#ff9a6c',accentDark:'#e07a48',
  ink:'#3a3027',sub:'#8a7c66',score:'#3a3027',scoreShadow:'rgba(0,0,0,.4)',card:'#fff',cardBorder:'#efe2cc',
  ctrlBg:'rgba(255,255,255,.8)',ctrlBd:'#e7dccb',particleBreak:'#c79b6a'};
var THEME=LIGHT_FALLBACK;
var curTheme=null, bgImg=null, bgReady=false;

/* ---------- 存储 ---------- */
var store={
  get best(){try{return +localStorage.getItem('mq_best')||0}catch(e){return 0}},
  set best(v){try{localStorage.setItem('mq_best',v)}catch(e){}},
  get skin(){try{return localStorage.getItem('mq_skin')||'brown'}catch(e){return 'brown'}},
  set skin(v){try{localStorage.setItem('mq_skin',v)}catch(e){}},
  get theme(){try{return localStorage.getItem('mq_theme')||(window.DEFAULT_THEME||(THEMES[0]&&THEMES[0].id))}catch(e){return THEMES[0]&&THEMES[0].id}},
  set theme(v){try{localStorage.setItem('mq_theme',v)}catch(e){}},
  get muted(){try{return localStorage.getItem('mq_muted')==='1'}catch(e){return false}},
  set muted(v){try{localStorage.setItem('mq_muted',v?'1':'0')}catch(e){}}
};

/* ---------- 画布 ---------- */
var cv=document.getElementById('cv'), ctx=cv.getContext('2d');
var stage=document.getElementById('stage');
var GW=400, GH=640;
var dpr=Math.min(window.devicePixelRatio||1,2.5);
function layout(){
  var vw=window.innerWidth, vh=window.innerHeight, w=vw, h=vh, ar=GW/GH;
  if(w/h>ar){ w=h*ar; } else { h=w/ar; }
  if(h>vh){ h=vh; w=h*ar; }
  stage.style.width=w+'px'; stage.style.height=h+'px';
  stage.style.borderRadius=(vw>w+4?'20px':'0');
  cv.width=Math.round(GW*dpr); cv.height=Math.round(GH*dpr);
  ctx.setTransform(dpr,0,0,dpr,0,0);
}
window.addEventListener('resize',layout); layout();

/* ---------- 状态 ---------- */
var GRAV=0.32, JUMP=-11.6, SPRING_JUMP=-19, MOVE=0.9, MAXVX=7.2, FRICT=0.86;
var state='menu';
var player=null, platforms=[], items=[], score=0, scrolled=0, currentSkin='brown', frame=0;
var tiltX=0, keyDir=0, touchDir=0, particles=[];

function randGap(){ return 62+Math.random()*46; }
function makePlatform(y){
  var r=Math.random(), type='normal', vx=0;
  var diff=Math.min(scrolled/9000,1);
  if(r<0.12+diff*0.16){ type='breakable'; }
  else if(r<0.30+diff*0.18){ type='moving'; vx=(Math.random()<.5?-1:1)*(1+diff*1.4); }
  var w=64;
  var p={x:Math.random()*(GW-w),y:y,w:w,type:type,vx:vx,broken:false,spring:false};
  if(type!=='breakable' && Math.random()<0.10){ p.spring=true; }
  return p;
}
function reset(){
  currentSkin=store.skin;
  player={x:GW/2-22, y:GH-160, w:44, h:48, vx:0, vy:JUMP, face:1, squash:0, jet:0};
  platforms=[]; items=[]; particles=[]; score=0; scrolled=0; frame=0;
  platforms.push({x:GW/2-40,y:GH-90,w:80,type:'normal',vx:0,broken:false,spring:false});
  var y=GH-90;
  for(var i=0;i<14;i++){ y-=randGap(); platforms.push(makePlatform(y)); }
}

/* ---------- 输入 ---------- */
var supportsTilt=(typeof DeviceOrientationEvent!=='undefined');
function onTilt(e){ if(e.gamma==null)return; tiltX=Math.max(-1,Math.min(1,e.gamma/22)); }
function enableTilt(){
  if(!supportsTilt) return;
  if(typeof DeviceOrientationEvent.requestPermission==='function'){
    DeviceOrientationEvent.requestPermission().then(function(p){if(p==='granted')window.addEventListener('deviceorientation',onTilt);}).catch(function(){});
  } else { window.addEventListener('deviceorientation',onTilt); }
}
window.addEventListener('keydown',function(e){
  if(e.key==='ArrowLeft'||e.key==='a'||e.key==='A')keyDir=-1;
  else if(e.key==='ArrowRight'||e.key==='d'||e.key==='D')keyDir=1;
  if((e.key===' '||e.key==='Enter')&&state==='menu'){startGame();}
});
window.addEventListener('keyup',function(e){
  if((e.key==='ArrowLeft'||e.key==='a'||e.key==='A')&&keyDir===-1)keyDir=0;
  if((e.key==='ArrowRight'||e.key==='d'||e.key==='D')&&keyDir===1)keyDir=0;
});
function touchHandler(e){
  if(state!=='play'){return;}
  if(e.touches&&e.touches.length){
    var r=cv.getBoundingClientRect();
    touchDir=(e.touches[0].clientX-r.left)<r.width/2?-1:1;
  }
  e.preventDefault();
}
cv.addEventListener('touchstart',touchHandler,{passive:false});
cv.addEventListener('touchmove',touchHandler,{passive:false});
cv.addEventListener('touchend',function(){touchDir=0;},{passive:false});
var mouseDown=false;
cv.addEventListener('mousedown',function(e){mouseDown=true;setMouseDir(e);});
cv.addEventListener('mousemove',function(e){if(mouseDown)setMouseDir(e);});
window.addEventListener('mouseup',function(){mouseDown=false;touchDir=0;});
function setMouseDir(e){if(state!=='play')return;var r=cv.getBoundingClientRect();touchDir=(e.clientX-r.left)<r.width/2?-1:1;}

/* ---------- 更新 ---------- */
function update(){
  frame++;
  var dir=keyDir!==0?keyDir:touchDir!==0?touchDir:0;
  if(dir!==0){ player.vx+=dir*MOVE; }
  if(Math.abs(tiltX)>0.04){ player.vx+=tiltX*MOVE*1.15; }
  if(dir===0 && Math.abs(tiltX)<=0.04){ player.vx*=FRICT; }
  player.vx=Math.max(-MAXVX,Math.min(MAXVX,player.vx));
  player.x+=player.vx;
  if(player.vx>0.3)player.face=1; else if(player.vx<-0.3)player.face=-1;
  if(player.x<-player.w)player.x=GW;
  if(player.x>GW)player.x=-player.w;
  if(player.jet>0){ player.jet--; player.vy=-9.5; if(frame%3===0)spawnPuff(); }
  else player.vy+=GRAV;
  player.y+=player.vy;
  if(player.squash>0)player.squash*=0.8;
  platforms.forEach(function(p){
    if(p.type==='moving'){ p.x+=p.vx; if(p.x<0){p.x=0;p.vx*=-1;} if(p.x>GW-p.w){p.x=GW-p.w;p.vx*=-1;} }
  });
  if(player.vy>0){
    for(var i=0;i<platforms.length;i++){
      var p=platforms[i];
      if(p.broken)continue;
      var px=player.x+player.w/2, feet=player.y+player.h;
      if(px>p.x-4 && px<p.x+p.w+4 && feet>p.y && feet<p.y+18 && player.y+player.h-player.vy<=p.y+18){
        if(p.type==='breakable'){ player.vy=JUMP; player.squash=1; p.broken=true; spawnBreak(p); sfx('brk'); }
        else if(p.spring){ player.vy=SPRING_JUMP; player.squash=1; bounceFx(p); sfx('spring'); }
        else { player.vy=JUMP; player.squash=1; bounceFx(p); sfx('jump'); }
        break;
      }
    }
    for(var j=0;j<items.length;j++){
      var it=items[j];
      if(it.taken)continue;
      var px2=player.x+player.w/2, feet2=player.y+player.h;
      if(px2>it.x-6&&px2<it.x+it.w+6&&feet2>it.y&&feet2<it.y+22){
        if(it.type==='jet'){ player.jet=70; it.taken=true; player.squash=1; sfx('item'); }
      }
    }
  }
  var line=GH*0.42;
  if(player.y<line){
    var dy=line-player.y; player.y=line; scrolled+=dy;
    platforms.forEach(function(p){p.y+=dy;});
    items.forEach(function(it){it.y+=dy;});
    particles.forEach(function(pt){pt.y+=dy;});
    score=Math.floor(scrolled/10);
  }
  platforms.forEach(function(p){ if(p.broken){p.fade=(p.fade||0)+0.05; p.y+=4;} });
  platforms=platforms.filter(function(p){return p.y<GH+30 && !(p.broken&&p.fade>1);});
  var ys=platforms.map(function(p){return p.y;}); ys.push(GH);
  var topY=Math.min.apply(null,ys);
  while(topY>-20){
    topY-=randGap();
    var np=makePlatform(topY); platforms.push(np);
    if(Math.random()<0.04){ items.push({x:np.x+np.w/2-10,y:np.y-26,w:20,h:24,type:'jet',taken:false}); }
  }
  items=items.filter(function(it){return it.y<GH+40 && !it.taken;});
  particles.forEach(function(pt){pt.x+=pt.vx;pt.y+=pt.vy;pt.vy+=0.3;pt.life--;});
  particles=particles.filter(function(pt){return pt.life>0;});
  if(player.y>GH+10){ gameOver(); }
}
function bounceFx(p){for(var i=0;i<5;i++)particles.push({x:p.x+p.w/2,y:p.y+8,vx:(Math.random()-.5)*3,vy:-Math.random()*2,life:18,c:'#fff',r:2+Math.random()*2});}
function spawnBreak(p){for(var i=0;i<8;i++)particles.push({x:p.x+Math.random()*p.w,y:p.y+6,vx:(Math.random()-.5)*4,vy:-Math.random()*3,life:26,c:THEME.particleBreak,r:2+Math.random()*3});}
function spawnPuff(){particles.push({x:player.x+player.w/2+(Math.random()-.5)*10,y:player.y+player.h,vx:(Math.random()-.5)*1.5,vy:2+Math.random()*2,life:16,c:'rgba(255,255,255,.6)',r:3+Math.random()*3});}

/* ---------- 渲染 ---------- */
function drawBg(){
  ctx.fillStyle=THEME.bg; ctx.fillRect(0,0,GW,GH);
  if(bgReady&&bgImg){
    var iw=bgImg.naturalWidth, ih=bgImg.naturalHeight;
    var sc=Math.max(GW/iw,GH/ih);
    var dw=iw*sc, dh=ih*sc;
    var par=((scrolled*0.04)%dh);
    ctx.drawImage(bgImg,(GW-dw)/2,(GH-dh)/2,dw,dh);
  }
  var g=ctx.createLinearGradient(0,0,0,GH);
  g.addColorStop(0,THEME.dimTop); g.addColorStop(1,THEME.dimBot);
  ctx.fillStyle=g; ctx.fillRect(0,0,GW,GH);
  ctx.strokeStyle=THEME.grid; ctx.lineWidth=1;
  var off=(scrolled%32);
  ctx.beginPath();
  for(var x=0;x<=GW;x+=32){ctx.moveTo(x,0);ctx.lineTo(x,GH);}
  for(var y=-32+off;y<=GH;y+=32){ctx.moveTo(0,y);ctx.lineTo(GW,y);}
  ctx.stroke();
}
function rr(x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();}
function roundPlat(p){
  var x=p.x,y=p.y,w=p.w,h=14,r=7,fill,edge;
  if(p.type==='moving'){fill=THEME.pM;edge=THEME.pMe;}
  else if(p.type==='breakable'){fill=THEME.pB;edge=THEME.pBe;}
  else {fill=THEME.pN;edge=THEME.pNe;}
  ctx.save();
  if(p.broken){ctx.globalAlpha=Math.max(0,1-(p.fade||0));}
  ctx.fillStyle='rgba(0,0,0,.18)';rr(x+2,y+3,w,h,r);ctx.fill();
  ctx.fillStyle=fill;rr(x,y,w,h,r);ctx.fill();
  ctx.lineWidth=2.4;ctx.strokeStyle=edge;rr(x,y,w,h,r);ctx.stroke();
  if(p.type==='breakable'){ctx.strokeStyle=edge;ctx.lineWidth=1.6;ctx.beginPath();ctx.moveTo(x+w*0.4,y);ctx.lineTo(x+w*0.5,y+h);ctx.stroke();}
  if(p.spring){
    ctx.strokeStyle='#555';ctx.lineWidth=2;var sx=x+w/2;
    ctx.beginPath();ctx.moveTo(sx-5,y-2);ctx.lineTo(sx-5,y-12);ctx.lineTo(sx+5,y-8);ctx.lineTo(sx+5,y-16);ctx.stroke();
    ctx.fillStyle=THEME.spring;rr(sx-8,y-22,16,7,3);ctx.fill();
    ctx.strokeStyle=THEME.springEdge;ctx.lineWidth=1.5;rr(sx-8,y-22,16,7,3);ctx.stroke();
  }
  ctx.restore();
}
function drawItem(it){
  if(it.type==='jet'){
    ctx.save();ctx.translate(it.x+it.w/2,it.y+it.h/2);
    ctx.fillStyle='#ff7a59';rr(-9,-12,18,22,5);ctx.fill();
    ctx.lineWidth=2;ctx.strokeStyle='#c84e2e';rr(-9,-12,18,22,5);ctx.stroke();
    ctx.fillStyle='#ffd45b';ctx.beginPath();ctx.moveTo(-6,10);ctx.lineTo(0,20);ctx.lineTo(6,10);ctx.closePath();ctx.fill();
    ctx.restore();
  }
}
var rimCache={};
function getRimCanvas(skin,color){
  var key=skin+'|'+color; if(rimCache[key])return rimCache[key];
  var im=imgs[skin]; if(!im||!im.complete||!im.naturalWidth) return null;
  var c=document.createElement('canvas'); c.width=im.naturalWidth; c.height=im.naturalHeight;
  var x=c.getContext('2d'); x.drawImage(im,0,0);
  x.globalCompositeOperation='source-in'; x.fillStyle=color; x.fillRect(0,0,c.width,c.height);
  rimCache[key]=c; return c;
}
function drawPlayer(){
  var im=imgs[currentSkin];
  var sq=player.squash;
  var h=player.h*(1-sq*0.16);
  var cx=player.x+player.w/2, by=player.y+player.h;
  ctx.save();
  ctx.translate(cx,by);
  ctx.scale(player.face,1);
  ctx.rotate(Math.max(-0.25,Math.min(0.25,player.vx*0.02))*player.face);
  if(player.jet>0){ctx.fillStyle='#ffb24d';ctx.beginPath();ctx.ellipse(0,8,8,12+Math.random()*6,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#ff7a3d';ctx.beginPath();ctx.ellipse(0,6,4,8+Math.random()*4,0,0,Math.PI*2);ctx.fill();}
  if(im&&im.complete&&im.naturalWidth){
    var ar=im.naturalWidth/im.naturalHeight;
    var dh=h, dw=dh*ar;
    if(THEME.rim){
      var rc=getRimCanvas(currentSkin,THEME.rim);
      if(rc){ var o=Math.max(0.9,dh*0.022);
        var offs=[[-o,0],[o,0],[0,-o],[0,o],[-o,-o],[o,-o],[-o,o],[o,o]];
        for(var oi=0;oi<offs.length;oi++) ctx.drawImage(rc,-dw/2+offs[oi][0],-dh+offs[oi][1],dw,dh);
      }
    }
    ctx.drawImage(im,-dw/2,-dh,dw,dh);
  } else {
    ctx.fillStyle='#c79b6a';rr(-player.w/2,-h,player.w,h,14);ctx.fill();
  }
  ctx.restore();
}
function render(){
  drawBg();
  for(var i=0;i<platforms.length;i++)roundPlat(platforms[i]);
  for(var j=0;j<items.length;j++)drawItem(items[j]);
  for(var k=0;k<particles.length;k++){var pt=particles[k];ctx.globalAlpha=Math.max(0,pt.life/26);ctx.fillStyle=pt.c;ctx.beginPath();ctx.arc(pt.x,pt.y,pt.r,0,Math.PI*2);ctx.fill();}
  ctx.globalAlpha=1;
  if(player)drawPlayer();
}
function loop(){
  if(state==='play'){ update(); }
  render();
  if(state==='play'){ document.getElementById('score').textContent=score; }
  requestAnimationFrame(loop);
}

/* ---------- 音乐引擎 ---------- */
var audio=null, muted=store.muted;
function loadAudio(t){
  if(audio){ try{audio.pause();}catch(e){} audio=null; }
  if(!t.audio){ return; }
  audio=new Audio(); audio.src=t.audio; audio.loop=true; audio.preload='auto';
  audio.volume=muted?0:0.55;
}
function ensureAudio(){ if(window.AudioEngine){ AudioEngine.ensure(); AudioEngine.setMuted(muted); } }
function playMusic(){
  if(muted) return;
  if(curTheme && curTheme.synth){ ensureAudio(); if(window.SynthBGM) SynthBGM.start(); return; }
  if(audio){ var pr=audio.play(); if(pr&&pr.catch)pr.catch(function(){}); }
}
function pauseMusic(){ if(window.SynthBGM) SynthBGM.stop(); if(audio){ try{audio.pause();}catch(e){} } }
function restartMusic(){
  if(window.SynthBGM) SynthBGM.stop();
  if(audio){ try{ audio.pause(); audio.currentTime=0; }catch(e){} }
  playMusic();
}
function pauseMusicKeep(){   // 真正暂停，保留播放进度
  if(window.SynthBGM) SynthBGM.pause();
  if(audio){ try{ audio.pause(); }catch(e){} }
}
function resumeMusic(){      // 从暂停处续播
  if(muted) return;
  if(curTheme && curTheme.synth){ if(window.SynthBGM) SynthBGM.resume(); return; }
  if(audio){ var pr=audio.play(); if(pr&&pr.catch)pr.catch(function(){}); }
}
function sfx(n){ if(!muted && window.Sfx && Sfx[n]) Sfx[n](); }
var SPK_ON='<svg viewBox="0 0 24 24" fill="currentColor"><path d="M4 9v6h4l5 5V4L8 9H4z"/><path d="M16 8a5 5 0 010 8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
var SPK_OFF='<svg viewBox="0 0 24 24" fill="currentColor"><path d="M4 9v6h4l5 5V4L8 9H4z"/><path d="M16 9l5 6M21 9l-5 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
function refreshMute(){
  var html=muted?SPK_OFF:SPK_ON;
  $('muteBtn').innerHTML=html; $('muteBtnMenu').innerHTML=html;
  $('muteLbl').textContent=muted?'音乐关':'音乐开';
}
function toggleMute(){
  muted=!muted; store.muted=muted;
  if(window.AudioEngine)AudioEngine.setMuted(muted);
  if(audio)audio.volume=muted?0:0.55;
  if(muted){ pauseMusic(); } else { playMusic(); }
  refreshMute();
}

/* ---------- 主题应用 ---------- */
function setVar(k,v){ document.documentElement.style.setProperty(k,v); }
function applyTheme(t){
  curTheme=t; THEME=t.pal||LIGHT_FALLBACK; var p=THEME;
  setVar('--paper',p.bg); setVar('--ink',p.ink); setVar('--sub',p.sub);
  setVar('--accent',p.accent); setVar('--accentDark',p.accentDark);
  setVar('--card',p.card); setVar('--cardBorder',p.cardBorder);
  setVar('--ctrlBg',p.ctrlBg); setVar('--ctrlBd',p.ctrlBd); setVar('--score',p.score);
  var meta=document.querySelector('meta[name="theme-color"]'); if(meta)meta.setAttribute('content',p.bg);
  pauseMusic();
  bgReady=false; bgImg=null;
  if(t.photo!==false){
    bgImg=new Image();
    bgImg.onload=function(){bgReady=true;};
    bgImg.src=t.cover;
  }
  loadAudio(t);
  $('nowName').textContent = (t.audio||t.synth) ? t.name : (t.name+' · 无音乐');
}

/* ---------- 界面 ---------- */
function $(id){return document.getElementById(id);}
function show(id){
  ['menu','pause','over'].forEach(function(s){$(s).classList.toggle('hidden',s!==id);});
  $('hud').classList.toggle('hidden',id!=='play');
}
function mkSw(s){
  var d=document.createElement('div');d.className='sw'+(s.key===store.skin?' active':'');
  d.innerHTML='<span class="nm">'+s.name+'</span><img src="'+s.src+'" alt="'+s.name+'" onerror="this.style.opacity=0">';
  d.onclick=function(){store.skin=s.key;buildSwatches();};
  return d;
}
function buildSwatches(){
  var c=$('swatches');c.innerHTML='';
  var top=document.createElement('div');top.className='sw-row';
  var bot=document.createElement('div');bot.className='sw-row';
  SKINS.forEach(function(s){ (s.key==='white'?top:bot).appendChild(mkSw(s)); });
  c.appendChild(top);c.appendChild(bot);
}
function buildThemes(){
  var c=$('themes');c.innerHTML='';
  THEMES.forEach(function(t){
    var d=document.createElement('div');d.className='tcard'+(t.id===store.theme?' active':'');
    d.innerHTML='<img src="'+t.cover+'" alt="'+t.name+'" onerror="this.style.opacity=0"><span class="tnm">'+t.name+'</span>';
    d.onclick=function(){
      ensureAudio(); store.theme=t.id; applyTheme(t); buildThemes();
      playMusic(); // 用户手势，预览播放
    };
    c.appendChild(d);
  });
}

/* ---------- 流程 ---------- */
function startGame(){ ensureAudio(); reset(); state='play'; show('play'); enableTilt(); restartMusic(); }
function countUp(el,target,dur){
  var start=null;
  function tick(now){
    if(start===null)start=now;
    var t=Math.min(1,(now-start)/dur), e=1-Math.pow(1-t,3);
    el.textContent=Math.round(target*e);
    if(t<1)requestAnimationFrame(tick);
  }
  el.textContent='0'; requestAnimationFrame(tick);
}
function gameOver(){
  state='over'; sfx('over'); pauseMusic();
  var prev=store.best||0, isRecord=score>prev;
  if(isRecord)store.best=score;
  $('bestScore').textContent='最高 '+store.best;
  var nr=$('newRecord'); if(nr)nr.classList.toggle('hidden',!isRecord);
  var rc=$('resultChar'); if(rc)rc.src='assets/char_'+store.skin+'.png';
  show('over');
  countUp($('finalScore'),score,650);
}
$('startBtn').onclick=startGame;
$('retryBtn').onclick=startGame;
$('changeBtn').onclick=function(){state='menu';buildSwatches();buildThemes();show('menu');};
$('quitBtn').onclick=function(){state='menu';buildSwatches();buildThemes();show('menu');};
$('pauseBtn').onclick=function(){if(state==='play'){state='pause';show('pause');pauseMusicKeep();}};
$('resumeBtn').onclick=function(){if(state==='pause'){state='play';show('play');resumeMusic();}};
$('muteBtn').onclick=toggleMute;
$('muteBtnMenu').onclick=toggleMute;

/* ---------- 分享 ---------- */
/* 分享网址：部署后自动取当前网址；本地 file:// 测试时用占位地址。
   上线拿到正式网址后，可在 index.html 里加一行 <script>window.GAME_URL='https://你的网址/';</script> 覆盖。 */
var SHARE_URL = (window.GAME_URL) ? window.GAME_URL
  : (location.protocol.indexOf('http')===0 ? (location.origin+location.pathname) : 'https://maoqiu-jump.pages.dev/');
function shareText(){ var v=score||store.best||0; return '我在《毛球向上跳》跳到了 '+v+' 的高度，来挑战我！'; }
function toast(msg){ var t=$('toast'); if(!t)return; t.textContent=msg; t.classList.add('show'); clearTimeout(toast._t); toast._t=setTimeout(function(){t.classList.remove('show');},1800); }
function openShareModal(){
  $('shareUrl').value=SHARE_URL;
  var qr=$('shareQR');
  qr.style.display='';
  qr.onerror=function(){ qr.style.display='none'; $('shareTip').textContent='复制链接或用 QQ 分享给好友'; };
  qr.src='https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=0&data='+encodeURIComponent(SHARE_URL);
  $('share').classList.remove('hidden');
}
function doShare(){
  var data={title:'毛球向上跳', text:shareText(), url:SHARE_URL};
  if(navigator.share){ navigator.share(data).catch(function(e){ if(e&&e.name!=='AbortError') openShareModal(); }); }
  else openShareModal();
}
function fallbackCopy(txt){ var i=$('shareUrl'); var old=i.value; i.value=txt; i.focus(); i.select();
  try{ document.execCommand('copy'); toast('已复制，去粘贴给好友'); }catch(e){ toast('请长按链接手动复制'); } i.value=old; }
$('shareBtn').onclick=doShare;
$('shareCloseBtn').onclick=function(){ $('share').classList.add('hidden'); };
$('copyLinkBtn').onclick=function(){
  var txt=shareText()+' '+SHARE_URL;
  if(navigator.clipboard&&navigator.clipboard.writeText){ navigator.clipboard.writeText(txt).then(function(){toast('已复制，去粘贴给好友');},function(){fallbackCopy(txt);}); }
  else fallbackCopy(txt);
};
$('qqShareBtn').onclick=function(){
  var u='https://connect.qq.com/widget/shareqq/index.html?url='+encodeURIComponent(SHARE_URL)+'&title='+encodeURIComponent('毛球向上跳')+'&desc='+encodeURIComponent(shareText());
  window.open(u,'_blank');
};

var isTouch=('ontouchstart'in window)||navigator.maxTouchPoints>0;
$('ctrlHint').textContent=isTouch
  ? '手机：左右倾斜手机控制方向，或按住屏幕左 / 右半边'
  : '电脑：方向键 或 A / D 控制左右方向';

/* ---------- 初始化 ---------- */
function findTheme(id){for(var i=0;i<THEMES.length;i++)if(THEMES[i].id===id)return THEMES[i];return THEMES[0];}
buildSwatches();
buildThemes();
refreshMute();
if(THEMES.length){ applyTheme(findTheme(store.theme)); }
show('menu');
loop();
// 首次交互即自动开启当前主题音乐（浏览器禁止无交互自动播放，这是最早可行时机）
function primeAudioOnce(){
  window.removeEventListener('pointerdown',primeAudioOnce,true);
  window.removeEventListener('touchstart',primeAudioOnce,true);
  window.removeEventListener('keydown',primeAudioOnce,true);
  ensureAudio();
  if(!muted) playMusic();
}
window.addEventListener('pointerdown',primeAudioOnce,true);
window.addEventListener('touchstart',primeAudioOnce,true);
window.addEventListener('keydown',primeAudioOnce,true);
if('serviceWorker' in navigator && location.protocol.indexOf('http')===0){
  window.addEventListener('load',function(){navigator.serviceWorker.register('sw.js').catch(function(){});});
}
})();
