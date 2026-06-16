(function(){
'use strict';
/* ---------- 毛球皮肤 ---------- */
var SKINS=[
  {key:'brown', name:'棕', src:'assets/char_brown.png?v=2'},
  {key:'pink',  name:'粉', src:'assets/char_pink.png?v=2'},
  {key:'purple',name:'紫', src:'assets/char_purple.png?v=2'},
  {key:'blue',  name:'蓝', src:'assets/char_blue.png?v=2'},
  {key:'white', name:'白', src:'assets/char_white.png?v=2'}
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
var sceneStyle='grid', platStyle='round', itemStyle='classic', bgDecor=[];
var gradCache={};   // 缓存"每帧不变"的渐变(天空/光晕/暗角/压暗)，换主题或改尺寸时清空，避免每帧重建
function cgrad(key,make){ var g=gradCache[key]; if(g===undefined){ g=gradCache[key]=make(); } return g; }

/* ---------- 存储 ---------- */
var store={
  get best(){try{return +localStorage.getItem('mq_best')||0}catch(e){return 0}},
  set best(v){try{localStorage.setItem('mq_best',v)}catch(e){}},
  get skin(){try{return localStorage.getItem('mq_skin')||'brown'}catch(e){return 'brown'}},
  set skin(v){try{localStorage.setItem('mq_skin',v)}catch(e){}},
  get theme(){try{return localStorage.getItem('mq_theme')||(window.DEFAULT_THEME||(THEMES[0]&&THEMES[0].id))}catch(e){return THEMES[0]&&THEMES[0].id}},
  set theme(v){try{localStorage.setItem('mq_theme',v)}catch(e){}},
  get muted(){try{return localStorage.getItem('mq_muted')==='1'}catch(e){return false}},
  set muted(v){try{localStorage.setItem('mq_muted',v?'1':'0')}catch(e){}},
  get played(){try{return localStorage.getItem('mq_played')==='1'}catch(e){return false}},
  set played(v){try{localStorage.setItem('mq_played',v?'1':'0')}catch(e){}}
};

/* ---------- 画布 ---------- */
var cv=document.getElementById('cv'), ctx=cv.getContext('2d');
var stage=document.getElementById('stage');
var GW=400, GH=640;
var dpr=Math.min(window.devicePixelRatio||1,2.5);   // 还原回2.5(闪烁出现前的值)：渐变已缓存负载更低，高分屏更清晰、移动台阶边缘不抖
function layout(){
  var vw=window.innerWidth, vh=window.innerHeight, w=vw, h=vh, ar=GW/GH;
  if(w/h>ar){ w=h*ar; } else { h=w/ar; }
  if(h>vh){ h=vh; w=h*ar; }
  stage.style.width=w+'px'; stage.style.height=h+'px';
  stage.style.borderRadius=(vw>w+4?'20px':'0');
  cv.width=Math.round(GW*dpr); cv.height=Math.round(GH*dpr);
  ctx.setTransform(dpr,0,0,dpr,0,0);
  gradCache={};   // 画布重置→渐变缓存作废
  fitMenu();      // 视口变化(微信工具栏伸缩等)后重新适配菜单
}
window.addEventListener('resize',layout); window.addEventListener('load',function(){fitMenu();}); layout();
function fitMenu(){ try{ var menu=document.getElementById('menu'); if(!menu||menu.classList.contains('hidden'))return; var inner=menu.querySelector('.m-inner'); if(!inner)return; inner.style.transform='none'; var cs=getComputedStyle(menu), pad=(parseFloat(cs.paddingTop)||0)+(parseFloat(cs.paddingBottom)||0); var avail=menu.clientHeight-pad, need=inner.offsetHeight; var k=(need>avail&&avail>0)?(avail-4)/need:1; inner.style.transform=(k<0.999)?'scale('+k.toFixed(4)+')':'none'; }catch(e){} }
/* 菜单自适应(硬保证完整不裁不滚): 容器/内容尺寸变化、手机地址栏伸缩(visualViewport)都立刻重新缩放 */
try{
  if(window.ResizeObserver){ var _ro=new ResizeObserver(function(){ fitMenu(); });
    var _mEl=document.getElementById('menu'); if(_mEl){ _ro.observe(_mEl); var _iEl=_mEl.querySelector('.m-inner'); if(_iEl)_ro.observe(_iEl); } }
  if(window.visualViewport){ window.visualViewport.addEventListener('resize',fitMenu); window.visualViewport.addEventListener('scroll',fitMenu); }
}catch(e){}
setTimeout(function(){ try{document.body.classList.remove('boot');}catch(e){} },4000);  // 初始化异常的最终兜底

/* ---------- 状态 ---------- */
var GRAV=0.32, JUMP=-11.6, SPRING_JUMP=-19, MOVE=0.9, MAXVX=7.2, FRICT=0.86;
var MIN_DX=80, MAX_DX=160;   // 相邻台阶横向中心距区间: 下限防竖列扎堆, 上限防"最左↔最右"够不到的死局
var state='menu';
var player=null, platforms=[], items=[], score=0, scrolled=0, currentSkin='brown', frame=0;
var maxHP=3, hp=3, lastItemType=null, sinceItem=99;
var lastPlatX=200;    // 上一块台阶中心 x(防竖列)
var HAZ_ARM=400, HAZ_WARN=90, HAZ_CLAMP=120, HAZ_WARN_DIST=200;   // 齿轮: 激活分 / 预警帧 / 落后封顶 / 触发预警的逼近距离
var HAZ_V0=0.20, HAZ_VMAX=0.85, HAZ_VK=0.00033;   // 齿轮上升速度: 起始(慢) / 封顶 / 每分加速量 —— 随爬升高度长程逐步递增
var hazardOn=false, hazardY=800, hazardWarn=0, hazardArmed=false, hazardWarnArmed=false;
var tiltX=0, keyDir=0, touchActive=false, touchAxis=0, touchStartX=0, particles=[];
var touchBaseGX=0, touchBaseGY=0, touchCurGX=0, touchCurGY=0, demoOn=false, guideOn=false, GUIDE_BEST=200;   // 可见反馈: 最高分<GUIDE_BEST(新手期)才显示

function randGap(){ var d=Math.min(scrolled/9000,1); return Math.min(165, 62+d*30+Math.random()*(46+d*20)); }   // 封顶拉距：62-108 → ~92-158，硬封165(<JUMP可达~210)
function pickX(w){            // 横距落在 [MIN_DX, MAX_DX]: 既不竖列叠加, 也不会远到够不到
  var half=w/2, lo=half, hi=GW-half, segs=[];
  var rA=Math.max(lo,lastPlatX+MIN_DX), rB=Math.min(hi,lastPlatX+MAX_DX); if(rB>=rA) segs.push([rA,rB]);  // 右侧可行段
  var lA=Math.max(lo,lastPlatX-MAX_DX), lB=Math.min(hi,lastPlatX-MIN_DX); if(lB>=lA) segs.push([lA,lB]);  // 左侧可行段
  var c;
  if(segs.length){ var sg=segs[(Math.random()*segs.length)|0]; c=sg[0]+Math.random()*(sg[1]-sg[0]); }
  else { c=Math.max(lo,Math.min(hi, lastPlatX<GW/2? lastPlatX+MIN_DX : lastPlatX-MIN_DX)); }   // 极端兜底(几乎不触发)
  return c-half;
}
function makePlatform(y){
  var r=Math.random(), type='normal', vx=0;
  var diff=Math.min(scrolled/16000,1);                 // 难度爬升放慢(到~1600分才满), 让1000分以下保持轻松
  var pBreak=0.10+diff*0.16;                            // 易碎: 10%→26%
  var pMove =0.04+diff*diff*0.22;                       // 移动: 4%→26%, 二次曲线→1000分以下很少(手机也好控)
  if(r<pBreak){ type='breakable'; }
  else if(r<pBreak+pMove){ type='moving'; vx=(Math.random()<.5?-1:1)*(0.7+diff*1.3); }   // 移速起步慢 0.7→2.0
  var w=64;   // 台阶恒定宽度(齿轮已提供向上压力, 不再随高度变窄)
  var x=pickX(w); lastPlatX=x+w/2;
  var p={x:x,y:y,w:w,type:type,vx:vx,broken:false,spring:false};
  if(type!=='breakable' && Math.random()<0.10){ p.spring=true; }
  return p;
}
function reset(){
  currentSkin=store.skin;
  player={x:GW/2-22, y:GH-160, w:44, h:48, vx:0, vy:JUMP, face:1, squash:0, jet:0, shield:false, magOn:false, magTarget:null, magArm:0, inv:0};
  platforms=[]; items=[]; particles=[]; score=0; scrolled=0; frame=0; lastItemType=null; sinceItem=99;
  platforms.push({x:GW/2-40,y:GH-90,w:80,type:'normal',vx:0,broken:false,spring:false});
  lastPlatX=GW/2;
  var y=GH-90;
  for(var i=0;i<14;i++){ y-=randGap(); platforms.push(makePlatform(y)); }
  hp=maxHP; renderHP();
  hazardOn=false; hazardArmed=false; hazardWarn=0; hazardWarnArmed=false; hazardY=GH+200;
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
// 虚拟摇杆（相对滑动）：按下为原点，左右滑动越远越快，松手归零
function jStart(x,y){ if(state!=='play')return; if(demoOn) dismissDemo();
  var r=cv.getBoundingClientRect();
  touchStartX=x; touchBaseGX=(x-r.left)/r.width*GW; touchBaseGY=(y-r.top)/r.height*GH; touchCurGX=touchBaseGX; touchCurGY=touchBaseGY;
  touchActive=true; touchAxis=0; }
function jMove(x,y){ if(!touchActive)return;
  var r=cv.getBoundingClientRect();
  var maxDrag=Math.max(78,r.width*0.28);            // 满速所需滑动距离加大 → 不那么灵敏
  var raw=(x-touchStartX)/maxDrag;
  var s=raw<0?-1:1, a=Math.abs(raw);
  var dead=0.10;                                     // 死区：忽略微小抖动
  a=Math.min(1,Math.max(0,(a-dead)/(1-dead)));
  touchAxis=s*Math.pow(a,1.7);                       // 缓和曲线：近中心细腻、中段跟手、远端满速
  touchCurGX=(x-r.left)/r.width*GW; touchCurGY=(y-r.top)/r.height*GH;   // 指尖游戏坐标(画反馈用)
}
function jEnd(){ touchActive=false; touchAxis=0; }
cv.addEventListener('touchstart',function(e){ if(e.touches&&e.touches.length)jStart(e.touches[0].clientX, e.touches[0].clientY); e.preventDefault(); },{passive:false});
cv.addEventListener('touchmove',function(e){ if(e.touches&&e.touches.length)jMove(e.touches[0].clientX, e.touches[0].clientY); e.preventDefault(); },{passive:false});
cv.addEventListener('touchend',function(e){ jEnd(); e.preventDefault(); },{passive:false});
cv.addEventListener('touchcancel',function(){ jEnd(); },{passive:false});
cv.addEventListener('mousedown',function(e){ jStart(e.clientX, e.clientY); });
cv.addEventListener('mousemove',function(e){ jMove(e.clientX, e.clientY); });
window.addEventListener('mouseup',function(){ jEnd(); });

/* ---------- 更新 ---------- */
function update(){
  frame++;
  if(player.inv>0)player.inv--;
  if(player.magOn){ magnetTick(); }
  var ax=0;
  if(keyDir!==0) ax=keyDir;
  else if(touchActive) ax=touchAxis;
  if(ax>1)ax=1; else if(ax<-1)ax=-1;
  var targetVx=ax*MAXVX;
  var lerp=(ax===0)?0.34:0.18;   // 松手时更快归零，便于精确落点
  player.vx += (targetVx-player.vx)*lerp;
  if(ax===0 && Math.abs(player.vx)<0.05) player.vx=0;
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
  }
  collectItems();
  var line=GH*0.42;
  if(player.y<line){
    var dy=line-player.y; player.y=line; scrolled+=dy;
    platforms.forEach(function(p){p.y+=dy;});
    items.forEach(function(it){it.y+=dy;});
    particles.forEach(function(pt){pt.y+=dy;});
    if(hazardOn) hazardY+=dy;   // 世界滚动同步下压齿轮(弹性追赶核心: 爬得快→齿轮落后)
    score=Math.floor(scrolled/10);
  }
  platforms.forEach(function(p){ if(p.broken){p.fade=(p.fade||0)+0.05; p.y+=4;} });
  platforms=platforms.filter(function(p){return p.y<GH+30 && !(p.broken&&p.fade>1);});
  var ys=platforms.map(function(p){return p.y;}); ys.push(GH);
  var topY=Math.min.apply(null,ys);
  while(topY>-20){
    topY-=randGap();
    var np=makePlatform(topY); platforms.push(np);
    spawnItemMaybe(np);
  }
  items=items.filter(function(it){return it.y<GH+40 && !it.taken;});
  particles.forEach(function(pt){pt.x+=pt.vx;pt.y+=pt.vy;pt.vy+=0.3;pt.life--;});
  particles=particles.filter(function(pt){return pt.life>0;});
  // 齿轮上升线: 到分激活(从屏下升起) → 弹性上升(随分加速、封顶屏下 GH+120)
  if(!hazardArmed && score>=HAZ_ARM){ hazardArmed=true; hazardOn=true; hazardY=GH+30; }
  if(hazardOn){
    var hv=Math.min(HAZ_VMAX, HAZ_V0+(score-HAZ_ARM)*HAZ_VK); hazardY-=hv; if(hazardY>GH+HAZ_CLAMP) hazardY=GH+HAZ_CLAMP;   // 随高度逐步加速
    if(hazardY>GH){ hazardWarnArmed=false; }                                                                       // 齿轮回到屏下=安全, 预警复位(下次升上来再报一轮)
    else if(!hazardWarnArmed && hazardY-(player.y+player.h)<HAZ_WARN_DIST){ hazardWarn=HAZ_WARN; hazardWarnArmed=true; }   // 升到逼近毛球→只触发一轮(3声), 上升追赶途中不再加音
  }
  if(hazardWarn>0){ var preW=hazardWarn; hazardWarn--;                                          // 红光闪3下, 在3次脉冲峰值各响一声(共3声)
    var p1=HAZ_WARN*5/6, p2=HAZ_WARN/2, p3=HAZ_WARN/6;
    if((preW>p1&&hazardWarn<=p1)||(preW>p2&&hazardWarn<=p2)||(preW>p3&&hazardWarn<=p3)) sfx('warn');
  }
  // 受击统一出口: 齿轮优先于坠落, 二者共用 takeHit, 绝不双扣
  if(hazardOn && player.y+player.h>hazardY){ takeHit(); }
  else if(player.y>GH+10){ takeHit(); }
}
function bounceFx(p){for(var i=0;i<5;i++)particles.push({x:p.x+p.w/2,y:p.y+8,vx:(Math.random()-.5)*3,vy:-Math.random()*2,life:18,c:'#fff',r:2+Math.random()*2});}
function spawnShieldBreak(){   // 破盾碎裂：复活点喷一圈护盾色碎片
  var cx=player.x+player.w/2, cy=player.y+player.h*0.5, col=(THEME&&THEME.accent)||'#ff9a6c';
  for(var i=0;i<14;i++){ var a=i/14*6.2832+Math.random()*0.35, sp=2.6+Math.random()*3.6;
    particles.push({x:cx,y:cy,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-1.2,life:22+Math.random()*9,c:col,r:2+Math.random()*2.4}); }
}
function spawnBreak(p){for(var i=0;i<8;i++)particles.push({x:p.x+Math.random()*p.w,y:p.y+6,vx:(Math.random()-.5)*4,vy:-Math.random()*3,life:26,c:THEME.particleBreak,r:2+Math.random()*3});}
function spawnPuff(){particles.push({x:player.x+player.w/2+(Math.random()-.5)*10,y:player.y+player.h,vx:(Math.random()-.5)*1.5,vy:2+Math.random()*2,life:16,c:'rgba(255,255,255,.6)',r:3+Math.random()*3});}
/* ---------- 血量 HUD ---------- */
function heartSVG(fill,stroke){
  return '<svg viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41 0.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" fill="'+fill+'" stroke="'+stroke+'" stroke-width="1.4" stroke-linejoin="round"/></svg>';
}
function renderHP(){
  var el=document.getElementById('hp'); if(!el)return;
  var col=(THEME&&THEME.accent)||'#e23a32';
  var html='';
  for(var i=0;i<maxHP;i++){ var on=i<hp; html+='<span class="heart'+(on?'':' lost')+'">'+heartSVG(on?col:'none',col)+'</span>'; }
  el.innerHTML=html;
}
/* ---------- 复活 / 收集 / 磁铁 / 生成 ---------- */
function takeHit(){   // 统一受击出口: 坠落与齿轮共用 —— 护盾优先(不受无敌帧阻挡)、无敌期内免扣、绝不双扣
  if(player.shield){ player.shield=false; sfx('spring'); respawn(); spawnShieldBreak(); return; }
  if(player.inv>0) return;
  hp--; renderHP(); sfx('brk');
  if(hp<=0){ gameOver(); } else { respawn(); }
}
function respawn(){
  player.inv=72;
  // 落到最近的现有台阶(优先普通、取屏幕中下段)，不再凭空造台 → 根除复活台与已有台阶重叠
  var pcx=player.x+player.w/2, best=null, bd=1e9;
  for(var i=0;i<platforms.length;i++){
    var p=platforms[i];
    if(p.broken) continue;
    if(p.y<GH*0.40 || p.y>GH-40) continue;                 // 只取中下段，给复活留向上空间、又不贴底
    var d=Math.abs((p.x+p.w/2)-pcx)+(p.type==='breakable'?60:0)+(p.type==='moving'?20:0);  // 横向最近、优先普通台
    if(d<bd){ bd=d; best=p; }
  }
  if(!best){   // 兜底：附近确无合适台阶，才凭空造一块，并清掉与它重叠者
    var rx=Math.max(10,Math.min(GW-90,player.x));
    var rp={x:rx,y:GH-110,w:80,type:'normal',vx:0,broken:false,spring:false};
    platforms=platforms.filter(function(q){ return !(Math.abs(q.y-rp.y)<22 && q.x<rp.x+rp.w && q.x+q.w>rp.x); });
    platforms.push(rp); best=rp;
  }
  player.x=best.x+best.w/2-player.w/2; player.y=best.y-player.h;
  if(hazardOn){ hazardY=Math.max(hazardY, best.y+280); hazardWarn=0; hazardWarnArmed=false; }   // 复活后把齿轮压回落脚台下方+清预警, 避免复活即秒
  player.vy=JUMP; player.vx=0; player.squash=1; player.jet=0;
}
function collectItems(){
  var pl=player.x, pt=player.y, pr=player.x+player.w, pb=player.y+player.h;
  for(var i=0;i<items.length;i++){ var it=items[i]; if(it.taken)continue;
    if((it.type==='heart'&&hp>=maxHP)||(it.type==='shield'&&player.shield)){ it.taken=true; continue; }  // 满血红心/已有护盾的盾：作废，不显示不拾取
    if(pl<it.x+it.w && pr>it.x && pt<it.y+it.h && pb>it.y){
      it.taken=true; player.squash=1;
      if(it.type==='jet'){ player.jet=70; sfx('item'); }
      else if(it.type==='heart'){ hp=Math.min(maxHP,hp+1); renderHP(); sfx('item'); }
      else if(it.type==='shield'){ player.shield=true; sfx('item'); }
      else if(it.type==='magnet'){ player.magOn=true; player.magTarget=null; player.magArm=600; sfx('item'); }
    }
  }
}
function magnetTick(){
  var t=player.magTarget;
  if(t && t.taken){ player.magOn=false; player.magTarget=null; return; }  // 吸到那一个 → 效果结束
  if(t && t.y>GH+40){ t=player.magTarget=null; }                          // 目标掉出屏幕则放弃
  if(!t){
    var best=null, bd=1e9, pcx=player.x+player.w/2, pcy=player.y+player.h/2;
    for(var i=0;i<items.length;i++){ var it=items[i]; if(it.taken)continue;
      if(it.y>-20 && it.y<GH+20){ var dx=pcx-(it.x+it.w/2), dy=pcy-(it.y+it.h/2), d=dx*dx+dy*dy; if(d<bd){bd=d;best=it;} }
    }
    if(best){ player.magTarget=t=best; }
    else { player.magArm--; if(player.magArm<=0) player.magOn=false; return; }  // 暂无道具，等待首个出现
  }
  var px=player.x+player.w/2, py=player.y+player.h/2;
  var dx2=px-(t.x+t.w/2), dy2=py-(t.y+t.h/2), d2=Math.sqrt(dx2*dx2+dy2*dy2);
  if(d2>1){ var f=Math.min(7,Math.max(2.5,d2*0.18)); t.x+=dx2/d2*f; t.y+=dy2/d2*f; }
}
function spawnItemMaybe(np){
  sinceItem++;
  if(np.spring) return;                   // 该台阶已长弹簧 → 不再叠加道具（修复"一个台阶两种道具"）
  if(sinceItem<4) return;                 // 两道具至少隔 4 块平台，避免同屏扎堆
  if(Math.random()>0.34) return;          // 满足间隔后再按概率出
  var pool=[];                            // 加权候选
  if(hp<maxHP) pool.push(['heart',38]);
  pool.push(['jet',30]); if(!(player&&player.shield)) pool.push(['shield',18]); pool.push(['magnet',16]);  // 已有护盾时不再刷护盾（player 守卫防御）
  pool=pool.filter(function(p){return p[0]!==lastItemType;});  // 绝不连续同种
  if(!pool.length) return;                // 候选被排空则本次不生成（保险）
  var tot=0,i; for(i=0;i<pool.length;i++) tot+=pool[i][1];
  var r=Math.random()*tot, type=pool[pool.length-1][0];
  for(i=0;i<pool.length;i++){ r-=pool[i][1]; if(r<=0){ type=pool[i][0]; break; } }
  lastItemType=type; sinceItem=0;
  var w=(type==='jet')?20:22, h=(type==='jet')?24:22;
  var x=Math.max(2,Math.min(GW-w-2,np.x+np.w/2-w/2));
  items.push({x:x,y:np.y-h-6,w:w,h:h,type:type,taken:false});
}

/* ---------- 渲染 ---------- */
function rr(x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();}
function nowSec(){try{return performance.now()/1000;}catch(e){return Date.now()/1000;}}
/* ---------- 背景装饰：按主题随机播种 ---------- */
function seedDecor(){
  bgDecor=[];
  if(sceneStyle==='bubbles'){
    for(var i=0;i<13;i++){bgDecor.push({x:Math.random()*GW,y:Math.random()*960,r:24+Math.random()*98,a:0.05+Math.random()*0.13,ring:Math.random()<0.42,deep:Math.random()<0.34});}
  } else if(sceneStyle==='embers'){
    for(var j=0;j<26;j++){var big=Math.random()<0.22;bgDecor.push({kind:'ember',x:Math.random()*GW,y:Math.random()*GH,r:big?(2.2+Math.random()*1.8):(0.6+Math.random()*1.6),sp:8+Math.random()*24,ph:Math.random()*6.28,sw:2+Math.random()*7,big:big});}
    for(var js=0;js<5;js++){bgDecor.push({kind:'smoke',x:Math.random()*GW,y:Math.random()*GH,r:60+Math.random()*70,sp:5+Math.random()*7,ph:Math.random()*6.28,sw:6+Math.random()*10});}
          } else if(sceneStyle==='waves'){
    for(var k=0;k<14;k++){bgDecor.push({kind:'bubble',x:Math.random()*GW,y:Math.random()*GH,r:1+Math.random()*3.2,sp:9+Math.random()*20,ph:Math.random()*6.28,sw:4+Math.random()*9,a:0.20+Math.random()*0.26});}
    for(var k2=0;k2<16;k2++){bgDecor.push({kind:'glint',x:Math.random()*GW,y:GH*0.42+Math.random()*GH*0.58,r:1.2+Math.random()*2.0,sp:3+Math.random()*8,ph:Math.random()*6.28,a:0.26+Math.random()*0.36});}
    for(var k3=0;k3<3;k3++){bgDecor.push({kind:'jelly',x:Math.random()*GW,y:Math.random()*GH,sz:36+Math.random()*22,sp:4+Math.random()*5,ph:Math.random()*6.28});}
  } else if(sceneStyle==='souls'){
    for(var sm=0;sm<22;sm++){bgDecor.push({kind:'mote',x:Math.random()*GW,y:Math.random()*GH,r:1+Math.random()*2.3,sp:6+Math.random()*15,ph:Math.random()*6.28,sw:3+Math.random()*9,a:0.30+Math.random()*0.42,warm:Math.random()<0.45});}
    for(var so=0;so<4;so++){bgDecor.push({kind:'orb',x:Math.random()*GW,y:Math.random()*GH,r:34+Math.random()*40,sp:3+Math.random()*4,ph:Math.random()*6.28,warm:Math.random()<0.5});}
    var sutra='度空心念缘寂静渡劫莲';
    for(var sg=0;sg<5;sg++){bgDecor.push({kind:'glyph',ch:sutra.charAt(sg%sutra.length),x:24+Math.random()*(GW-48),y:Math.random()*GH,sp:4+Math.random()*7,ph:Math.random()*6.28,sz:17+Math.random()*13,a:0.16+Math.random()*0.10,tw:0.5+Math.random()*0.9});}
  }
}
function drawGrid(){
  ctx.strokeStyle=THEME.grid; ctx.lineWidth=1;
  var off=(scrolled%32);
  ctx.beginPath();
  for(var x=0;x<=GW;x+=32){ctx.moveTo(x,0);ctx.lineTo(x,GH);}
  for(var y=-32+off;y<=GH;y+=32){ctx.moveTo(0,y);ctx.lineTo(GW,y);}
  ctx.stroke();
}
function drawBubbles(){
  /* 极淡竖向渐变，给奶白底一点纵深 */
  var dg=cgrad('bb_v',function(){ var g=ctx.createLinearGradient(0,0,0,GH);
    g.addColorStop(0,'rgba(255,255,255,0)'); g.addColorStop(1,'rgba(210,150,130,0.10)'); return g; });
  ctx.fillStyle=dg; ctx.fillRect(0,0,GW,GH);
  var TILE=960, base=(scrolled*0.35)%TILE;
  ctx.save();
  for(var i=0;i<bgDecor.length;i++){
    var b=bgDecor[i], y=((b.y+base)%TILE+TILE)%TILE, col=b.deep?THEME.accentDark:THEME.accent;
    for(var k=-1;k<=1;k++){
      var yy=y+k*TILE; if(yy<-160||yy>GH+160) continue;
      if(b.ring){
        ctx.globalAlpha=b.a*1.6; ctx.lineWidth=Math.max(2,b.r*0.08); ctx.strokeStyle=col;
        ctx.beginPath();ctx.arc(b.x,yy,b.r,0,6.2832);ctx.stroke();
      } else {
        ctx.globalAlpha=b.a; ctx.fillStyle=col;
        ctx.beginPath();ctx.arc(b.x,yy,b.r,0,6.2832);ctx.fill();
        ctx.globalAlpha=b.a*0.85; ctx.fillStyle='rgba(255,255,255,0.5)';
        ctx.beginPath();ctx.arc(b.x-b.r*0.32,yy-b.r*0.32,b.r*0.16,0,6.2832);ctx.fill();
      }
    }
  }
  ctx.restore(); ctx.globalAlpha=1;
}
function drawEmbers(){
  var T=nowSec();
  /* 底部暖红余光（远处的火/热）*/
  var fg=cgrad('em_fg',function(){ var g=ctx.createLinearGradient(0,GH*0.55,0,GH);
    g.addColorStop(0,'rgba(120,30,20,0)'); g.addColorStop(1,'rgba(150,40,28,0.22)'); return g; });
  ctx.fillStyle=fg; ctx.fillRect(0,0,GW,GH);
  /* 飘烟（大而极淡，营造纵深）*/
  for(var s=0;s<bgDecor.length;s++){
    var sm=bgDecor[s]; if(sm.kind!=='smoke') continue;
    var sy=((sm.y - T*sm.sp)%(GH+200)+(GH+200))%(GH+200)-100;
    var sx=sm.x+Math.sin(T*0.3+sm.ph)*sm.sw;
    var rg=ctx.createRadialGradient(sx,sy,2,sx,sy,sm.r);
    rg.addColorStop(0,'rgba(86,32,26,0.11)'); rg.addColorStop(1,'rgba(40,16,16,0)');
    ctx.fillStyle=rg; ctx.beginPath(); ctx.arc(sx,sy,sm.r,0,6.2832); ctx.fill();
  }
  /* 暗角（更重、偏暖黑）*/
  var vg=cgrad('em_vg',function(){ var g=ctx.createRadialGradient(GW/2,GH*0.42,GH*0.14,GW/2,GH*0.54,GH*0.8);
    g.addColorStop(0,'rgba(0,0,0,0)'); g.addColorStop(1,'rgba(8,0,0,0.55)'); return g; });
  ctx.fillStyle=vg; ctx.fillRect(0,0,GW,GH);
  /* 余烬（部分更大更亮、带辉光）*/
  ctx.save();
  for(var i=0;i<bgDecor.length;i++){
    var e=bgDecor[i]; if(e.kind!=='ember') continue;
    var y=((e.y - T*e.sp)%GH+GH)%GH, x=e.x + Math.sin(T*1.2+e.ph)*e.sw;
    var tw=0.35+0.65*(0.5+0.5*Math.sin(T*3+e.ph));
    if(e.big){ ctx.shadowColor=THEME.accent; ctx.shadowBlur=8; }
    ctx.globalAlpha=tw*(e.big?0.95:0.8); ctx.fillStyle=THEME.accent;
    ctx.beginPath();ctx.arc(x,y,e.r,0,6.2832);ctx.fill();
    ctx.shadowBlur=0;
  }
  ctx.restore(); ctx.globalAlpha=1;
}
function drawWaves(){
  var T=nowSec();
  /* 梦幻朦胧：粉紫日落天空 → 波光海 竖向渐变（轻盈柔和，贴合封面）*/
  var bg=cgrad('wv_sky',function(){ var g=ctx.createLinearGradient(0,0,0,GH);
    g.addColorStop(0.00,'#c7cfea'); g.addColorStop(0.16,'#d9c6e2'); g.addColorStop(0.30,'#eec6d0');
    g.addColorStop(0.46,'#cfd6ec'); g.addColorStop(0.64,'#9ec8df'); g.addColorStop(1.00,'#6fb1d0'); return g; });
  ctx.fillStyle=bg; ctx.fillRect(0,0,GW,GH);
  /* 天空柔光晕（封面那种朦胧光感）*/
  var bloom=cgrad('wv_bloom',function(){ var g=ctx.createRadialGradient(GW*0.5,GH*0.17,4,GW*0.5,GH*0.20,GH*0.36);
    g.addColorStop(0,'rgba(255,250,238,0.5)'); g.addColorStop(1,'rgba(255,248,236,0)'); return g; });
  ctx.fillStyle=bloom; ctx.fillRect(0,0,GW,GH);
  /* 发光水母（少量点缀，半透明 + 暖金光环）*/
  for(var m=0;m<bgDecor.length;m++){
    var q=bgDecor[m]; if(q.kind!=='jelly') continue;
    var jy=((q.y - T*q.sp)%(GH+160)+(GH+160))%(GH+160)-80;
    var jx=q.x+Math.sin(T*0.4+q.ph)*q.sz*0.25;
    drawJelly(jx,jy,q.sz,0.42,q.ph,T);
  }
  /* 海面波光 sun-glints（下半部）*/
  ctx.save(); ctx.globalCompositeOperation='lighter';
  for(var gi=0;gi<bgDecor.length;gi++){
    var s=bgDecor[gi]; if(s.kind!=='glint') continue;
    var sy=((s.y - T*s.sp)%GH+GH)%GH, tw=0.4+0.6*(0.5+0.5*Math.sin(T*3+s.ph));
    ctx.globalAlpha=s.a*tw*0.9; ctx.fillStyle='#ffffff';
    ctx.fillRect(s.x-s.r*2, sy-0.5, s.r*4, 1); ctx.fillRect(s.x-0.5, sy-s.r, 1, s.r*2);
  }
  ctx.restore();
  /* 上升气泡 */
  ctx.save();
  for(var j=0;j<bgDecor.length;j++){
    var b=bgDecor[j]; if(b.kind!=='bubble') continue;
    var y=((b.y - T*b.sp)%GH+GH)%GH, x=b.x+Math.sin(T*0.8+b.ph)*b.sw;
    ctx.globalAlpha=b.a*0.7; ctx.strokeStyle='#ffffff'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.arc(x,y,b.r,0,6.2832); ctx.stroke();
  }
  ctx.restore(); ctx.globalAlpha=1;
}
function drawJelly(x,y,sz,a,ph,T){
  var pulse=1+0.06*Math.sin(T*1.2+ph), bw=sz*0.46*pulse, bh=sz*0.42;
  ctx.save(); ctx.translate(x,y); ctx.globalAlpha=a;
  ctx.strokeStyle='rgba(150,170,220,0.55)'; ctx.lineWidth=1.1; ctx.lineCap='round';
  for(var i=-2;i<=2;i++){
    var tx=i*bw*0.32;
    ctx.beginPath(); ctx.moveTo(tx,bh*0.2);
    ctx.quadraticCurveTo(tx+Math.sin(T*1.4+ph+i)*sz*0.10, bh+sz*0.18, tx+Math.sin(T*1.0+ph+i*1.3)*sz*0.08, bh+sz*0.5);
    ctx.stroke();
  }
  ctx.lineCap='butt';
  var grd=ctx.createRadialGradient(0,-bh*0.2,1,0,0,bw*1.2);
  grd.addColorStop(0,'rgba(245,247,255,0.85)'); grd.addColorStop(0.55,'rgba(188,201,236,0.55)'); grd.addColorStop(1,'rgba(172,190,230,0)');
  ctx.fillStyle=grd;
  ctx.beginPath();
  ctx.ellipse(0,0,bw,bh,0,Math.PI,2*Math.PI);
  ctx.quadraticCurveTo(bw*0.55,bh*0.5,0,bh*0.28);
  ctx.quadraticCurveTo(-bw*0.55,bh*0.5,-bw,0);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle='rgba(148,168,218,0.5)'; ctx.lineWidth=1; ctx.stroke();
  ctx.globalAlpha=a*0.75; ctx.strokeStyle='rgba(240,198,138,0.95)'; ctx.lineWidth=1.6;
  ctx.beginPath(); ctx.ellipse(0,-bh*0.05,bw*1.5,bh*0.7,0,0,6.2832); ctx.stroke();
  ctx.restore(); ctx.globalAlpha=1;
}
function drawBg(){
  ctx.fillStyle=THEME.bg; ctx.fillRect(0,0,GW,GH);
  if(bgReady&&bgImg){
    var iw=bgImg.naturalWidth, ih=bgImg.naturalHeight;
    var sc=Math.max(GW/iw,GH/ih), dw=iw*sc, dh=ih*sc;
    ctx.drawImage(bgImg,(GW-dw)/2,(GH-dh)/2,dw,dh);
  }
  if(sceneStyle==='bubbles') drawBubbles();
  else if(sceneStyle==='embers') drawEmbers();
  else if(sceneStyle==='waves') drawWaves();
  else if(sceneStyle==='souls') drawSouls();
  else drawGrid();
  var g=cgrad('dim',function(){ var gg=ctx.createLinearGradient(0,0,0,GH);
    gg.addColorStop(0,THEME.dimTop); gg.addColorStop(1,THEME.dimBot); return gg; });
  ctx.fillStyle=g; ctx.fillRect(0,0,GW,GH);
}
/* ---------- 平台：按主题三种造型 ---------- */
function drawRays(cx,cy,r,rot){   // 佛光光束: 从法轮中心缓旋射出的柔光
  var n=9, i;
  ctx.save(); ctx.translate(cx,cy); ctx.rotate(rot); ctx.globalCompositeOperation='lighter';
  for(i=0;i<n;i++){ ctx.rotate(6.2832/n);
    var g=ctx.createLinearGradient(0,0,0,-r);
    g.addColorStop(0,'rgba(255,216,140,0)'); g.addColorStop(0.12,'rgba(255,216,140,0.08)'); g.addColorStop(1,'rgba(255,216,140,0)');
    ctx.fillStyle=g; ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(-r*0.045,-r); ctx.lineTo(r*0.045,-r); ctx.closePath(); ctx.fill(); }
  ctx.restore();
}
function drawMandala(cx,cy,r,rot){   // 旋转光轮/曼陀罗(含呼吸): 金+青同心环+辐条+莲瓣
  var T=nowSec(), br=1+0.05*Math.sin(T*0.6);   // 缓慢呼吸缩放
  ctx.save(); ctx.translate(cx,cy); ctx.scale(br,br); ctx.rotate(rot);
  ctx.lineWidth=1.8;
  var rings=[r*0.38,r*0.58,r*0.78,r*1.0], i;
  for(i=0;i<rings.length;i++){ ctx.strokeStyle=(i%2?'rgba(255,206,122,0.26)':'rgba(96,235,214,0.24)'); ctx.beginPath(); ctx.arc(0,0,rings[i],0,6.2832); ctx.stroke(); }
  ctx.strokeStyle='rgba(255,214,140,0.15)'; ctx.lineWidth=1.2;
  for(i=0;i<16;i++){ var a=i/16*6.2832; ctx.beginPath(); ctx.moveTo(Math.cos(a)*r*0.38,Math.sin(a)*r*0.38); ctx.lineTo(Math.cos(a)*r,Math.sin(a)*r); ctx.stroke(); }
  for(i=0;i<12;i++){ var ap=i/12*6.2832; ctx.save(); ctx.rotate(ap); ctx.fillStyle=(i%2?'rgba(96,235,214,0.18)':'rgba(255,206,122,0.18)');
    ctx.beginPath(); ctx.ellipse(r*0.49,0,r*0.11,r*0.05,0,0,6.2832); ctx.fill(); ctx.restore(); }
  for(i=0;i<24;i++){ var a2=i/24*6.2832; ctx.fillStyle=(i%2?'rgba(96,235,214,0.32)':'rgba(255,212,132,0.32)'); ctx.beginPath(); ctx.arc(Math.cos(a2)*r*0.90,Math.sin(a2)*r*0.90,2.3,0,6.2832); ctx.fill(); }
  var ga=(0.22+0.12*Math.sin(T*0.6)).toFixed(3); var cg=ctx.createRadialGradient(0,0,1,0,0,r*0.36); cg.addColorStop(0,'rgba(255,216,142,'+ga+')'); cg.addColorStop(1,'rgba(255,216,142,0)'); ctx.fillStyle=cg; ctx.beginPath(); ctx.arc(0,0,r*0.36,0,6.2832); ctx.fill();
  ctx.restore();
}
function drawSouls(){   // 超度我(冷青+暖金): 青墨蓝深景 + 暖金光晕 + 旋转光轮/曼陀罗 + 漂浮经文 + 暖金烛光×青魂光双光池 + 青/金混色魂点
  var T=nowSec();
  var bg=cgrad('sl_bg',function(){ var g=ctx.createLinearGradient(0,0,0,GH);
    g.addColorStop(0,'#0e2f3e'); g.addColorStop(0.5,'#134a54'); g.addColorStop(1,'#1a6168'); return g; });
  ctx.fillStyle=bg; ctx.fillRect(0,0,GW,GH);
  var halo=cgrad('sl_halo',function(){ var g=ctx.createRadialGradient(GW*0.5,GH*0.32,8,GW*0.5,GH*0.32,GH*0.48);
    g.addColorStop(0,'rgba(255,196,108,0.20)'); g.addColorStop(0.55,'rgba(255,182,96,0.07)'); g.addColorStop(1,'rgba(255,182,96,0)'); return g; });
  ctx.fillStyle=halo; ctx.fillRect(0,0,GW,GH);
  drawRays(GW*0.5, GH*0.32, GH*0.56, -T*0.02);   // 佛光(反向缓旋, 在法轮之后)
  drawMandala(GW*0.5, GH*0.32, GH*0.42, T*0.04);
  var poolT=cgrad('sl_poolT',function(){ var g=ctx.createRadialGradient(GW*0.5,GH*1.05,12,GW*0.5,GH*1.05,GH*0.70);
    g.addColorStop(0,'rgba(96,232,214,0.42)'); g.addColorStop(0.5,'rgba(67,216,196,0.16)'); g.addColorStop(1,'rgba(67,216,196,0)'); return g; });
  ctx.fillStyle=poolT; ctx.fillRect(0,0,GW,GH);
  var poolW=cgrad('sl_poolW',function(){ var g=ctx.createRadialGradient(GW*0.5,GH*1.02,8,GW*0.5,GH*1.02,GH*0.42);
    g.addColorStop(0,'rgba(255,200,108,0.46)'); g.addColorStop(0.6,'rgba(255,178,86,0.14)'); g.addColorStop(1,'rgba(255,178,86,0)'); return g; });
  ctx.fillStyle=poolW; ctx.fillRect(0,0,GW,GH);
  ctx.save(); ctx.textAlign='center'; ctx.textBaseline='middle';
  for(var s0=0;s0<bgDecor.length;s0++){ var gl=bgDecor[s0]; if(gl.kind!=='glyph') continue;
    var gy=((gl.y - T*gl.sp)%(GH+60)+(GH+60))%(GH+60)-30, gx=gl.x+Math.sin(T*0.2+gl.ph)*10;
    var tw=0.30+0.70*Math.abs(Math.sin(T*gl.tw+gl.ph)), sc=1+0.12*Math.sin(T*gl.tw*0.8+gl.ph);   // 明灭呼吸+缩放
    ctx.save(); ctx.translate(gx,gy); ctx.rotate(Math.sin(T*0.25+gl.ph)*0.13);                    // 轻微旋转
    ctx.globalAlpha=gl.a*tw; ctx.fillStyle=(s0%2?'#c8efe5':'#f3d9a6'); ctx.font=(gl.sz*sc).toFixed(1)+"px 'sutra',serif";
    ctx.fillText(gl.ch,0,0); ctx.restore();
  }
  ctx.restore(); ctx.globalAlpha=1;
  for(var s=0;s<bgDecor.length;s++){ var o=bgDecor[s]; if(o.kind!=='orb') continue;
    var oy=((o.y - T*o.sp)%(GH+160)+(GH+160))%(GH+160)-80, ox=o.x+Math.sin(T*0.3+o.ph)*16;
    var oc=o.warm?'255,206,120':'96,238,218', rg=ctx.createRadialGradient(ox,oy,2,ox,oy,o.r);
    rg.addColorStop(0,'rgba('+oc+',0.12)'); rg.addColorStop(1,'rgba('+oc+',0)');
    ctx.fillStyle=rg; ctx.beginPath(); ctx.arc(ox,oy,o.r,0,6.2832); ctx.fill();
  }
  ctx.save(); ctx.globalCompositeOperation='lighter';
  for(var i=0;i<bgDecor.length;i++){ var m=bgDecor[i]; if(m.kind!=='mote') continue;
    var y=((m.y - T*m.sp)%GH+GH)%GH, x=m.x+Math.sin(T*0.7+m.ph)*m.sw, tw=0.4+0.6*(0.5+0.5*Math.sin(T*2.4+m.ph));
    ctx.globalAlpha=m.a*tw; ctx.fillStyle=m.warm?'#ffd98a':'#86f2de';
    ctx.beginPath(); ctx.arc(x,y,m.r*(m.warm?1.15:1),0,6.2832); ctx.fill();
  }
  ctx.restore(); ctx.globalAlpha=1;
}
function drawSpring(x,y,w){
  if(itemStyle==='noir') drawSpringNoir(x,y,w);
  else if(itemStyle==='pop') drawSpringPop(x,y,w);
  else if(itemStyle==='aqua') drawSpringAqua(x,y,w);
  else if(itemStyle==='relic') drawSpringAqua(x,y,w);
  else drawSpringClassic(x,y,w);
}
function drawSpringClassic(x,y,w){
  ctx.strokeStyle='#555';ctx.lineWidth=2;var sx=x+w/2;
  ctx.beginPath();ctx.moveTo(sx-5,y-2);ctx.lineTo(sx-5,y-12);ctx.lineTo(sx+5,y-8);ctx.lineTo(sx+5,y-16);ctx.stroke();
  ctx.fillStyle=THEME.spring;rr(sx-8,y-22,16,7,3);ctx.fill();
  ctx.strokeStyle=THEME.springEdge;ctx.lineWidth=1.5;rr(sx-8,y-22,16,7,3);ctx.stroke();
}
function drawSpringNoir(x,y,w){          /* 双直金属杆 + 暗锐板 + 红光顶边 */
  var sx=x+w/2;
  ctx.strokeStyle='#8a8278';ctx.lineWidth=2.2;
  ctx.beginPath();ctx.moveTo(sx-4,y-1);ctx.lineTo(sx-4,y-14);ctx.moveTo(sx+4,y-1);ctx.lineTo(sx+4,y-14);ctx.stroke();
  ctx.save();ctx.shadowColor=THEME.accent;ctx.shadowBlur=8;
  ctx.fillStyle='#2c2622';rr(sx-9,y-22,18,8,1);ctx.fill();
  ctx.strokeStyle=THEME.accent;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(sx-8,y-21);ctx.lineTo(sx+8,y-21);ctx.stroke();
  ctx.restore();
  ctx.strokeStyle='#5a534c';ctx.lineWidth=1;rr(sx-9,y-22,18,8,1);ctx.stroke();
}
function drawSpringPop(x,y,w){           /* 粗螺旋 + 珊瑚胶囊垫 + 白高光 */
  var sx=x+w/2;
  ctx.strokeStyle=THEME.accentDark;ctx.lineWidth=3;ctx.lineCap='round';
  ctx.beginPath();ctx.moveTo(sx-5,y-1);ctx.lineTo(sx+5,y-6);ctx.lineTo(sx-5,y-11);ctx.lineTo(sx+5,y-16);ctx.stroke();
  ctx.lineCap='butt';
  ctx.fillStyle=THEME.accent;rr(sx-10,y-24,20,9,4.5);ctx.fill();
  ctx.save();rr(sx-10,y-24,20,9,4.5);ctx.clip();ctx.fillStyle='rgba(255,255,255,.55)';rr(sx-8,y-23,16,3,1.5);ctx.fill();ctx.restore();
  ctx.strokeStyle=THEME.accentDark;ctx.lineWidth=1.6;rr(sx-10,y-24,20,9,4.5);ctx.stroke();
}
function drawSpringAqua(x,y,w){          /* 弧形软杆 + 水滴胶囊垫 + 柔光高光 */
  var sx=x+w/2;
  ctx.strokeStyle=THEME.accentDark;ctx.lineWidth=2.2;ctx.lineCap='round';
  ctx.beginPath();
  ctx.moveTo(sx-5,y-1);ctx.quadraticCurveTo(sx-8,y-8,sx-5,y-15);
  ctx.moveTo(sx+5,y-1);ctx.quadraticCurveTo(sx+8,y-8,sx+5,y-15);
  ctx.stroke();
  ctx.lineCap='butt';
  ctx.save();ctx.shadowColor=THEME.accent;ctx.shadowBlur=9;
  ctx.fillStyle=THEME.spring;rr(sx-10,y-23,20,8,4);ctx.fill();
  ctx.restore();
  ctx.strokeStyle=THEME.springEdge;ctx.lineWidth=1.5;rr(sx-10,y-23,20,8,4);ctx.stroke();
  ctx.fillStyle='rgba(255,255,255,.55)';rr(sx-7,y-22,12,2.4,1.2);ctx.fill();
}
function drawRound(p,x,y,w,h,fill,edge){
  var r=7;
  ctx.fillStyle='rgba(0,0,0,.18)';rr(x+2,y+3,w,h,r);ctx.fill();
  ctx.fillStyle=fill;rr(x,y,w,h,r);ctx.fill();
  ctx.lineWidth=2.4;ctx.strokeStyle=edge;rr(x,y,w,h,r);ctx.stroke();
  if(p.type==='breakable'){ctx.strokeStyle=edge;ctx.lineWidth=1.6;ctx.beginPath();ctx.moveTo(x+w*0.4,y);ctx.lineTo(x+w*0.5,y+h);ctx.stroke();}
}
function drawPill(p,x,y,w,h,fill,edge){
  var r=h/2;
  ctx.fillStyle='rgba(0,0,0,.10)';rr(x+1,y+4,w,h,r);ctx.fill();
  ctx.fillStyle=fill;rr(x,y,w,h,r);ctx.fill();
  ctx.save();rr(x,y,w,h,r);ctx.clip();
  ctx.fillStyle='rgba(255,255,255,.30)';rr(x+3,y+2,w-6,h*0.40,r);ctx.fill();
  ctx.restore();
  ctx.lineWidth=2;ctx.strokeStyle=edge;rr(x,y,w,h,r);ctx.stroke();
  if(p.type==='breakable'){ctx.strokeStyle=edge;ctx.lineWidth=1.4;ctx.setLineDash([3,3]);ctx.beginPath();ctx.moveTo(x+w*0.5,y+2);ctx.lineTo(x+w*0.5,y+h-2);ctx.stroke();ctx.setLineDash([]);}
}
function drawSlab(p,x,y,w,h,fill,edge){
  var r=2;
  ctx.fillStyle='rgba(0,0,0,.38)';rr(x+2,y+4,w,h,r);ctx.fill();
  ctx.fillStyle=fill;rr(x,y,w,h,r);ctx.fill();
  ctx.fillStyle='rgba(0,0,0,.16)';rr(x,y+h*0.58,w,h*0.42,r);ctx.fill();
  ctx.save();
  ctx.shadowColor=THEME.accent; ctx.shadowBlur=8;
  ctx.strokeStyle=THEME.accent; ctx.lineWidth=2;
  ctx.beginPath();ctx.moveTo(x+r+1,y+1.2);ctx.lineTo(x+w-r-1,y+1.2);ctx.stroke();
  ctx.restore();
  ctx.lineWidth=1.2;ctx.strokeStyle=edge;rr(x,y,w,h,r);ctx.stroke();
  if(p.type==='breakable'){ctx.strokeStyle=THEME.accent;ctx.lineWidth=1.4;ctx.beginPath();ctx.moveTo(x+w*0.42,y);ctx.lineTo(x+w*0.52,y+h);ctx.stroke();}
}
function drawWavePlat(p,x,y,w,h,fill,edge){     /* 水玻璃台：玻璃反光 + 暖金 caustic 顶边 + 强对比 */
  var r=7;
  ctx.fillStyle='rgba(6,12,32,.42)';rr(x+2,y+5,w,h,r);ctx.fill();
  rr(x,y,w,h,r);ctx.fillStyle=fill;ctx.fill();
  ctx.save();rr(x,y,w,h,r);ctx.clip();
  var gg=ctx.createLinearGradient(0,y,0,y+h);
  gg.addColorStop(0,'rgba(255,255,255,.34)');gg.addColorStop(0.42,'rgba(255,255,255,.05)');gg.addColorStop(1,'rgba(20,26,58,.22)');
  ctx.fillStyle=gg;ctx.fillRect(x,y,w,h);
  ctx.fillStyle='rgba(255,255,255,.22)';rr(x+4,y+1.6,w-8,h*0.30,r*0.6);ctx.fill();
  ctx.strokeStyle='rgba(255,255,255,.18)';ctx.lineWidth=1.2;
  ctx.beginPath();ctx.moveTo(x+5,y+h*0.66);
  ctx.quadraticCurveTo(x+w*0.3,y+h*0.52,x+w*0.55,y+h*0.66);
  ctx.quadraticCurveTo(x+w*0.8,y+h*0.80,x+w-5,y+h*0.64);
  ctx.stroke();
  ctx.restore();
  ctx.save();ctx.shadowColor=THEME.accent;ctx.shadowBlur=9;ctx.lineCap='round';
  ctx.strokeStyle=THEME.accent;ctx.lineWidth=2.4;
  ctx.beginPath();ctx.moveTo(x+r,y+1.8);ctx.quadraticCurveTo(x+w*0.5,y-1.6,x+w-r,y+1.8);ctx.stroke();
  ctx.restore();ctx.lineCap='butt';
  ctx.lineWidth=1.6;ctx.strokeStyle=edge;rr(x,y,w,h,r);ctx.stroke();
  if(p.type==='breakable'){ctx.strokeStyle=edge;ctx.lineWidth=1.4;ctx.setLineDash([2,3]);ctx.beginPath();ctx.moveTo(x+w*0.42,y);ctx.lineTo(x+w*0.5,y+h);ctx.stroke();ctx.setLineDash([]);}
}
function drawTablet(p,x,y,w,h,fill,edge){   // 超度我: 黄铜牌位 + 青绿冷光顶边 + 錾刻中线
  var r=3;
  ctx.fillStyle='rgba(2,16,20,.40)';rr(x+2,y+4,w,h,r);ctx.fill();
  ctx.fillStyle=fill;rr(x,y,w,h,r);ctx.fill();
  ctx.fillStyle='rgba(0,0,0,.16)';rr(x,y+h*0.56,w,h*0.44,r);ctx.fill();
  ctx.strokeStyle='rgba(255,240,210,.16)';ctx.lineWidth=1;
  ctx.beginPath();ctx.moveTo(x+5,y+h*0.5);ctx.lineTo(x+w-5,y+h*0.5);ctx.stroke();
  ctx.save();ctx.shadowColor=THEME.accent;ctx.shadowBlur=8;ctx.strokeStyle=THEME.accent;ctx.lineWidth=2;
  ctx.beginPath();ctx.moveTo(x+r+1,y+1.4);ctx.lineTo(x+w-r-1,y+1.4);ctx.stroke();ctx.restore();
  ctx.lineWidth=1.3;ctx.strokeStyle=edge;rr(x,y,w,h,r);ctx.stroke();
  if(p.type==='breakable'){ctx.strokeStyle=THEME.accent;ctx.lineWidth=1.4;ctx.beginPath();ctx.moveTo(x+w*0.42,y);ctx.lineTo(x+w*0.52,y+h);ctx.stroke();}
}
function roundPlat(p){
  var x=p.x,y=p.y,w=p.w,h=14,fill,edge;
  if(p.type==='moving'){fill=THEME.pM;edge=THEME.pMe;}
  else if(p.type==='breakable'){fill=THEME.pB;edge=THEME.pBe;}
  else {fill=THEME.pN;edge=THEME.pNe;}
  ctx.save();
  if(p.broken){ctx.globalAlpha=Math.max(0,1-(p.fade||0));}
  if(platStyle==='slab') drawSlab(p,x,y,w,h,fill,edge);
  else if(platStyle==='pill') drawPill(p,x,y,w,h,fill,edge);
  else if(platStyle==='wave') drawWavePlat(p,x,y,w,h,fill,edge);
  else if(platStyle==='tablet') drawTablet(p,x,y,w,h,fill,edge);
  else drawRound(p,x,y,w,h,fill,edge);
  if(p.spring) drawSpring(x,y,w);
  ctx.restore();
}
function itemGlow(){ return itemStyle==='noir'||itemStyle==='aqua'||itemStyle==='relic'; }
function itemGloss(){ return itemStyle==='pop'||itemStyle==='aqua'||itemStyle==='relic'; }
function heartPath(sz){
  ctx.beginPath();
  ctx.moveTo(0,-sz*0.28);
  ctx.bezierCurveTo(0,-sz*0.62, sz*0.56,-sz*0.62, sz*0.56,-sz*0.18);
  ctx.bezierCurveTo(sz*0.56,sz*0.14, sz*0.16,sz*0.30, 0,sz*0.56);
  ctx.bezierCurveTo(-sz*0.16,sz*0.30, -sz*0.56,sz*0.14, -sz*0.56,-sz*0.18);
  ctx.bezierCurveTo(-sz*0.56,-sz*0.62, 0,-sz*0.62, 0,-sz*0.28);
  ctx.closePath();
}
function drawItem(it){
  if(it.type==='jet'){ if(itemStyle==='classic') drawJetClassic(it); else drawRocketThemed(it); }
  else if(it.type==='heart') drawHeart(it);
  else if(it.type==='shield') drawShield(it);
  else if(it.type==='magnet') drawMagnet(it);
}
function drawJetClassic(it){
  ctx.save();ctx.translate(it.x+it.w/2,it.y+it.h/2);
  ctx.fillStyle='#ff7a59';rr(-9,-12,18,22,5);ctx.fill();
  ctx.lineWidth=2;ctx.strokeStyle='#c84e2e';rr(-9,-12,18,22,5);ctx.stroke();
  ctx.fillStyle='#ffd45b';ctx.beginPath();ctx.moveTo(-6,10);ctx.lineTo(0,20);ctx.lineTo(6,10);ctx.closePath();ctx.fill();
  ctx.restore();
}
function drawRocketThemed(it){
  ctx.save();ctx.translate(it.x+it.w/2,it.y+it.h/2);
  var noir=itemStyle==='noir', aqua=itemStyle==='aqua', relic=itemStyle==='relic';
  var body=noir?'#2c2622':(aqua?'#f28a4e':(relic?'#ee7e3c':THEME.accent)), edge=aqua?'#c25f2c':(relic?'#b85420':THEME.accentDark), flame=noir?THEME.accent:(relic?'#ffd66a':'#ffd45b');
  var glow=aqua?'#f28a4e':THEME.accent;
  if(itemGlow()){ctx.shadowColor=glow;ctx.shadowBlur=8;}
  ctx.fillStyle=body;rr(-9,-12,18,22,5);ctx.fill();ctx.shadowBlur=0;
  ctx.lineWidth=2;ctx.strokeStyle=edge;rr(-9,-12,18,22,5);ctx.stroke();
  ctx.fillStyle=noir?THEME.accent:'#ffffff';ctx.beginPath();ctx.arc(0,-4,3.4,0,6.2832);ctx.fill();
  if(itemGloss()){ctx.fillStyle='rgba(255,255,255,.45)';rr(-6,-10,4,12,2);ctx.fill();}
  ctx.fillStyle=flame;ctx.beginPath();ctx.moveTo(-6,10);ctx.lineTo(0,20);ctx.lineTo(6,10);ctx.closePath();ctx.fill();
  ctx.restore();
}
function drawHeart(it){
  ctx.save();ctx.translate(it.x+it.w/2,it.y+it.h/2);
  var aqua=itemStyle==='aqua', relic=itemStyle==='relic';
  var sz=15, c=aqua?'#ef7a9c':(relic?'#4fe0c8':THEME.accent), e=aqua?'#cc587b':(relic?'#2a9d8a':THEME.accentDark);
  if(itemGlow()){ctx.shadowColor=c;ctx.shadowBlur=9;}
  heartPath(sz);ctx.fillStyle=c;ctx.fill();ctx.shadowBlur=0;
  ctx.lineWidth=1.6;ctx.strokeStyle=e;heartPath(sz);ctx.stroke();
  if(itemGloss()){ctx.fillStyle='rgba(255,255,255,.55)';ctx.beginPath();ctx.ellipse(-sz*0.2,-sz*0.18,sz*0.16,sz*0.10,-0.5,0,6.2832);ctx.fill();}
  ctx.restore();
}
function drawShield(it){
  ctx.save();ctx.translate(it.x+it.w/2,it.y+it.h/2);
  var noir=itemStyle==='noir', aqua=itemStyle==='aqua', relic=itemStyle==='relic', w=18,h=22, c=aqua?'#5fa6e2':(relic?'#74b8e0':THEME.accent), e=aqua?'#356f9a':(relic?'#3f7da6':THEME.accentDark);
  function shp(){ ctx.beginPath();ctx.moveTo(0,-h/2);ctx.lineTo(w/2,-h/2+5);ctx.lineTo(w/2,h*0.12);ctx.quadraticCurveTo(w/2,h*0.42,0,h/2);ctx.quadraticCurveTo(-w/2,h*0.42,-w/2,h*0.12);ctx.lineTo(-w/2,-h/2+5);ctx.closePath(); }
  if(itemGlow()){ctx.shadowColor=c;ctx.shadowBlur=9;}
  shp();ctx.fillStyle=noir?'#2c2622':'#ffffff';ctx.fill();ctx.shadowBlur=0;
  ctx.save();shp();ctx.clip();ctx.fillStyle=c;ctx.fillRect(-w,0,w*2,h);ctx.restore();
  ctx.lineWidth=2;ctx.strokeStyle=e;shp();ctx.stroke();
  ctx.strokeStyle='#ffffff';ctx.lineWidth=2;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(-4,-1);ctx.lineTo(-1,3);ctx.lineTo(5,-5);ctx.stroke();ctx.lineCap='butt';
  if(itemGloss()){ctx.fillStyle='rgba(255,255,255,.35)';ctx.beginPath();ctx.ellipse(-4,-5,4,6,-0.4,0,6.2832);ctx.fill();}
  ctx.restore();
}
function drawMagnet(it){
  ctx.save();ctx.translate(it.x+it.w/2,it.y+it.h/2);
  var noir=itemStyle==='noir', aqua=itemStyle==='aqua';
  var bodyC=noir?'#6a645c':(itemStyle==='pop'?'#e08a72':(aqua?'#d6564e':(itemStyle==='relic'?'#d8604a':'#9aa0a6')));
  if(itemGlow()){ctx.shadowColor=aqua?'#dd5a50':THEME.accent;ctx.shadowBlur=8;}
  ctx.lineWidth=6;ctx.strokeStyle=bodyC;
  ctx.beginPath();ctx.arc(0,-1,7,Math.PI,0,false);ctx.stroke();
  ctx.beginPath();ctx.moveTo(-7,-1);ctx.lineTo(-7,8);ctx.moveTo(7,-1);ctx.lineTo(7,8);ctx.stroke();
  ctx.shadowBlur=0;
  ctx.lineWidth=6;ctx.strokeStyle=aqua?'#dd5a50':THEME.accent;ctx.beginPath();ctx.moveTo(-7,5);ctx.lineTo(-7,9.5);ctx.stroke();
  ctx.strokeStyle=aqua?'#f4f6f8':'#dcdcdc';ctx.beginPath();ctx.moveTo(7,5);ctx.lineTo(7,9.5);ctx.stroke();
  ctx.restore();
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
  if(player.inv>0 && Math.floor(player.inv/4)%2===0){ ctx.globalAlpha=0.4; }
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
  if(player.magOn){ ctx.globalAlpha=0.22+0.14*Math.sin(frame*0.2); ctx.setLineDash([3,4]); ctx.lineWidth=1.6; ctx.strokeStyle=THEME.accent; ctx.beginPath(); ctx.arc(0,-h*0.5,player.w*0.92,0,6.2832); ctx.stroke(); ctx.setLineDash([]); }
  if(player.shield){ ctx.globalAlpha=1; ctx.fillStyle='rgba(255,255,255,0.10)'; ctx.beginPath(); ctx.arc(0,-h*0.5,player.w*0.66,0,6.2832); ctx.fill(); ctx.lineWidth=2.6; ctx.strokeStyle=THEME.accent; ctx.beginPath(); ctx.arc(0,-h*0.5,player.w*0.66,0,6.2832); ctx.stroke(); }
  ctx.globalAlpha=1;
  ctx.restore();
}
function drawGear(cx,cy,r,rot){
  ctx.save(); ctx.translate(cx,cy); ctx.rotate(rot);
  var teeth=8, i;
  ctx.fillStyle='#7a6f63';
  for(i=0;i<teeth;i++){ ctx.save(); ctx.rotate(i/teeth*6.2832); ctx.fillRect(-r*0.16,-r*1.12,r*0.32,r*0.36); ctx.restore(); }
  ctx.beginPath(); ctx.arc(0,0,r*0.92,0,6.2832); ctx.fillStyle='#6b6157'; ctx.fill();
  ctx.beginPath(); ctx.arc(0,0,r*0.40,0,6.2832); ctx.fillStyle='#46403a'; ctx.fill();
  ctx.beginPath(); ctx.arc(-r*0.18,-r*0.18,r*0.16,0,6.2832); ctx.fillStyle='rgba(255,255,255,0.20)'; ctx.fill();
  ctx.restore();
}
function gearStrip(y){   // 危险线(红+白热) + 旋转齿轮排, 不含死亡区蒙层; 供"探头"与"正式上升"复用
  ctx.fillStyle='#2a2320'; ctx.fillRect(0,y+12,GW,13);
  var near=(player&&(y-(player.y+player.h))<120);
  var ga=near?(0.55+0.45*Math.abs(Math.sin(frame*0.3))):0.55;
  ctx.globalAlpha=ga; ctx.fillStyle='#ff2a2a'; ctx.fillRect(0,y+8,GW,4);
  ctx.globalAlpha=Math.min(1,ga+0.25); ctx.fillStyle='#fff2f2'; ctx.fillRect(0,y+9,GW,2);
  ctx.globalAlpha=1;
  var n=10, gp=GW/n, rr=gp*0.33, rot=frame*0.05, k;   // 齿轮再缩小: 10 颗、半径更小
  for(k=0;k<n;k++){ drawGear(gp*(k+0.5), y+13, rr, (k%2?rot:-rot)); }
}
function drawHazard(){
  // 入场预警: 底部红光带(高度减半 36) 脉冲三下 + 齿轮随脉冲探头(让用户明白红光=齿轮要来了)
  if(hazardWarn>0){
    var t=hazardWarn/HAZ_WARN, pulse=Math.abs(Math.sin(t*Math.PI*3)), hh=50;
    var g=cgrad('hazWarn', function(){ var gg=ctx.createLinearGradient(0,GH,0,GH-hh); gg.addColorStop(0,'rgba(255,40,40,0.9)'); gg.addColorStop(1,'rgba(255,40,40,0)'); return gg; });
    ctx.save(); ctx.globalAlpha=pulse*0.9; ctx.fillStyle=g; ctx.fillRect(0,GH-hh,GW,hh); ctx.restore();
    if(hazardY>GH){ ctx.save(); gearStrip(GH-6-pulse*30); ctx.restore(); }   // 仅齿轮尚在屏下时探头(否则真齿轮已可见)
  }
  if(!hazardOn) return;
  var y=hazardY; if(y>GH+40) return;
  ctx.save();
  ctx.globalAlpha=0.22; ctx.fillStyle='#5a0d0d'; ctx.fillRect(0,y+12,GW,GH-(y+12)); ctx.globalAlpha=1;   // 死亡区半透明深红蒙层
  gearStrip(y);
  ctx.restore();
}
function drawTouchGuide(){   // 可见操控反馈(仅水平、更小): 水平轨 + 底环 + 指尖(=转向值,锁水平) + 力度箭头
  var bx=touchBaseGX, by=touchBaseGY, R=21, d=touchAxis, tx=bx+d*R, ty=by;
  ctx.save(); ctx.lineCap='round';
  ctx.lineWidth=3; ctx.strokeStyle='rgba(255,255,255,0.28)'; ctx.beginPath(); ctx.moveTo(bx-R,by); ctx.lineTo(bx+R,by); ctx.stroke();
  ctx.lineWidth=2; ctx.strokeStyle='rgba(255,255,255,0.42)'; ctx.beginPath(); ctx.arc(bx,by,R,0,6.2832); ctx.stroke();
  var col=Math.abs(d)<0.05?'rgba(255,255,255,0.92)':(d<0?'rgba(120,210,255,0.96)':'rgba(255,198,110,0.96)');
  ctx.fillStyle='rgba(255,255,255,0.24)'; ctx.beginPath(); ctx.arc(tx,ty,12,0,6.2832); ctx.fill();
  ctx.fillStyle=col; ctx.beginPath(); ctx.arc(tx,ty,8,0,6.2832); ctx.fill();
  if(Math.abs(d)>0.05){ var sgn=d<0?-1:1, ax=bx+sgn*(R+5), len=6+Math.abs(d)*11;
    ctx.fillStyle=col; ctx.beginPath(); ctx.moveTo(ax+sgn*len,by); ctx.lineTo(ax,by-6); ctx.lineTo(ax,by+6); ctx.closePath(); ctx.fill(); }
  ctx.restore();
}
function drawDemo(){   // 首玩手势演示: 半透明幽灵手指循环"按住→左右滑", 触碰即消失
  var t=frame*0.045, cx=GW/2, span=GW*0.26, bx=cx+Math.sin(t)*span, by=GH*0.80;
  ctx.save();
  ctx.strokeStyle='rgba(255,255,255,0.22)'; ctx.lineWidth=2; ctx.setLineDash([5,6]);
  ctx.beginPath(); ctx.moveTo(cx-span,by); ctx.lineTo(cx+span,by); ctx.stroke(); ctx.setLineDash([]);
  var rp=(t*0.8)%1; ctx.strokeStyle='rgba(255,255,255,'+(0.42*(1-rp)).toFixed(3)+')'; ctx.lineWidth=2;
  ctx.beginPath(); ctx.arc(bx,by,10+rp*16,0,6.2832); ctx.stroke();
  ctx.fillStyle='rgba(255,255,255,0.30)'; ctx.beginPath(); ctx.arc(bx,by,16,0,6.2832); ctx.fill();
  ctx.fillStyle='rgba(255,255,255,0.92)'; ctx.beginPath(); ctx.arc(bx,by,11,0,6.2832); ctx.fill();
  ctx.save(); ctx.translate(bx,by); ctx.rotate(-0.5); ctx.fillStyle='rgba(255,255,255,0.5)'; rr(-7,-46,14,40,7); ctx.fill(); ctx.restore();
  var sgn=Math.cos(t)<0?-1:1, ax=bx+sgn*26;
  ctx.fillStyle='rgba(255,255,255,0.72)'; ctx.beginPath(); ctx.moveTo(ax+sgn*10,by); ctx.lineTo(ax,by-7); ctx.lineTo(ax,by+7); ctx.closePath(); ctx.fill();
  ctx.fillStyle='rgba(255,255,255,0.94)'; ctx.font='600 16px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='alphabetic';
  ctx.fillText('按住屏幕，左右滑动转向', cx, GH*0.66);
  ctx.restore();
}
function render(){
  drawBg();
  if(state!=='play' && state!=='pause') return;   // 菜单/结算只显示纯主题背景，不画平台与毛球
  for(var i=0;i<platforms.length;i++)roundPlat(platforms[i]);
  for(var j=0;j<items.length;j++)drawItem(items[j]);
  for(var k=0;k<particles.length;k++){var pt=particles[k];ctx.globalAlpha=Math.max(0,pt.life/26);ctx.fillStyle=pt.c;ctx.beginPath();ctx.arc(pt.x,pt.y,pt.r,0,Math.PI*2);ctx.fill();}
  ctx.globalAlpha=1;
  drawHazard();
  if(player)drawPlayer();
  if(touchActive && guideOn) drawTouchGuide(); else if(demoOn) drawDemo();
}
var STEP=1000/60, SLACK=STEP*0.25, _lastT=null, _acc=0;   // 固定步长累加器；SLACK 吸收 vsync 抖动，避免每帧步数在 0/2 间跳变(=台阶边缘抖动)
function loop(){
  var now=(window.performance&&performance.now)?performance.now():Date.now();
  if(_lastT===null) _lastT=now;
  var dt=now-_lastT; _lastT=now;
  if(dt>250) dt=250;                      // 后台/长卡顿后单帧最多补250ms，防雪崩
  if(state==='play'){
    _acc+=dt; var steps=0;
    while(_acc>=STEP-SLACK && steps<6 && state==='play'){ update(); _acc-=STEP; steps++; }   // 容差吸收抖动→60Hz稳定每帧1步；state守卫：死亡后立即停步
    if(steps>=6) _acc=0;                  // 补不上就丢弃积压，绝不越积越多
    var sc=document.getElementById('score'); if(sc) sc.textContent=score;
  } else { _acc=0; }
  render();
  requestAnimationFrame(loop);
}

/* ---------- 音乐引擎 ---------- */
var audio=new Audio(); audio.loop=true; audio.preload='auto';
var curTrack=null, loadedTrack=null, audioUnlocked=false, muted=store.muted;
audio.volume=muted?0:0.9;
var SILENT_SRC='data:audio/wav;base64,UklGRnQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YVAAAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgA==';
// 手机端解锁：首次手势内用真·静音片段播放一下，解锁这个复用的 <audio> 元素
function unlockAudioEl(){
  if(audioUnlocked) return; audioUnlocked=true;
  try{
    audio.src=SILENT_SRC; loadedTrack=null;
    var pr=audio.play();
    var fin=function(){ if(loadedTrack===null){ try{audio.pause();}catch(e){} } };  // 已载入真实曲目则别 pause（否则会把刚播的 mp3 暂停）
    if(pr&&pr.then){ pr.then(fin).catch(fin); } else { fin(); }
  }catch(e){}
}
function loadAudio(t){
  curTrack=t.audio||null;
  if(!curTrack){ try{audio.pause();}catch(e){} }
  audio.volume=muted?0:0.9;
}
function ensureAudio(){ if(window.AudioEngine){ AudioEngine.ensure(); AudioEngine.setMuted(muted); } }
// 边下边播（流式）：设置 src 后 play()，一两秒即响、不等整首下完
function playMusic(){
  if(muted) return;
  if(curTheme && curTheme.synth){ ensureAudio(); if(window.SynthBGM) SynthBGM.start(); return; }
  if(curTrack){
    if(loadedTrack!==curTrack){ audio.src=curTrack; loadedTrack=curTrack; audio.loop=true; }
    audio.volume=0.9;
    var pr=audio.play(); if(pr&&pr.catch) pr.catch(function(){ armMusicRetry(); });
  }
}
var _musicRetryArmed=false;
function armMusicRetry(){  // 播放被浏览器拦截时，下一次用户手势内自动重试
  if(_musicRetryArmed) return; _musicRetryArmed=true;
  var h=function(){
    _musicRetryArmed=false;
    window.removeEventListener('pointerdown',h,true);
    window.removeEventListener('touchstart',h,true);
    window.removeEventListener('keydown',h,true);
    if(!muted && curTrack && curTheme && !curTheme.synth){
      var p=audio.play(); if(p&&p.catch) p.catch(function(){ armMusicRetry(); });
    }
  };
  window.addEventListener('pointerdown',h,true);
  window.addEventListener('touchstart',h,true);
  window.addEventListener('keydown',h,true);
}
function pauseMusic(){ if(window.SynthBGM) SynthBGM.stop(); try{audio.pause();}catch(e){} }
function restartMusic(){
  if(curTheme && curTheme.synth){ if(window.SynthBGM) SynthBGM.stop(); playMusic(); return; }
  // mp3：菜单试听已在播当前曲目 → 无缝带进游戏，不 pause/跳0（避免 iOS 重新缓冲/延迟、且"立刻有声"）
  if(curTrack && loadedTrack===curTrack && !audio.paused) return;
  if(window.SynthBGM) SynthBGM.stop();
  try{ audio.currentTime=0; }catch(e){}
  playMusic();
}
function pauseMusicKeep(){   // 真正暂停，保留播放进度
  if(window.SynthBGM) SynthBGM.pause();
  try{ audio.pause(); }catch(e){}
}
function resumeMusic(){      // 从暂停处续播
  if(muted) return;
  if(curTheme && curTheme.synth){ if(window.SynthBGM) SynthBGM.resume(); return; }
  if(curTrack){ var pr=audio.play(); if(pr&&pr.catch)pr.catch(function(){ armMusicRetry(); }); }
}
function sfx(n){ if(!muted && window.Sfx && Sfx[n]) Sfx[n](); }
var SPK_ON='<svg viewBox="0 0 24 24" fill="currentColor"><path d="M4 9v6h4l5 5V4L8 9H4z"/><path d="M16 8a5 5 0 010 8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
var SPK_OFF='<svg viewBox="0 0 24 24" fill="currentColor"><path d="M4 9v6h4l5 5V4L8 9H4z"/><path d="M16 9l5 6M21 9l-5 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
function refreshMute(){
  var html=muted?SPK_OFF:SPK_ON;
  var mb=$('muteBtn'); if(mb) mb.innerHTML=html;   // 仅游戏内 HUD 静音键；菜单已移除音乐开关版块（游戏里默认用音乐）
}
function toggleMute(){
  muted=!muted; store.muted=muted;
  if(window.AudioEngine)AudioEngine.setMuted(muted);
  audio.volume=muted?0:0.9;
  if(muted){ pauseMusic(); } else { playMusic(); }
  refreshMute();
}

/* ---------- 主题应用 ---------- */
function setVar(k,v){ document.documentElement.style.setProperty(k,v); }
function applyTheme(t){
  curTheme=t; THEME=t.pal||LIGHT_FALLBACK; var p=THEME; gradCache={};   // 换主题→弃用旧渐变缓存
  sceneStyle=t.scene||'grid'; platStyle=t.plat||'round'; itemStyle=t.item||'classic'; seedDecor();
  setVar('--paper',p.bg); setVar('--ink',p.ink); setVar('--sub',p.sub);
  setVar('--accent',p.accent); setVar('--accentDark',p.accentDark); setVar('--btn',p.ui||p.accent); setVar('--btnDark',p.uiDark||p.accentDark);
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
  renderHP();
}

/* ---------- 界面 ---------- */
function $(id){return document.getElementById(id);}
function show(id){
  ['menu','pause','over'].forEach(function(s){$(s).classList.toggle('hidden',s!==id);});
  $('hud').classList.toggle('hidden',id!=='play');
  if(id==='menu'){ fitMenu(); setTimeout(fitMenu,60); setTimeout(fitMenu,300); }   // 菜单显示后按需缩放，确保任何视口完整显示(失败则退回可滚动)
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
var themesPage=0;   // 主题分页: 每页8个(4列x2行); 满了不再横向滑动, 用两侧箭头切组
function buildThemes(locate){
  var c=$('themes'); if(!c) return; c.innerHTML='';
  var PER=8, total=THEMES.length, pages=Math.max(1,Math.ceil(total/PER));
  if(locate){ var ai=0; for(var k=0;k<total;k++){ if(THEMES[k].id===store.theme){ ai=k; break; } } themesPage=Math.floor(ai/PER); }  // 打开菜单时定位到选中主题所在组
  if(themesPage>=pages) themesPage=pages-1; if(themesPage<0) themesPage=0;
  THEMES.slice(themesPage*PER, themesPage*PER+PER).forEach(function(t){
    var d=document.createElement('div');d.className='tcard'+(t.id===store.theme?' active':'');
    d.innerHTML='<img src="'+t.cover+'" alt="'+t.name+'" onerror="this.style.opacity=0"><span class="tnm">'+t.name+'</span>';
    d.onclick=function(){ ensureAudio(); store.theme=t.id; applyTheme(t); buildThemes(false); playMusic(); };  // 选歌后停在当前组
    c.appendChild(d);
  });
  var prev=$('themesPrev'), next=$('themesNext');
  if(prev&&next){ var multi=pages>1;
    prev.classList.toggle('thidden',!multi); next.classList.toggle('thidden',!multi);   // 只有一组就隐藏箭头
    prev.disabled=(themesPage<=0); next.disabled=(themesPage>=pages-1);
  }
  fitMenu();   // 网格行数变化后重新自适应缩放
}
if($('themesPrev')) $('themesPrev').onclick=function(){ if(themesPage>0){ themesPage--; buildThemes(false); } };
if($('themesNext')) $('themesNext').onclick=function(){ var pg=Math.ceil(THEMES.length/8); if(themesPage<pg-1){ themesPage++; buildThemes(false); } };

/* ---------- 流程 ---------- */
function startGame(){ ensureAudio(); unlockAudioEl(); reset(); state='play'; show('play'); restartMusic(); guideOn=isTouch&&(store.best<GUIDE_BEST); maybeStartDemo(); }  // 已移除 enableTilt：陀螺仪会让毛球无操作时自己乱跑
var _phT;
function maybeStartDemo(){   // 首次进游戏的手机玩家：叠加幽灵手指手势演示(替代旧文字提示)
  if(store.played || !isTouch) return;
  demoOn=true; clearTimeout(_phT); _phT=setTimeout(dismissDemo,9000);
}
function dismissDemo(){ demoOn=false; store.played=true; clearTimeout(_phT); }
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
  var rc=$('resultChar'); if(rc)rc.src='assets/char_'+store.skin+'.png?v=2';
  show('over');
  countUp($('finalScore'),score,650);
}
$('startBtn').onclick=startGame;
$('retryBtn').onclick=startGame;
$('changeBtn').onclick=function(){state='menu';buildSwatches();buildThemes(true);show('menu');};
$('quitBtn').onclick=function(){state='menu';buildSwatches();buildThemes(true);show('menu');};
$('pauseBtn').onclick=function(){if(state==='play'){state='pause';show('pause');pauseMusicKeep();}};
$('resumeBtn').onclick=function(){if(state==='pause'){state='play';show('play');resumeMusic();}};
$('muteBtn').onclick=toggleMute;

/* ---------- 分享 ---------- */
/* 分享网址：部署后自动取当前网址；本地 file:// 测试时用占位地址。
   上线拿到正式网址后，可在 index.html 里加一行 <script>window.GAME_URL='https://你的网址/';</script> 覆盖。 */
var SHARE_URL = (window.GAME_URL) ? window.GAME_URL
  : (location.protocol.indexOf('http')===0 ? (location.origin+location.pathname) : 'https://tongjump.pages.dev/');
function shareText(){ var v=score||store.best||0; return '我在《毛球向上跳》跳到了 '+v+' 的高度，来挑战我！'; }
function toast(msg){ var t=$('toast'); if(!t)return; t.textContent=msg; t.classList.add('show'); clearTimeout(toast._t); toast._t=setTimeout(function(){t.classList.remove('show');},1800); }
function openShareModal(){
  $('shareUrl').value=SHARE_URL;
  $('share').classList.remove('hidden');   // 已去二维码：外部 QR 接口慢，弹窗改为秒开
}
// 手机用系统分享面板（自带微信/QQ/朋友圈）；电脑用我们自己的弹窗（系统面板在电脑上排的是国外应用、复制还藏起来）
var isMobileDevice=(navigator.userAgentData&&navigator.userAgentData.mobile)||/Android|iPhone|iPad|iPod|HarmonyOS|Mobile/i.test(navigator.userAgent);
function doShare(){
  if(isMobileDevice && navigator.share){
    navigator.share({title:'毛球向上跳', text:shareText(), url:SHARE_URL}).catch(function(e){ if(e&&e.name!=='AbortError') openShareModal(); });
  } else openShareModal();
}
function copyShareLink(tip){
  var txt=shareText()+' '+SHARE_URL, msg=tip||'已复制链接，去粘贴给好友吧～';
  if(navigator.clipboard&&navigator.clipboard.writeText){ navigator.clipboard.writeText(txt).then(function(){toast(msg);},function(){fallbackCopy(txt);}); }
  else fallbackCopy(txt);
}
var SHARE_APP_TIP={
  wechat:'已复制链接！打开微信，粘贴给好友或发朋友圈～',
  qq:'已复制链接！打开 QQ，粘贴发给好友～',
  moments:'已复制链接！打开微信 → 发现 → 朋友圈，粘贴发布～',
  red:'已复制链接！打开小红书，粘贴分享～'
};
function fallbackCopy(txt){ var i=$('shareUrl'); var old=i.value; i.value=txt; i.focus(); i.select();
  try{ document.execCommand('copy'); toast('已复制，去粘贴给好友'); }catch(e){ toast('请长按链接手动复制'); } i.value=old; }
$('shareBtn').onclick=doShare;
$('shareCloseBtn').onclick=function(){ $('share').classList.add('hidden'); };
$('copyLinkBtn').onclick=function(){ copyShareLink(); };
[].forEach.call(document.querySelectorAll('.shareapp'),function(b){
  b.onclick=function(){ copyShareLink(SHARE_APP_TIP[b.getAttribute('data-app')]); };
});

$('pauseUrl').value=SHARE_URL;
$('pauseUrl').onclick=function(){ this.focus(); this.select(); };
$('pauseShareBtn').onclick=doShare;
$('pauseCopyBtn').onclick=function(){ var txt=shareText()+' '+SHARE_URL; if(navigator.clipboard&&navigator.clipboard.writeText){ navigator.clipboard.writeText(txt).then(function(){toast('已复制，去粘贴给好友');},function(){fallbackCopy(txt);}); } else fallbackCopy(txt); };
var isTouch=('ontouchstart'in window)||navigator.maxTouchPoints>0;
$('ctrlHint').innerHTML=
  '<div class="ht"><span class="tag">电脑</span><span class="tx">方向键 或 <b>A / D</b> 控制左右</span></div>'+
  '<div class="ht"><span class="tag">手机</span><span class="tx">按住屏幕左右滑动转向，滑得越远移动越快、轻滑微调，松手减速</span></div>'+
  '<div class="ht"><span class="tag">小技巧</span><span class="tx">毛球会<b>自动往上跳</b>；趁TA<b>弹跳那一下</b>赶紧拨方向，这会儿TA最乖</span></div>';

/* ---------- 初始化 ---------- */
function findTheme(id){for(var i=0;i<THEMES.length;i++)if(THEMES[i].id===id)return THEMES[i];return THEMES[0];}
buildSwatches();
store.theme = window.DEFAULT_THEME || (THEMES[0]&&THEMES[0].id);  // 每次打开默认定位经典（第一个）
buildThemes(true);
refreshMute();
if(THEMES.length){ applyTheme(findTheme(store.theme)); }
show('menu');
loop();
function revealApp(){ try{document.body.classList.remove('boot');}catch(e){} }
function revealWhenImagesReady(){   // 等菜单图片(毛球+封面)加载完再显示，避免进菜单时图片一点点加载
  var imgs=[].slice.call(document.querySelectorAll('#menu img'));
  var pending=imgs.filter(function(im){ return im && !im.complete; });
  if(!pending.length){ revealApp(); return; }
  var left=pending.length, shown=false;
  function reveal(){ if(shown) return; shown=true; revealApp(); }
  function done(){ if(--left<=0) reveal(); }
  pending.forEach(function(im){ im.addEventListener('load',done); im.addEventListener('error',done); });
  setTimeout(reveal, 2500);  // 慢网封顶，不会卡死
}
revealApp();  // 菜单立即显示（图已压小、会很快补齐）；不再等所有图片就绪，避免 iOS 上菜单被卡住不显示
// 首次交互即自动开启当前主题音乐（浏览器禁止无交互自动播放，这是最早可行时机）
function primeAudioOnce(){
  window.removeEventListener('pointerdown',primeAudioOnce,true);
  window.removeEventListener('touchstart',primeAudioOnce,true);
  window.removeEventListener('keydown',primeAudioOnce,true);
  ensureAudio();
  unlockAudioEl();
  if(!muted) playMusic();  // 首次交互即播放当前(默认经典)主题音乐；点封面会切换为对应歌曲
}
window.addEventListener('pointerdown',primeAudioOnce,true);
window.addEventListener('touchstart',primeAudioOnce,true);
window.addEventListener('keydown',primeAudioOnce,true);

// 鼠标光标：静止 1.5 秒自动隐藏、移动时再现；游戏进行中始终隐藏（本游戏不用鼠标）
var _curTimer;
function pokeCursor(){
  document.body.classList.remove('nocursor');
  clearTimeout(_curTimer);
  _curTimer=setTimeout(function(){ document.body.classList.add('nocursor'); },1500);
}
window.addEventListener('mousemove',pokeCursor);
window.addEventListener('mousedown',pokeCursor);
_curTimer=setTimeout(function(){ document.body.classList.add('nocursor'); },1500);
if('serviceWorker' in navigator && location.protocol.indexOf('http')===0){
  window.addEventListener('load',function(){
    navigator.serviceWorker.register('sw.js').then(function(reg){ reg.update(); }).catch(function(){});
    // 不再强制刷新页面：外壳已“网络优先”(每次打开即取最新)，新 SW 静默接管即可。
    // 旧的 controllerchange→reload 会在新版本接管时刷新一次、可能正好打断用户操作(点封面时“闪一下重载”就是它)，已移除。
  });
}
})();
