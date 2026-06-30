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
  set played(v){try{localStorage.setItem('mq_played',v?'1':'0')}catch(e){}},
  get coins(){try{return +localStorage.getItem('mq_coins')||0}catch(e){return 0}},
  set coins(v){try{localStorage.setItem('mq_coins',''+Math.max(0,v|0))}catch(e){}},
  get invRevive(){try{return +localStorage.getItem('mq_inv_revive')||0}catch(e){return 0}},
  set invRevive(v){try{localStorage.setItem('mq_inv_revive',''+Math.max(0,v|0))}catch(e){}},
  get invFrenzyH(){try{return +localStorage.getItem('mq_inv_frenzy_h')||0}catch(e){return 0}},
  set invFrenzyH(v){try{localStorage.setItem('mq_inv_frenzy_h',''+Math.max(0,v|0))}catch(e){}},
  get unlocked(){try{var s=localStorage.getItem('mq_unlocked');return s?s.split(','):['classic'];}catch(e){return ['classic'];}},
  set unlocked(a){try{localStorage.setItem('mq_unlocked',a.join(','))}catch(e){}},
  isUnlocked:function(id){return id==='classic'||this.unlocked.indexOf(id)>=0;},
  unlock:function(id){if(this.isUnlocked(id))return false;var a=this.unlocked;a.push(id);this.unlocked=a;return true;}
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
  fitNow();      // 视口变化(微信工具栏伸缩等)后重新适配菜单/商店
}
window.addEventListener('resize',layout); window.addEventListener('load',function(){fitNow();}); layout();
function fitScreen(id,sel){ try{ var sc=document.getElementById(id); if(!sc||sc.classList.contains('hidden'))return; var inner=sc.querySelector(sel); if(!inner)return; inner.style.transform='none'; var cs=getComputedStyle(sc), pad=(parseFloat(cs.paddingTop)||0)+(parseFloat(cs.paddingBottom)||0); var avail=sc.clientHeight-pad, need=inner.offsetHeight; var k=(need>avail&&avail>0)?(avail-4)/need:1; inner.style.transform=(k<0.999)?'scale('+k.toFixed(4)+')':'none'; }catch(e){} }
function fitMenu(){ fitScreen('menu','.m-inner'); }
function fitShop(){ fitScreen('shop','.shop-inner'); }
function fitNow(){ fitMenu(); fitShop(); }
/* 菜单自适应(硬保证完整不裁不滚): 容器/内容尺寸变化、手机地址栏伸缩(visualViewport)都立刻重新缩放 */
try{
  if(window.ResizeObserver){ var _ro=new ResizeObserver(function(){ fitNow(); });
    var _mEl=document.getElementById('menu'); if(_mEl){ _ro.observe(_mEl); var _iEl=_mEl.querySelector('.m-inner'); if(_iEl)_ro.observe(_iEl); }
    var _sEl=document.getElementById('shop'); if(_sEl){ _ro.observe(_sEl); var _siEl=_sEl.querySelector('.shop-inner'); if(_siEl)_ro.observe(_siEl); } }
  if(window.visualViewport){ window.visualViewport.addEventListener('resize',fitNow); window.visualViewport.addEventListener('scroll',fitNow); }
}catch(e){}
setTimeout(function(){ try{document.body.classList.remove('boot');}catch(e){} },4000);  // 初始化异常的最终兜底

/* ---------- 状态 ---------- */
var GRAV=0.32, JUMP=-11.6, SPRING_JUMP=-19, MOVE=0.9, MAXVX=7.2, FRICT=0.86;
var MIN_DX=80, MAX_DX=160;   // 相邻台阶横向中心距区间: 下限防竖列扎堆, 上限防"最左↔最右"够不到的死局
var JUMP_REACH=210, CORRIDOR=58;   // 普通跳可达高度~210; 新台阶不与"跳跃可达范围内的下方台阶"竖直共线(走廊半宽64) → 杜绝"不操作直上连跳"
var BREAK_REACH=185;   // 易碎台阶上方台阶必须能从其下方台阶直接跳到(跳过易碎)，防"易碎碎掉→双倍间隙→跳不上去被迫送命"
var state='menu';
var player=null, platforms=[], items=[], score=0, scrolled=0, currentSkin='brown', frame=0;
var maxHP=3, hp=3, lastItemType=null, sinceItem=99, heartHold=0;   // heartHold: 扣血后红心冷却(按生成台阶数倒计)
var coins=[], runCoins=0, coinHold=0, COIN_P0=0.30, COIN_P1=0.85, COIN_RAMP=2600, COIN_GAP=0, COIN_GOLD_SCORE=2000;
var jackpotThisRun=false, jackpotPlaced=false, JACKPOT_SCORE=400;   // 金币大礼包: 本局是否给/是否已放/最早出现分数
var frenzy=0, frenzyType=null, frenzyJetRefreshUsed=false, reviveUsed=false, frenzyGuaranteed=false;   // 狂暴剩余帧/类型(h|c)/本次高度狂暴是否已用喷气续时/本局已复活/本局保证球已生成
// 金币出现概率随分数线性升高(低分稀疏~18%、≥COIN_RAMP 约62%); COIN_GAP=至少隔1块台阶(不连续扎堆); 高分段(>=COIN_GOLD_SCORE)金币 val2
var lastPlatX=200;    // 上一块台阶中心 x(防竖列)
var HAZ_ARM=600, HAZ_WARN=90, HAZ_CLAMP=55, HAZ_WARN_DIST=200;   // 齿轮: 激活分(400→600) / 预警帧 / 落后封顶(调小→更常压迫) / 触发预警的逼近距离
var HAZ_V0=0.45, HAZ_VMAX=1.3, HAZ_VK=0.0005;   // 齿轮上升速度(手机反馈偏快→整体调慢约15%): 起始 / 封顶 / 每分加速量
var hazardOn=false, hazardY=800, hazardWarn=0, hazardArmed=false, hazardWarnArmed=false;
var tiltX=0, keyDir=0, touchActive=false, touchAxis=0, touchStartX=0, particles=[];
var touchBaseGX=0, touchBaseGY=0, touchCurGX=0, touchCurGY=0, demoOn=false, guideOn=false, GUIDE_BEST=200;   // 可见反馈: 最高分<GUIDE_BEST(新手期)才显示

function randGap(){ var d=Math.min(scrolled/9000,1); return Math.min(165, 62+d*30+Math.random()*(46+d*20)); }   // 封顶拉距：62-108 → ~92-158，硬封165(<JUMP可达~210)
function pickX(w,ny){         // 横距落在 [MIN_DX,MAX_DX](可达且不竖列); 避开"跳跃可达范围内下方台阶"的竖直走廊(防不操作直上)
  var half=w/2, lo=half, hi=GW-half, segs=[];
  var rA=Math.max(lo,lastPlatX+MIN_DX), rB=Math.min(hi,lastPlatX+MAX_DX); if(rB>=rA) segs.push([rA,rB]);  // 右侧可行段(中心)
  var lA=Math.max(lo,lastPlatX-MAX_DX), lB=Math.min(hi,lastPlatX-MIN_DX); if(lB>=lA) segs.push([lA,lB]);  // 左侧可行段(中心)
  if(!segs.length){ return Math.max(lo,Math.min(hi, lastPlatX<GW/2? lastPlatX+MIN_DX : lastPlatX-MIN_DX))-half; }   // 极端兜底
  var fc=[];   // 禁区中心: 跳跃可达范围内每个下方台阶中心
  if(ny!=null){ for(var i=platforms.length-1,n=0;i>=0&&n<6;i--,n++){ var p=platforms[i], dy=p.y-ny;
    if(dy>0 && dy<=JUMP_REACH) fc.push(p.x+p.w*0.5); } }
  var valid=[];  // 可行段减去各禁区 [fc±CORRIDOR]
  for(var s=0;s<segs.length;s++){ var parts=[[segs[s][0],segs[s][1]]];
    for(var f=0;f<fc.length;f++){ var fa=fc[f]-CORRIDOR, fb=fc[f]+CORRIDOR, nxt=[];
      for(var q=0;q<parts.length;q++){ var a=parts[q][0],b=parts[q][1];
        if(fb<=a||fa>=b){ nxt.push([a,b]); } else { if(fa>a)nxt.push([a,fa]); if(fb<b)nxt.push([fb,b]); } }
      parts=nxt; }
    for(var q2=0;q2<parts.length;q2++){ if(parts[q2][1]-parts[q2][0]>=2) valid.push(parts[q2]); } }
  var c;
  if(valid.length){ var tot=0,j; for(j=0;j<valid.length;j++) tot+=valid[j][1]-valid[j][0];
    var r=Math.random()*tot; c=valid[0][0];
    for(j=0;j<valid.length;j++){ var L=valid[j][1]-valid[j][0]; if(r<=L){ c=valid[j][0]+r; break; } r-=L; } }
  else { var best=segs[0][0], bd=-1;   // 无净段(边缘几何受限): 取离所有禁区中心最远的段端点, 尽量不共线
    for(var s3=0;s3<segs.length;s3++){ for(var e=0;e<2;e++){ var cand=segs[s3][e], md=9999;
      for(var k=0;k<fc.length;k++) md=Math.min(md,Math.abs(cand-fc[k]));
      if(md>bd){ bd=md; best=cand; } } } c=best; }
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
  var x=pickX(w,y);   // pickX 已避开跳跃可达范围内下方台阶的竖直走廊
  lastPlatX=x+w/2;
  var p={x:x,y:y,w:w,type:type,vx:vx,broken:false,spring:false};
  if(type!=='breakable' && Math.random()<0.10){ var ps=playItems(); if(!ps.spring && !ps.jet) p.spring=true; }   // 屏上已有弹簧或喷气→不加弹簧(弹簧与喷气不共存)
  return p;
}
function reset(){
  currentSkin=store.skin;
  player={x:GW/2-22, y:GH-160, w:44, h:48, vx:0, vy:JUMP, face:1, squash:0, jet:0, shield:false, magOn:false, magTarget:null, magArm:0, inv:0};
  platforms=[]; items=[]; particles=[]; coins=[]; runCoins=0; coinHold=0; score=0; scrolled=0; frame=0; lastItemType=null; sinceItem=99; heartHold=0; jackpotThisRun=MQLogic.jackpotRoll(Math.random(),MQLogic.JACKPOT_P); jackpotPlaced=false; frenzy=0; frenzyType=null; frenzyJetRefreshUsed=false; reviveUsed=false; frenzyGuaranteed=false;
  platforms.push({x:GW/2-40,y:GH-90,w:80,type:'normal',vx:0,broken:false,spring:false});
  lastPlatX=GW/2;
  var y=GH-90, lastP=platforms[0], prevP=null;
  for(var i=0;i<14;i++){ y-=randGap();
    if(lastP&&lastP.type==='breakable'&&prevP){ var minY=prevP.y-BREAK_REACH; if(y<minY)y=minY; }
    var np=makePlatform(y); platforms.push(np); prevP=lastP; lastP=np; }
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
  if(frenzy>0 && frenzyType==='h'){ if(player.vy>-10.5)player.vy=-10.5; if(frame%3===0)spawnPuff(); }         // 狂暴·高度优先于喷气(更强更久, 同为上冲); 此时不消耗 jet→残余喷气待狂暴结束后再补放, 零浪费
  else if(player.jet>0){ player.jet--; player.vy=-9.5; if(frame%3===0)spawnPuff(); }
  else player.vy+=GRAV;                                                                                       // 金币狂暴/无狂暴: 正常重力(修复浮空 bug)
  if(frenzy>0){ frenzy--; if(frenzy<=0){ frenzyType=null; frenzyJetRefreshUsed=false; } }   // 狂暴计时: 高度/金币两类都倒数, 与重力解耦
  player.y+=player.vy;
  if(player.squash>0)player.squash*=0.8;
  platforms.forEach(function(p){
    if(p.type==='moving'){ p.x+=p.vx; if(p.x<0){p.x=0;p.vx*=-1;} if(p.x>GW-p.w){p.x=GW-p.w;p.vx*=-1;} }
  });
  if(player.vy>0){
    for(var i=0;i<platforms.length;i++){
      var p=platforms[i];
      if(p.broken)continue;
      if(hazardOn && hazardY<GH && p.y>hazardY)continue;   // 齿轮区内的台阶不可落脚→坠入齿轮被正常判定(修"齿轮边缘被台阶弹起却不扣血")
      var px=player.x+player.w/2, feet=player.y+player.h, prevFeet=feet-player.vy;   // 扫掠检测: 用上一步脚底, 防高速下坠(如弹簧落回)一帧穿过薄台阶
      if(px>p.x-4 && px<p.x+p.w+4 && prevFeet<=p.y && feet>=p.y){
        player.y=p.y-player.h;   // 吸附到台面, 杜绝穿台/陷入
        if(p.type==='breakable'){ player.vy=JUMP; player.squash=1; p.broken=true; spawnBreak(p); sfx('brk'); }
        else if(p.spring){ player.vy=SPRING_JUMP; player.squash=1; bounceFx(p); sfx('spring'); }
        else { player.vy=JUMP; player.squash=1; bounceFx(p); sfx('jump'); }
        break;
      }
    }
  }
  if(frenzy>0 && frenzyType==='c') pullCoinsToPlayer(0);   // 金币狂暴: 全屏吸附
  else if(player.magOn) pullCoinsToPlayer(140);            // 磁铁: 抓到首个道具前顺手吸金币
  collectItems(); collectCoins();
  var line=GH*0.42;
  if(player.y<line){
    var dy=line-player.y; player.y=line; scrolled+=dy;
    platforms.forEach(function(p){p.y+=dy;});
    items.forEach(function(it){it.y+=dy;}); coins.forEach(function(c){c.y+=dy;});
    particles.forEach(function(pt){pt.y+=dy;});
    if(hazardOn) hazardY+=dy;   // 世界滚动同步下压齿轮(弹性追赶核心: 爬得快→齿轮落后)
    score=Math.floor(scrolled/10);
  }
  platforms.forEach(function(p){ if(p.broken){p.fade=(p.fade||0)+0.05; p.y+=4;} });
  platforms=platforms.filter(function(p){return p.y<GH+30 && !(p.broken&&p.fade>1);});
  var ys=platforms.map(function(p){return p.y;}); ys.push(GH);
  var topY=Math.min.apply(null,ys);
  var sortTop=platforms.filter(function(p){return !p.broken;}).sort(function(a,b){return a.y-b.y;});
  var lastP=sortTop[0]||null, prevP=sortTop[1]||null;
  while(topY>-20){
    topY-=randGap();
    if(lastP&&lastP.type==='breakable'&&prevP){ var minY=prevP.y-BREAK_REACH; if(topY<minY)topY=minY; }
    var np=makePlatform(topY); platforms.push(np);
    spawnItemMaybe(np); spawnCoinsMaybe(np);
    prevP=lastP; lastP=np;
  }
  items=items.filter(function(it){return it.y<GH+40 && !it.taken;});
  coins=coins.filter(function(c){return c.y<GH+40 && !c.taken;});
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
  hp--; heartHold=14; renderHP(); sfx('brk');   // 扣血→红心冷却14块台阶, 不立刻刷回血
  if(hp<=0){
    if(MQLogic.shouldRevive(store.invRevive,reviveUsed)){ reviveUsed=true; store.invRevive=store.invRevive-1; hp=maxHP; renderHP(); respawn(); }   // 付费复活: 回满血续命一次
    else { gameOver(); }
  } else { respawn(); }
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
  var pl=Math.min(player.x,player.x-player.vx), pr=Math.max(player.x+player.w,player.x-player.vx+player.w), pt=Math.min(player.y,player.y-player.vy), pb=Math.max(player.y+player.h,player.y-player.vy+player.h);   // 扫掠拾取:覆盖本帧位移路径,防高速一帧穿过道具
  for(var i=0;i<items.length;i++){ var it=items[i]; if(it.taken)continue;
    if((it.type==='heart'&&hp>=maxHP)||(it.type==='shield'&&player.shield)){ it.taken=true; continue; }  // 满血红心/已有护盾的盾：作废，不显示不拾取
    if(it.type==='jet' && frenzy>0 && frenzyType==='h' && frenzyJetRefreshUsed){ it.taken=true; continue; }  // 本次高度狂暴已用过喷气续时→屏内残余喷气作废, 不让玩家看到/误吃第二个
    if(pl<it.x+it.w && pr>it.x && pt<it.y+it.h && pb>it.y){
      it.taken=true; player.squash=1;
      if(it.type==='jet'){ if(MQLogic.jetRefreshesFrenzy(frenzy,frenzyType,frenzyJetRefreshUsed)){ frenzy=MQLogic.FRENZY_DUR; frenzyJetRefreshUsed=true; clearVisibleJets(); } else player.jet=70; sfx('item'); }   // 每次高度狂暴只允许第一个喷气刷新时长; 刷新后清掉屏内喷气并停止继续生成
      else if(it.type==='heart'){ hp=Math.min(maxHP,hp+1); renderHP(); sfx('item'); }
      else if(it.type==='shield'){ player.shield=true; sfx('item'); }
      else if(it.type==='magnet'){ player.magOn=true; player.magTarget=null; player.magArm=600; sfx('item'); }
      else if(it.type==='frenzy_h'||it.type==='frenzy_c'){ var fr=MQLogic.frenzyOnPickup(it.type==='frenzy_h'?'h':'c',MQLogic.FRENZY_DUR); frenzy=fr.frames; frenzyType=fr.type; frenzyJetRefreshUsed=false; if(it.guaranteed&&store.invFrenzyH>0)store.invFrenzyH=store.invFrenzyH-1; sfx('item'); }   // 异类也接管(切类型+满时长), 故付费保证球必生效→扣库存合理, 不再白耗; 新高度狂暴重新允许一次喷气续时
    }
  }
}
function clearVisibleJets(){
  for(var i=0;i<items.length;i++){ if(items[i].type==='jet' && !items[i].taken) items[i].taken=true; }
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
function pullCoinsToPlayer(maxDist){   // 把金币吸向毛球(maxDist<=0=全屏); 收集仍由 collectCoins 完成
  var px=player.x+player.w/2, py=player.y+player.h/2;
  for(var i=0;i<coins.length;i++){ var c=coins[i]; if(c.taken) continue;
    var dx=px-c.x, dy=py-c.y, d=Math.sqrt(dx*dx+dy*dy);
    if(maxDist>0 && d>maxDist) continue;
    if(d>1){ var f=Math.min(10,Math.max(3,d*0.25)); c.x+=dx/d*f; c.y+=dy/d*f; }
  }
}
function spawnCoinsMaybe(np){
  if(jackpotThisRun && !jackpotPlaced && score>=JACKPOT_SCORE && !np.spring && !np.hasItem){   // 金币大礼包: 整局至多1个
    var jx=Math.max(14,Math.min(GW-14,np.x+np.w/2));
    coins.push({x:jx,y:np.y-24,r:10,gold:true,val:MQLogic.JACKPOT_VAL,jackpot:true,taken:false});
    jackpotPlaced=true; return;
  }
  if(np.spring || np.hasItem) return;         // 弹簧台阶/已放道具的台阶不放币(避免与道具叠加)
  if(coinHold>0){ coinHold--; return; }       // 距上一枚至少隔 COIN_GAP 块台阶 → 不连续扎堆
  if(Math.random()>=MQLogic.coinSpawnChance(score,COIN_P0,COIN_P1,COIN_RAMP)) return;       // 概率随分数升高: 低分稀疏、越高越频繁
  var gold=MQLogic.coinValue(score,COIN_GOLD_SCORE)>1;            // 高分段=金币 val2
  var x=Math.max(10,Math.min(GW-10,np.x+np.w/2)), y=np.y-22;   // 居中悬在台阶上方一点, 沿跳跃路径自然收集
  coins.push({x:x,y:y,r:7,gold:gold,val:gold?2:1,taken:false});
  coinHold=COIN_GAP;
}
function collectCoins(){
  var pl=Math.min(player.x,player.x-player.vx), pr=Math.max(player.x+player.w,player.x-player.vx+player.w), pt=Math.min(player.y,player.y-player.vy), pb=Math.max(player.y+player.h,player.y-player.vy+player.h);   // 扫掠拾取:同上,防高速穿过金币
  for(var i=0;i<coins.length;i++){ var c=coins[i]; if(c.taken) continue;
    if(pl<c.x+c.r && pr>c.x-c.r && pt<c.y+c.r && pb>c.y-c.r){ c.taken=true; runCoins+=MQLogic.effectiveCoinVal(c.val,frenzy,frenzyType); sfx('item'); spawnCoinSpark(c); } }
}
function spawnCoinSpark(c){ for(var i=0;i<5;i++) particles.push({x:c.x,y:c.y,vx:(Math.random()-.5)*2.4,vy:-Math.random()*2-0.5,life:16,c:'#ffcf5b',r:1.5+Math.random()*1.5}); }
function playItems(){   // 当前在屏(及刚生成、未拾取)的道具类型 + 是否已有弹簧/喷气 —— 用于"弹簧⇄喷气不共存、同屏不重复"
  var st={types:{}, spring:false, jet:false};
  for(var i=0;i<items.length;i++){ var it=items[i]; if(it.taken||it.y>=GH) continue; st.types[it.type]=true; if(it.type==='jet') st.jet=true; }
  for(var j=0;j<platforms.length;j++){ var p=platforms[j]; if(p.spring && !p.broken && p.y<GH) st.spring=true; }
  return st;
}
function spawnItemMaybe(np){
  sinceItem++;
  if(heartHold>0) heartHold--;            // 扣血后红心冷却(按生成台阶数倒计, 爬一段才允许回血)
  if(np.type==='moving') return;           // 道具不放移动台阶: 台阶横移会把道具甩到空中→够不到还掉血(只放稳定台阶上方)
  if(store.invFrenzyH>0 && !frenzyGuaranteed && score>=120 && !np.spring && !np.hasItem){   // 购买保证: 本局必出1个高度球
    items.push({x:Math.max(2,Math.min(GW-24,np.x+np.w/2-11)),y:np.y-28,w:22,h:22,type:'frenzy_h',guaranteed:true,taken:false});
    np.hasItem=true; frenzyGuaranteed=true; return;   // 被拾取时在 collectItems 扣库存; 没吃到则保留下一局再保证
  }
  if(np.spring) return;                   // 该台阶已长弹簧 → 不再叠加道具（修复"一个台阶两种道具"）
  if(sinceItem<4) return;                 // 两道具至少隔 4 块平台，避免同屏扎堆
  if(Math.random()>0.34) return;          // 满足间隔后再按概率出
  var ps=playItems();
  var pool=[];                            // 加权候选
  if(hp<maxHP && heartHold<=0) pool.push(['heart', 38+Math.min(30, score*0.02)]);          // 满血不出；扣血冷却期内也不出。回血心权重随分数升高(高分难度大→回血更常见): 低分≈38, 每百分+2, ~1500分封顶≈68
  if(!ps.spring && !(frenzy>0 && frenzyType==='h' && frenzyJetRefreshUsed)) pool.push(['jet',30]);  // 高度狂暴已用喷气续时后, 本次效果结束前不再刷喷气
  if(!(player&&player.shield)) pool.push(['shield',18]); pool.push(['magnet',16]);  // 已有护盾时不再刷护盾
  if(frenzy<=0){ pool.push(['frenzy_h',2]); pool.push(['frenzy_c',3]); }   // 狂暴免费随机掉落(稀有); 生效中不再刷
  pool=pool.filter(function(p){return p[0]!==lastItemType && !ps.types[p[0]];});  // 不连续同种 + 同屏不重复
  if(!pool.length) return;                // 候选被排空则本次不生成（保险）
  var tot=0,i; for(i=0;i<pool.length;i++) tot+=pool[i][1];
  var r=Math.random()*tot, type=pool[pool.length-1][0];
  for(i=0;i<pool.length;i++){ r-=pool[i][1]; if(r<=0){ type=pool[i][0]; break; } }
  lastItemType=type; sinceItem=0;
  var w=(type==='jet')?20:22, h=(type==='jet')?24:22;
  var x=Math.max(2,Math.min(GW-w-2,np.x+np.w/2-w/2));
  items.push({x:x,y:np.y-h-6,w:w,h:h,type:type,taken:false}); np.hasItem=true;
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
  } else if(sceneStyle==='meadow'){
    var mwarm=['255,246,214','255,240,205','255,250,236'], mcol=['239,140,156','120,206,186'];
    for(var mo=0;mo<26;mo++){var warm=Math.random()<0.7;bgDecor.push({kind:'mote',x:Math.random()*GW,y:Math.random()*GH,r:0.7+Math.pow(Math.random(),2.2)*4.0,sp:5+Math.random()*15,ph:Math.random()*6.28,sw:8+Math.random()*22,a:0.40+Math.random()*0.45,rgb:warm?mwarm[(Math.random()*mwarm.length)|0]:mcol[(Math.random()*mcol.length)|0]});}
    var pcol=['#f7f8ec','#fff6ef','#fff6ef','#ef6f86','#e9607b','#f2a0ad','#46b89b','#82d2c0'];
    for(var pe=0;pe<17;pe++){bgDecor.push({kind:'petal',x:Math.random()*GW,y:Math.random()*GH,sz:3.5+Math.random()*5,ph:Math.random()*6.28,rot:Math.random()*6.28,rsp:(Math.random()-0.5)*1.2,fall:7+Math.random()*15,sway:12+Math.random()*24,swsp:0.4+Math.random()*0.7,wind:5+Math.random()*9,col:pcol[(Math.random()*pcol.length)|0],a:0.5+Math.random()*0.45});}
    for(var mg=0;mg<24;mg++){bgDecor.push({kind:'grass',x:Math.random()*GW,back:Math.random()<0.5,ph:Math.random()*6.28,n:3+((Math.random()*3)|0),h:16+Math.random()*30,spread:7+Math.random()*9,seed:Math.random()<0.28,seedcol:(Math.random()<0.5?'#ef6f86':'#f7f8ec')});}
  } else if(sceneStyle==='songfeng'){
    var sfncol=['#8f8b6f','#6f6a52','#9aa07a'];
    for(var j=0;j<22;j++){bgDecor.push({kind:'needle',x:Math.random()*GW,y:Math.random()*GH,ph:Math.random()*6.28,sp:6+Math.random()*12,vsp:3+Math.random()*7,sway:10+Math.random()*22,swsp:0.4+Math.random()*0.7,ang:-0.5+Math.random()*1.0,len:3.5+Math.random()*4,lw:1.1+Math.random()*0.7,a:0.16+Math.random()*0.20,col:sfncol[(Math.random()*sfncol.length)|0]});}
    var sfdcol=['255,248,228','255,250,236','184,178,150'];
    for(var k=0;k<18;k++){bgDecor.push({kind:'dust',x:Math.random()*GW,y:Math.random()*GH,r:0.6+Math.pow(Math.random(),2.4)*2.0,ph:Math.random()*6.28,sp:5+Math.random()*13,sw:8+Math.random()*20,a:0.16+Math.random()*0.20,rgb:sfdcol[(Math.random()*sfdcol.length)|0]});}
    for(var f=0;f<46;f++){bgDecor.push({kind:'fiber',x:Math.random()*GW,y:Math.random()*GH,r:0.5+Math.random()*1.1,a:0.03+Math.random()*0.05});}
    var sfRC=[2,3,4,4];
    for(var rg=0;rg<4;rg++){ var sfpl=[],sftries=0; while(sfpl.length<sfRC[rg]&&sftries<80){ sftries++; var spx=Math.random()*GW, sok=true; for(var sq=0;sq<sfpl.length;sq++){ if(Math.abs(sfpl[sq]-spx)<GW*0.12){sok=false;break;} } if(sok){ sfpl.push(spx); bgDecor.push({kind:'sftree',ridge:rg,x:spx,szf:0.7+Math.random()*0.45,sway:Math.random()*6.28}); } } }
    for(var cl=0;cl<3;cl++){bgDecor.push({kind:'sfcloud',y:GH*(0.16+cl*0.11),x:Math.random()*GW,sp:4+Math.random()*4,sc:0.7+Math.random()*0.4,a:0.05+Math.random()*0.025,dir:(cl%2?1:-1)});}
    for(var bi=0;bi<4;bi++){bgDecor.push({kind:'sfbird',x:Math.random()*GW,y:GH*(0.10+Math.random()*0.15),s:3+Math.random()*2.2,ph:Math.random()*6.28,sp:4+Math.random()*15,fl:0.9+Math.random()*0.8,dir:(Math.random()<0.5?1:-1)});}
    for(var em=0;em<8;em++){bgDecor.push({kind:'ember',x:Math.random()*GW,y:Math.random()*GH,r:0.5+Math.random()*1.1,ph:Math.random()*6.28,sp:6+Math.random()*17,sw:8+Math.random()*30});}
    for(var st=0;st<8;st++){bgDecor.push({kind:'sfstone',x:Math.random()*GW,yf:0.75+Math.random()*0.235,szj:0.7+Math.random()*0.65,sd:Math.random()*99});}
  } else if(sceneStyle==='starfield'){
    for(var ci=0;ci<8;ci++){ var big=Math.random()<0.5; bgDecor.push({kind:'circle',x:Math.random()*GW,y:Math.random()*GH,r:(big?70:30)+Math.random()*(big?70:40),a:0.03+Math.random()*0.06,ring:Math.random()<0.35,ph:Math.random()*6.28}); }
    var flfc=['#f3a895','#ef8a78','#f6b9a6','#f3826b'];
    for(var fa=0;fa<76;fa++){ var fx,fy; if(Math.random()<0.52){ var ft=Math.random(); fx=GW*0.12+ft*GW*0.82+(Math.random()*70-35); fy=GH*0.08+ft*GH*0.86+(Math.random()*40-20); } else { fx=Math.random()*GW; fy=Math.random()*GH; }
      bgDecor.push({kind:'star',layer:0,x:fx,y:fy,r:0.5+Math.random()*0.75,a:0.12+Math.random()*0.18,tw:0.8+Math.random()*1.4,ph:Math.random()*6.28,amp:1.5+Math.random()*2,dx:0.10+Math.random()*0.1,dy:0.08+Math.random()*0.08,col:flfc[(Math.random()*flfc.length)|0]}); }
    for(var fm=0;fm<32;fm++){ bgDecor.push({kind:'star',layer:1,mid:true,x:Math.random()*GW,y:Math.random()*GH,r:1.2+Math.random()*1.0,a:0.26+Math.random()*0.30,tw:0.5+Math.random()*0.9,ph:Math.random()*6.28,amp:2.5+Math.random()*3,dx:0.14+Math.random()*0.1,dy:0.10+Math.random()*0.1,col:flfc[(Math.random()*flfc.length)|0],boff:[0.25,0.5,0.75][fm%3]}); }
    var flhc=['#ef5a4a','#cf3d33','#ffcf5b','#ef5a4a','#f3826b'];
    for(var fn=0;fn<8;fn++){ bgDecor.push({kind:'star',layer:2,glint:true,x:GW*(0.1+0.8*Math.random()),y:GH*(0.08+0.84*Math.random()),r:2.4+Math.random()*1.5,a:0.6+Math.random()*0.3,tw:0.35+Math.random()*0.5,ph:Math.random()*6.28,amp:3+Math.random()*4,dx:0.18+Math.random()*0.12,dy:0.13+Math.random()*0.1,col:flhc[fn%flhc.length],boff:[0,0.25,0.5,0.75][fn%4]}); }
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
function sfPine(x,baseY,h,sway,col){ var w=h*0.46; ctx.fillStyle=col; ctx.save(); ctx.translate(x,baseY);
  ctx.fillRect(-h*0.02,-h*0.18,h*0.04,h*0.18);
  for(var t=0;t<3;t++){ var ty=-h*0.16-t*h*0.27, tw=w*(1-t*0.24), th=h*0.42; ctx.beginPath(); ctx.moveTo(0,ty-th); ctx.lineTo(tw*0.5+sway*(t+1),ty); ctx.lineTo(-tw*0.5+sway*(t+1)*0.4,ty); ctx.closePath(); ctx.fill(); } ctx.restore(); }
function sfRidge(key,crestY,fade,rgb,alpha,seed,amp,strokeA){ var N=110,pts=[],i;
  for(i=0;i<=N;i++){ var t=i/N, h=amp*(0.46*Math.sin(t*2.7+seed)+0.26*Math.sin(t*5.9+seed*1.6+1.1)+0.16*Math.sin(t*11.3+seed*0.8+2.3)+0.09*Math.sin(t*19.7+seed*2.2)); pts.push([t*GW,crestY-h]); }
  var g=cgrad(key,function(){ var gg=ctx.createLinearGradient(0,crestY-amp,0,crestY+fade); gg.addColorStop(0,'rgba('+rgb+','+alpha+')'); gg.addColorStop(1,'rgba('+rgb+',0)'); return gg;});
  ctx.fillStyle=g; ctx.beginPath(); ctx.moveTo(0,crestY+fade); for(i=0;i<pts.length;i++)ctx.lineTo(pts[i][0],pts[i][1]); ctx.lineTo(GW,crestY+fade); ctx.closePath(); ctx.fill();
  if(strokeA){ ctx.strokeStyle='rgba(70,76,58,'+strokeA+')'; ctx.lineWidth=1.3; ctx.beginPath(); for(i=0;i<pts.length;i++){if(i)ctx.lineTo(pts[i][0],pts[i][1]);else ctx.moveTo(pts[i][0],pts[i][1]);} ctx.stroke(); } }
function sfSpark(x,y,r,a){ var rg=ctx.createRadialGradient(x,y,r*0.3,x,y,r*4.2); rg.addColorStop(0,'rgba(234,88,38,'+(a*0.55)+')'); rg.addColorStop(0.55,'rgba(224,62,28,'+(a*0.3)+')'); rg.addColorStop(1,'rgba(214,54,24,0)'); ctx.fillStyle=rg; ctx.beginPath(); ctx.arc(x,y,r*4.2,0,6.2832); ctx.fill();
  ctx.save(); ctx.globalCompositeOperation='lighter'; var c=ctx.createRadialGradient(x,y,0,x,y,r*2.1); c.addColorStop(0,'rgba(255,250,212,'+Math.min(1,a+0.4)+')'); c.addColorStop(0.4,'rgba(255,208,92,'+a+')'); c.addColorStop(1,'rgba(255,150,50,0)'); ctx.fillStyle=c; ctx.beginPath(); ctx.arc(x,y,r*2.1,0,6.2832); ctx.fill(); ctx.restore(); }
var _sfNoise=null,_sfNW=0,_sfNH=0,_sfMoon=null;
function sfDither(){ try{ var cw=ctx.canvas.width,ch=ctx.canvas.height; if(!cw||!ch)return; if(!_sfNoise||_sfNW!==cw||_sfNH!==ch){ _sfNoise=document.createElement('canvas'); _sfNoise.width=cw; _sfNoise.height=ch; _sfNW=cw; _sfNH=ch; var nx=_sfNoise.getContext('2d'),im=nx.createImageData(cw,ch),dd=im.data; for(var i=0;i<dd.length;i+=4){var v=100+((Math.random()*56)|0); dd[i]=v;dd[i+1]=v;dd[i+2]=v;dd[i+3]=255;} nx.putImageData(im,0,0); } ctx.save(); ctx.setTransform(1,0,0,1,0,0); ctx.globalAlpha=0.4; ctx.globalCompositeOperation='overlay'; ctx.drawImage(_sfNoise,0,0); ctx.restore(); ctx.globalAlpha=1; ctx.globalCompositeOperation='source-over'; }catch(e){} }
function sfRidgeY(x,crestY,seed,amp){ var t=x/GW; return crestY-amp*(0.46*Math.sin(t*2.7+seed)+0.26*Math.sin(t*5.9+seed*1.6+1.1)+0.16*Math.sin(t*11.3+seed*0.8+2.3)+0.09*Math.sin(t*19.7+seed*2.2)); }
function sfStone(x,y,sz,a,seed){ ctx.save(); if(a!==undefined)ctx.globalAlpha=a;
  ctx.fillStyle='rgba(58,52,40,0.32)'; ctx.beginPath(); ctx.ellipse(x,y+sz*0.62,sz*1.25,sz*0.46,0,0,6.2832); ctx.fill();
  var grd=ctx.createRadialGradient(x-sz*0.34,y-sz*0.42,sz*0.15,x,y,sz*1.35); grd.addColorStop(0,'#efe9da'); grd.addColorStop(0.55,'#ddd2bd'); grd.addColorStop(1,'#c2b79c'); ctx.fillStyle=grd;
  var n=10; ctx.beginPath(); for(var i=0;i<=n;i++){var ang=i/n*6.2832,rr=sz*(0.84+0.16*Math.sin(seed*1.3+i*1.7)); var px=x+Math.cos(ang)*rr,py=y+Math.sin(ang)*rr*0.78; if(i)ctx.lineTo(px,py);else ctx.moveTo(px,py);} ctx.closePath(); ctx.fill();
  ctx.strokeStyle='rgba(104,94,72,0.26)'; ctx.lineWidth=0.7; ctx.stroke();
  ctx.fillStyle='rgba(255,253,246,0.26)'; ctx.beginPath(); ctx.ellipse(x-sz*0.3,y-sz*0.3,sz*0.3,sz*0.16,-0.3,0,6.2832); ctx.fill(); ctx.restore(); }
function drawSongfeng(){
  var Tt=nowSec();
  var paper=cgrad('sf_paper',function(){ var g=ctx.createLinearGradient(0,0,0,GH); g.addColorStop(0,'#f4efe4'); g.addColorStop(0.5,'#eee8da'); g.addColorStop(1,'#e9e1cf'); return g;});
  ctx.fillStyle=paper; ctx.fillRect(0,0,GW,GH);
  for(var fb=0;fb<bgDecor.length;fb++){ var fi=bgDecor[fb]; if(fi.kind!=='fiber') continue; ctx.globalAlpha=fi.a; ctx.fillStyle='#5a5443'; ctx.beginPath(); ctx.arc(fi.x,fi.y,fi.r,0,6.2832); ctx.fill(); } ctx.globalAlpha=1;
  var br=0.5+0.5*Math.sin(Tt*0.5), mr=GH*0.056*(1+0.05*br);
  var th=Tt*0.06, ocx=GW*0.5, ocy=GH*0.80, orx=GW*0.44, ory=GH*0.62;
  var ss=Math.sin(th), sunVis=Math.max(0,Math.min(1,ss*2.4));
  if(sunVis>0.01){ var sx=ocx+Math.cos(th)*orx, sy=ocy-ss*ory;
    var shalo=ctx.createRadialGradient(sx,sy,4,sx,sy,mr*3.4); shalo.addColorStop(0,'rgba(244,214,150,'+((0.22+0.16*br)*sunVis).toFixed(3)+')'); shalo.addColorStop(0.5,'rgba(238,196,128,'+(0.10*sunVis).toFixed(3)+')'); shalo.addColorStop(1,'rgba(238,196,128,0)'); ctx.fillStyle=shalo; ctx.fillRect(0,0,GW,GH);
    var sdisc=ctx.createRadialGradient(sx,sy,2,sx,sy,mr); sdisc.addColorStop(0,'rgba(255,249,216,'+(0.99*sunVis).toFixed(3)+')'); sdisc.addColorStop(0.84,'rgba(253,242,202,'+(0.96*sunVis).toFixed(3)+')'); sdisc.addColorStop(1,'rgba(251,234,190,0)'); ctx.fillStyle=sdisc; ctx.beginPath(); ctx.arc(sx,sy,mr,0,6.2832); ctx.fill(); }
  var mth=th+Math.PI, msi=Math.sin(mth), moonVis=Math.max(0,Math.min(1,msi*2.4));
  if(moonVis>0.01){ var mx2=ocx+Math.cos(mth)*orx, my2=ocy-msi*ory; try{
    var ms=Math.ceil(GH*0.20); if(!_sfMoon||_sfMoon.width!==ms){_sfMoon=document.createElement('canvas');_sfMoon.width=ms;_sfMoon.height=ms;}
    var mc=_sfMoon.getContext('2d'); mc.globalCompositeOperation='source-over'; mc.clearRect(0,0,ms,ms); var ccx=ms/2,ccy=ms/2;
    var mg=mc.createRadialGradient(ccx,ccy,2,ccx,ccy,mr); mg.addColorStop(0,'rgba(238,243,252,1)'); mg.addColorStop(0.86,'rgba(216,228,246,1)'); mg.addColorStop(1,'rgba(208,222,242,0)'); mc.fillStyle=mg; mc.beginPath(); mc.arc(ccx,ccy,mr,0,6.2832); mc.fill();
    var mphase=(Math.floor(th/6.2832)*0.18)%1, bd=2.05*mr*(1-2*mphase);
    mc.globalCompositeOperation='destination-out'; var bg=mc.createRadialGradient(ccx+bd,ccy,mr*0.93,ccx+bd,ccy,mr*1.1); bg.addColorStop(0,'rgba(0,0,0,1)'); bg.addColorStop(1,'rgba(0,0,0,0)'); mc.fillStyle=bg; mc.beginPath(); mc.arc(ccx+bd,ccy,mr*1.1,0,6.2832); mc.fill(); mc.globalCompositeOperation='source-over';
    ctx.save(); ctx.globalAlpha=moonVis; ctx.drawImage(_sfMoon,mx2-ccx,my2-ccy); ctx.restore(); }catch(e){} }
  for(var cl=0;cl<bgDecor.length;cl++){ var cd=bgDecor[cl]; if(cd.kind!=='sfcloud') continue; var span=GW+320, cx=(((cd.x+Tt*cd.sp*cd.dir)%span)+span)%span-160;
    for(var sg=0;sg<3;sg++){ var sx=cx+sg*150, cw2=120*cd.sc; var g=ctx.createRadialGradient(sx,cd.y,2,sx,cd.y,cw2); g.addColorStop(0,'rgba(116,124,104,'+cd.a+')'); g.addColorStop(0.6,'rgba(116,124,104,'+(cd.a*0.5)+')'); g.addColorStop(1,'rgba(116,124,104,0)'); ctx.fillStyle=g; ctx.save(); ctx.translate(sx,cd.y); ctx.scale(1,0.22); ctx.beginPath(); ctx.arc(0,0,cw2,0,6.2832); ctx.fill(); ctx.restore(); } }
  sfRidge('sf_r0',GH*0.40,GH*0.10,'178,186,172',0.16,0.5,20,0);
  sfRidge('sf_r1',GH*0.49,GH*0.14,'146,158,142',0.28,2.3,32,0.08);
  sfRidge('sf_r2',GH*0.60,GH*0.19,'100,116,98',0.52,4.1,42,0.24);
  sfRidge('sf_r3',GH*0.74,GH*0.28,'58,72,56',0.80,1.7,50,0.50);
  var haze=cgrad('sf_haze',function(){ var g=ctx.createLinearGradient(0,GH*0.40,0,GH*0.60); g.addColorStop(0,'rgba(244,239,228,0)'); g.addColorStop(0.6,'rgba(244,239,228,0.20)'); g.addColorStop(1,'rgba(244,239,228,0)'); return g;}); ctx.fillStyle=haze; ctx.fillRect(0,GH*0.38,GW,GH*0.24);
  var trees=bgDecor.filter(function(d){return d.kind==='sftree';});
  trees.sort(function(a,b){return a.ridge-b.ridge;});
  var sfRP=[[GH*0.40,0.5,20,7,'120,130,110,0.55'],[GH*0.49,2.3,32,11,'100,112,90,0.70'],[GH*0.60,4.1,42,17,'78,88,68,0.86'],[GH*0.74,1.7,50,25,'50,58,44,0.96']];
  for(var ti=0;ti<trees.length;ti++){ var trd=trees[ti], rp=sfRP[trd.ridge]; var tby=sfRidgeY(trd.x,rp[0],rp[1],rp[2])+2; sfPine(trd.x,tby,rp[3]*trd.szf,Math.sin(Tt*0.4+trd.sway)*1.0,'rgba('+rp[4]+')'); }
  var stones=bgDecor.filter(function(d){return d.kind==='sfstone';}); stones.sort(function(a,b){return a.yf-b.yf;});
  for(var si=0;si<stones.length;si++){ var stn=stones[si], szf=Math.max(0,Math.min(1,(stn.yf-0.75)/0.235)); sfStone(stn.x,GH*stn.yf,(1.8+Math.pow(szf,1.1)*6.2)*stn.szj,Math.min(1,0.6+szf*0.4),stn.sd); }
  ctx.save(); ctx.strokeStyle='#3a352c'; ctx.lineWidth=1.6; ctx.lineCap='round'; ctx.globalAlpha=0.5;
  for(var bd=0;bd<bgDecor.length;bd++){ var bb=bgDecor[bd]; if(bb.kind!=='sfbird') continue; var bspan=GW+40, bx=(((bb.x+Tt*bb.sp*bb.dir)%bspan)+bspan)%bspan-20, by=bb.y+Math.sin(Tt*0.5+bb.ph)*3, s=bb.s, dp=-s*(0.45+0.45*Math.sin(Tt*bb.fl*4+bb.ph)); ctx.beginPath(); ctx.moveTo(bx-s,by); ctx.quadraticCurveTo(bx-s*0.4,by+dp,bx,by); ctx.quadraticCurveTo(bx+s*0.4,by+dp,bx+s,by); ctx.stroke(); }
  ctx.restore(); ctx.globalAlpha=1;
  ctx.save(); ctx.lineCap='round';
  for(var n=0;n<bgDecor.length;n++){ var e=bgDecor[n]; if(e.kind!=='needle') continue; var nx=(((e.x+Tt*e.sp+Math.sin(Tt*e.swsp+e.ph)*e.sway)%(GW+30))+(GW+30))%(GW+30)-15; var ny=(((e.y+Tt*e.vsp)%(GH+30))+(GH+30))%(GH+30)-15; ctx.globalAlpha=e.a*(0.6+0.4*Math.sin(Tt*0.7+e.ph)); ctx.strokeStyle=e.col; ctx.lineWidth=e.lw; var cc=Math.cos(e.ang),sn=Math.sin(e.ang); ctx.beginPath(); ctx.moveTo(nx-cc*e.len,ny-sn*e.len); ctx.lineTo(nx+cc*e.len,ny+sn*e.len); ctx.stroke(); }
  ctx.restore(); ctx.globalAlpha=1;
  ctx.save(); ctx.globalCompositeOperation='lighter'; for(var m=0;m<bgDecor.length;m++){ var d2=bgDecor[m]; if(d2.kind!=='dust') continue; var dy=(((d2.y-Tt*d2.sp)%(GH+30))+(GH+30))%(GH+30)-15, dx=d2.x+Math.sin(Tt*0.5+d2.ph)*d2.sw; drawMote(dx,dy,d2.r,d2.rgb,d2.a*0.5*(0.45+0.55*(0.5+0.5*Math.sin(Tt*1.3+d2.ph)))); } ctx.restore(); ctx.globalAlpha=1;
  for(var em=0;em<bgDecor.length;em++){ var e2=bgDecor[em]; if(e2.kind!=='ember') continue; var ex=e2.x+Math.sin(Tt*0.5+e2.ph)*e2.sw*0.45, ey=(((e2.y-Tt*e2.sp)%(GH+40))+(GH+40))%(GH+40)-20; sfSpark(ex,ey,e2.r,0.5+0.28*(0.5+0.5*Math.sin(Tt*1.6+e2.ph))); }
  var dusk=cgrad('sf_dusk',function(){ var g=ctx.createLinearGradient(0,GH*0.55,0,GH); g.addColorStop(0,'rgba(224,168,92,0)'); g.addColorStop(0.7,'rgba(222,170,96,0.05)'); g.addColorStop(1,'rgba(220,168,96,0.12)'); return g;}); ctx.fillStyle=dusk; ctx.fillRect(0,0,GW,GH);
  var vg=cgrad('sf_vg',function(){ var g=ctx.createRadialGradient(GW/2,GH*0.5,GH*0.34,GW/2,GH*0.54,GH*0.92); g.addColorStop(0,'rgba(120,116,86,0)'); g.addColorStop(1,'rgba(96,92,66,0.12)'); return g;}); ctx.fillStyle=vg; ctx.fillRect(0,0,GW,GH);
  sfDither();
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
  else if(sceneStyle==='meadow') drawMeadow();
  else if(sceneStyle==='starfield') drawStarfield();
  else if(sceneStyle==='songfeng') drawSongfeng();
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
  else if(itemStyle==='crayon') drawSpringCrayon(x,y,w);
  else if(itemStyle==='ink') drawSpringInk(x,y,w);
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
function drawSpringInk(x,y,w){
  var sx=x+w/2;
  ctx.strokeStyle=THEME.springEdge; ctx.lineWidth=2.4; ctx.lineCap='round';
  ctx.beginPath(); ctx.moveTo(sx-5,y-1); ctx.lineTo(sx+5,y-7); ctx.lineTo(sx-5,y-13); ctx.lineTo(sx+5,y-18); ctx.stroke(); ctx.lineCap='butt';
  ctx.fillStyle=THEME.spring; rr(sx-10,y-25,20,9,4); ctx.fill();
  ctx.fillStyle='rgba(255,255,255,.40)'; rr(sx-8,y-24,12,2.6,1.2); ctx.fill();
  ctx.strokeStyle=THEME.springEdge; ctx.lineWidth=2; ctx.lineJoin='round'; rr(sx-10,y-25,20,9,4); ctx.stroke();
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
function drawBrush(p,x,y,w,h,fill,edge){
  var r=3;
  ctx.fillStyle='rgba(40,36,28,.16)'; rr(x+2,y+4,w,h,r); ctx.fill();
  ctx.fillStyle=fill; rr(x,y,w,h,r); ctx.fill();
  ctx.save(); rr(x,y,w,h,r); ctx.clip();
  ctx.globalAlpha=0.12; ctx.strokeStyle='rgba(255,250,238,0.9)'; ctx.lineWidth=1.1;
  for(var fx=x-h; fx<x+w; fx+=7){ ctx.beginPath(); ctx.moveTo(fx,y+h); ctx.lineTo(fx+h*0.7,y); ctx.stroke(); }
  ctx.globalAlpha=0.16; ctx.fillStyle='#000'; rr(x,y+h*0.6,w,h*0.4,r); ctx.fill();
  ctx.restore(); ctx.globalAlpha=1;
  ctx.strokeStyle=THEME.accent; ctx.lineWidth=2.4; ctx.lineCap='round';
  ctx.beginPath(); ctx.moveTo(x+r,y+1.5); ctx.lineTo(x+w-r,y+1.5); ctx.stroke(); ctx.lineCap='butt';
  ctx.strokeStyle=edge; ctx.lineWidth=1.4; rr(x,y,w,h,r); ctx.stroke();
  if(p.type==='breakable'){ ctx.strokeStyle=edge; ctx.lineWidth=1.4; ctx.beginPath(); ctx.moveTo(x+w*0.42,y); ctx.lineTo(x+w*0.5,y+h*0.6); ctx.lineTo(x+w*0.44,y+h); ctx.stroke(); }
  if(p.type==='moving'){ ctx.strokeStyle='rgba(255,250,238,.6)'; ctx.lineWidth=1.6; ctx.lineCap='round'; var mcy=y+h*0.55,mcx=x+w*0.5;
    ctx.beginPath(); ctx.moveTo(mcx-4,mcy-3); ctx.lineTo(mcx+1,mcy); ctx.lineTo(mcx-4,mcy+3); ctx.moveTo(mcx+1,mcy-3); ctx.lineTo(mcx+6,mcy); ctx.lineTo(mcx+1,mcy+3); ctx.stroke(); ctx.lineCap='butt'; }
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
  else if(platStyle==='chalk') drawChalk(p,x,y,w,h,fill,edge);
  else if(platStyle==='brush') drawBrush(p,x,y,w,h,fill,edge);
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
function drawCoin(c){
  ctx.save(); ctx.translate(c.x,c.y); var r=c.r;
  if(c.jackpot){   // 大礼包: 画成钻石(更小); 拾取折成金币计入(collectCoins 用 c.val)
    var g=r; ctx.lineJoin='round';
    ctx.beginPath(); ctx.moveTo(0,-g*0.75); ctx.lineTo(g*0.78,-g*0.18); ctx.lineTo(0,g*0.9); ctx.lineTo(-g*0.78,-g*0.18); ctx.closePath();
    ctx.fillStyle='#5ad7ff'; ctx.fill(); ctx.strokeStyle='#1b86b0'; ctx.lineWidth=1.4; ctx.stroke();
    ctx.strokeStyle='rgba(255,255,255,.7)'; ctx.lineWidth=1; ctx.beginPath(); ctx.moveTo(-g*0.78,-g*0.18); ctx.lineTo(g*0.78,-g*0.18); ctx.moveTo(0,-g*0.75); ctx.lineTo(0,g*0.9); ctx.stroke();
    ctx.globalAlpha=0.55+0.45*Math.abs(Math.sin(frame*0.15)); ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(-g*0.26,-g*0.16,g*0.15,0,6.2832); ctx.fill(); ctx.globalAlpha=1;
    ctx.restore(); return;
  }
  ctx.fillStyle=c.gold?'#ffd95b':'#f6c64a'; ctx.beginPath(); ctx.arc(0,0,r,0,6.2832); ctx.fill();           // 币身
  ctx.lineWidth=Math.max(1,r*0.18); ctx.strokeStyle='#b9851f'; ctx.beginPath(); ctx.arc(0,0,r-r*0.09,0,6.2832); ctx.stroke();   // 外缘
  ctx.lineWidth=Math.max(0.8,r*0.1); ctx.strokeStyle='rgba(185,133,31,.6)'; ctx.beginPath(); ctx.arc(0,0,r*0.62,0,6.2832); ctx.stroke();  // 内圈
  ctx.fillStyle='#a9760f'; ctx.beginPath();                                                                  // 中心五角星
  for(var i=0;i<10;i++){ var sr=(i%2?r*0.2:r*0.46), a=-1.5708+i*0.62832; var sx=Math.cos(a)*sr, sy=Math.sin(a)*sr; if(i)ctx.lineTo(sx,sy); else ctx.moveTo(sx,sy); }
  ctx.closePath(); ctx.fill();
  ctx.fillStyle='rgba(255,255,255,.7)'; ctx.beginPath(); ctx.arc(-r*0.34,-r*0.36,r*0.2,0,6.2832); ctx.fill(); // 高光
  ctx.restore();
}
function drawItem(it){
  if(it.type==='jet'){ if(itemStyle==='classic') drawJetClassic(it); else drawRocketThemed(it); }
  else if(it.type==='heart') drawHeart(it);
  else if(it.type==='shield') drawShield(it);
  else if(it.type==='magnet') drawMagnet(it);
  else if(it.type==='frenzy_h'||it.type==='frenzy_c') drawFrenzy(it);
}
function drawFrenzy(it){
  var cx=it.x+it.w/2, cy=it.y+it.h/2, r=it.w*0.38;
  var warm=(it.type==='frenzy_c');
  ctx.save(); ctx.translate(cx,cy);
  ctx.globalAlpha=0.45+0.35*Math.abs(Math.sin(frame*0.18));
  ctx.fillStyle=warm?'#ffcf5b':'#8ab4ff'; ctx.beginPath(); ctx.arc(0,0,r+2,0,6.2832); ctx.fill();
  ctx.globalAlpha=1;
  ctx.fillStyle=warm?'#f4b13a':'#5a8bff'; ctx.beginPath(); ctx.arc(0,0,r,0,6.2832); ctx.fill();
  ctx.strokeStyle=warm?'#a9760f':'#2f4ea8'; ctx.lineWidth=1.6; ctx.stroke();
  ctx.fillStyle='#fff'; for(var i=0;i<3;i++){ var a=frame*0.1+i*2.094; ctx.beginPath(); ctx.arc(Math.cos(a)*r*0.5,Math.sin(a)*r*0.5,r*0.13,0,6.2832); ctx.fill(); }
  ctx.restore();
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
  var noir=itemStyle==='noir', aqua=itemStyle==='aqua', relic=itemStyle==='relic', crayon=itemStyle==='crayon', ink=itemStyle==='ink';
  var body=ink?'#e8852a':(noir?'#2c2622':(aqua?'#f28a4e':(relic?'#ee7e3c':(crayon?'#ff8c42':THEME.accent)))), edge=ink?'#b5631a':(aqua?'#c25f2c':(relic?'#b85420':(crayon?'#cf5e1f':THEME.accentDark))), flame=noir?THEME.accent:(relic?'#ffd66a':(crayon?'#ffd24b':(ink?'#f4b24a':'#ffd45b')));
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
  var noir=itemStyle==='noir', aqua=itemStyle==='aqua', relic=itemStyle==='relic', crayon=itemStyle==='crayon', ink=itemStyle==='ink', w=18,h=22, c=ink?'#2f6f9c':(aqua?'#5fa6e2':(relic?'#74b8e0':(crayon?'#5aa9e0':THEME.accent))), e=ink?'#1f4f73':(aqua?'#356f9a':(relic?'#3f7da6':(crayon?'#2f6f9e':THEME.accentDark)));
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
  var bodyC=noir?'#6a645c':(itemStyle==='pop'?'#e08a72':(aqua?'#d6564e':(itemStyle==='relic'?'#d8604a':(itemStyle==='crayon'?'#d8504a':(itemStyle==='ink'?'#7d4f9c':'#9aa0a6')))));
  if(itemGlow()){ctx.shadowColor=aqua?'#dd5a50':THEME.accent;ctx.shadowBlur=8;}
  ctx.lineWidth=6;ctx.strokeStyle=bodyC;
  ctx.beginPath();ctx.arc(0,-1,7,Math.PI,0,false);ctx.stroke();
  ctx.beginPath();ctx.moveTo(-7,-1);ctx.lineTo(-7,8);ctx.moveTo(7,-1);ctx.lineTo(7,8);ctx.stroke();
  ctx.shadowBlur=0;
  ctx.lineWidth=6;ctx.strokeStyle=aqua?'#dd5a50':THEME.accent;ctx.beginPath();ctx.moveTo(-7,5);ctx.lineTo(-7,9.5);ctx.stroke();
  ctx.strokeStyle=aqua?'#f4f6f8':'#dcdcdc';ctx.beginPath();ctx.moveTo(7,5);ctx.lineTo(7,9.5);ctx.stroke();
  ctx.restore();
}
/* ---------- 马 (meadow/chalk/crayon)：目送心中那匹白马奔向远方 ---------- */
function bz(a,b,c,t){ const u=1-t; return u*u*a+2*u*t*b+t*t*c; }
function bzd(a,b,c,t){ return 2*(1-t)*(b-a)+2*t*(c-b); }
function PFG(){return [GW*0.30,GH*0.96];}
function PCP(){return [GW*0.28,GH*0.54];}
function PFR(){return [GW*0.57,GH*0.33];}
function pathPt(t){ const f=PFG(),c=PCP(),r=PFR(); return [bz(f[0],c[0],r[0],t),bz(f[1],c[1],r[1],t)]; }
function pathTan(t){ const f=PFG(),c=PCP(),r=PFR(); let dx=bzd(f[0],c[0],r[0],t),dy=bzd(f[1],c[1],r[1],t); const m=Math.hypot(dx,dy)||1; return [dx/m,dy/m]; }
function drawHoof(x,y,sz,a){
  ctx.globalAlpha=a; ctx.strokeStyle='rgba(72,88,34,0.9)'; ctx.lineWidth=Math.max(1,sz*0.46); ctx.lineCap='round';
  ctx.beginPath(); ctx.arc(x,y,sz,Math.PI*0.16,Math.PI*0.84,false); ctx.stroke(); ctx.lineCap='butt';
}
function drawPetal(x,y,sz,rot,col,a){
  ctx.save(); ctx.translate(x,y); ctx.rotate(rot); ctx.globalAlpha=a; ctx.fillStyle=col;
  ctx.beginPath(); ctx.moveTo(0,-sz); ctx.bezierCurveTo(sz*0.85,-sz*0.5,sz*0.85,sz*0.55,0,sz); ctx.bezierCurveTo(-sz*0.85,sz*0.55,-sz*0.85,-sz*0.5,0,-sz); ctx.closePath(); ctx.fill();
  ctx.globalAlpha=a*0.4; ctx.strokeStyle='rgba(255,255,255,0.7)'; ctx.lineWidth=0.6;
  ctx.beginPath(); ctx.moveTo(0,-sz*0.6); ctx.lineTo(0,sz*0.6); ctx.stroke();
  ctx.restore(); ctx.globalAlpha=1;
}
function drawMote(x,y,r,rgb,a){
  const g=ctx.createRadialGradient(x,y,0,x,y,r*2.2);
  g.addColorStop(0,'rgba('+rgb+','+a.toFixed(3)+')'); g.addColorStop(0.45,'rgba('+rgb+','+(a*0.4).toFixed(3)+')'); g.addColorStop(1,'rgba('+rgb+',0)');
  ctx.fillStyle=g; ctx.beginPath(); ctx.arc(x,y,r*2.2,0,6.2832); ctx.fill();
  ctx.globalAlpha=Math.min(1,a+0.25); ctx.fillStyle='rgba(255,255,250,'+Math.min(1,a+0.1).toFixed(3)+')'; ctx.beginPath(); ctx.arc(x,y,r*0.55,0,6.2832); ctx.fill(); ctx.globalAlpha=1;
}
function drawDuskRays(cx,cy,T){
  const n=5; ctx.save(); ctx.translate(cx,cy); ctx.globalCompositeOperation='lighter';
  for(let i=0;i<n;i++){ const ang=Math.PI*0.5+(i-(n-1)/2)*0.33+Math.sin(T*0.06+i*1.3)*0.018;
    ctx.save(); ctx.rotate(ang); const len=GH*0.84, w=26+(i%3)*11;
    const g=ctx.createLinearGradient(0,0,0,len);
    g.addColorStop(0,'rgba(255,241,206,0)'); g.addColorStop(0.24,'rgba(255,241,206,0.028)'); g.addColorStop(0.8,'rgba(255,241,206,0.008)'); g.addColorStop(1,'rgba(255,241,206,0)');
    ctx.fillStyle=g; ctx.beginPath(); ctx.moveTo(-w*0.2,0); ctx.lineTo(w,len); ctx.lineTo(-w,len); ctx.closePath(); ctx.fill(); ctx.restore(); }
  ctx.restore();
}
function grassBlade(bx,h,bend,w,col){ ctx.fillStyle=col; ctx.beginPath(); ctx.moveTo(bx-w,GH); ctx.quadraticCurveTo(bx-w*0.3+bend*0.5,GH-h*0.55,bx+bend,GH-h); ctx.quadraticCurveTo(bx+w*0.3+bend*0.5,GH-h*0.55,bx+w,GH); ctx.closePath(); ctx.fill(); }
function drawTuft(gb,T,front){
  const sway=Math.sin(T*0.7+gb.ph)*(front?7:5);
  for(let b=0;b<gb.n;b++){ const off=(b-(gb.n-1)/2)*(gb.spread/gb.n*1.7); const h=gb.h*(0.72+0.28*Math.cos(b*1.7)); const bend=sway*(0.55+0.5*(b/gb.n));
    const shade=front?(b%2?'#7db13f':'#6aa036'):(b%2?'#5c8430':'#4f7128');
    grassBlade(gb.x+off,h,bend,2.0+(front?0.8:0.4),shade); }
  if(gb.seed&&front){ ctx.fillStyle=gb.seedcol; ctx.globalAlpha=0.92; ctx.beginPath(); ctx.ellipse(gb.x+sway,GH-gb.h-2,1.8,3.2,0,0,6.2832); ctx.fill(); ctx.globalAlpha=1; }
}
function drawMeadow(){
  const T=nowSec(), fr=PFR();
  const sky=cgrad('md_sky',function(){ const g=ctx.createLinearGradient(0,0,0,GH);
    g.addColorStop(0.00,'#bfe053'); g.addColorStop(0.38,'#c9e65d'); g.addColorStop(0.68,'#e6ec88'); g.addColorStop(1.00,'#efe6ad'); return g; });
  ctx.fillStyle=sky; ctx.fillRect(0,0,GW,GH);
  drawDuskRays(fr[0],fr[1],T);
  const vbr=0.5+0.5*Math.sin(T*0.5);
  const vg=ctx.createRadialGradient(fr[0],fr[1],4,fr[0],fr[1],GH*0.46);
  vg.addColorStop(0,'rgba(255,244,198,'+(0.44+0.10*vbr).toFixed(3)+')'); vg.addColorStop(0.45,'rgba(255,232,176,0.14)'); vg.addColorStop(1,'rgba(255,232,176,0)');
  ctx.fillStyle=vg; ctx.fillRect(0,0,GW,GH);
  const dusk=cgrad('md_dusk',function(){ const g=ctx.createLinearGradient(0,GH*0.5,0,GH);
    g.addColorStop(0,'rgba(255,206,120,0)'); g.addColorStop(0.62,'rgba(255,198,110,0.12)'); g.addColorStop(1,'rgba(250,182,92,0.26)'); return g; });
  ctx.fillStyle=dusk; ctx.fillRect(0,0,GW,GH);
  for(let i=0;i<8;i++){ const t=0.08+i*0.108, p=pathPt(t), sz=(1-t)*8.5+1.8, a=(1-t)*0.5; drawHoof(p[0]-sz*0.95,p[1]+sz*0.34,sz,a); drawHoof(p[0]+sz*0.95,p[1]-sz*0.42,sz*0.9,a*0.82); }
  ctx.globalAlpha=1;
  for(let s=0;s<bgDecor.length;s++){ const gb=bgDecor[s]; if(gb.kind==='grass'&&gb.back) drawTuft(gb,T,false); }
  for(let s=0;s<bgDecor.length;s++){ const p=bgDecor[s]; if(p.kind!=='petal') continue;
    const py=(((p.y+T*p.fall)%(GH+24))+(GH+24))%(GH+24)-12;
    const px=(((p.x+T*p.wind+Math.sin(T*p.swsp+p.ph)*p.sway)%(GW+24))+(GW+24))%(GW+24)-12;
    drawPetal(px,py,p.sz,p.rot+T*p.rsp,p.col,p.a*(0.7+0.3*Math.sin(T*0.7+p.ph))); }
  ctx.save(); ctx.globalCompositeOperation='lighter';
  for(let s=0;s<bgDecor.length;s++){ const m=bgDecor[s]; if(m.kind!=='mote') continue;
    const my=(((m.y-T*m.sp)%(GH+30))+(GH+30))%(GH+30)-15, mx=m.x+Math.sin(T*0.5+m.ph)*m.sw;
    drawMote(mx,my,m.r,m.rgb,m.a*(0.45+0.55*(0.5+0.5*Math.sin(T*1.3+m.ph)))); }
  ctx.restore(); ctx.globalAlpha=1;
  ctx.globalAlpha=0.5+0.5*Math.sin(T*1.3); ctx.fillStyle='#fffdf0'; ctx.beginPath(); ctx.arc(fr[0],fr[1],2.4,0,6.2832); ctx.fill(); ctx.globalAlpha=1;
  for(let s=0;s<bgDecor.length;s++){ const gb=bgDecor[s]; if(gb.kind==='grass'&&!gb.back) drawTuft(gb,T,true); }
  const vg2=cgrad('md_vg',function(){ const g=ctx.createRadialGradient(GW/2,GH*0.46,GH*0.30,GW/2,GH*0.5,GH*0.86); g.addColorStop(0,'rgba(110,130,40,0)'); g.addColorStop(1,'rgba(86,104,38,0.16)'); return g; });
  ctx.fillStyle=vg2; ctx.fillRect(0,0,GW,GH);
}
function drawChalk(p,x,y,w,h,fill,edge){
  const r=6;
  ctx.fillStyle='rgba(60,70,30,.16)'; rr(x+2,y+4,w,h,r); ctx.fill();
  ctx.fillStyle=fill; rr(x,y,w,h,r); ctx.fill();
  ctx.save(); rr(x,y,w,h,r); ctx.clip();
  ctx.fillStyle='rgba(255,255,255,.30)'; rr(x+3,y+1.4,w-6,h*0.34,r*0.7); ctx.fill();
  ctx.globalAlpha=0.09; ctx.strokeStyle='#ffffff'; ctx.lineWidth=1.3;
  for(let hxp=x-h; hxp<x+w; hxp+=8){ ctx.beginPath(); ctx.moveTo(hxp,y+h); ctx.lineTo(hxp+h,y); ctx.stroke(); }
  ctx.restore(); ctx.globalAlpha=1;
  ctx.strokeStyle=edge; ctx.lineWidth=2.2; ctx.lineJoin='round'; rr(x,y,w,h,r); ctx.stroke();
  ctx.globalAlpha=0.45; ctx.lineWidth=1; rr(x+0.8,y+1.3,w-1.6,h-1.8,r); ctx.stroke(); ctx.globalAlpha=1;
  if(p.type==='breakable'){ ctx.strokeStyle=edge; ctx.lineWidth=1.6; ctx.beginPath(); ctx.moveTo(x+w*0.4,y+2); ctx.lineTo(x+w*0.5,y+h*0.58); ctx.lineTo(x+w*0.43,y+h-2); ctx.stroke(); }
  if(p.type==='moving'){ ctx.strokeStyle='rgba(255,255,255,.55)'; ctx.lineWidth=1.7; ctx.lineCap='round'; const cy=y+h*0.5,cx=x+w*0.5;
    ctx.beginPath(); ctx.moveTo(cx-4,cy-3); ctx.lineTo(cx+1,cy); ctx.lineTo(cx-4,cy+3); ctx.moveTo(cx+1,cy-3); ctx.lineTo(cx+6,cy); ctx.lineTo(cx+1,cy+3); ctx.stroke(); ctx.lineCap='butt'; }
}
function drawSpringCrayon(x,y,w){
  const sx=x+w/2;
  ctx.strokeStyle='#7a6a3a'; ctx.lineWidth=2.4; ctx.lineCap='round';
  ctx.beginPath(); ctx.moveTo(sx-5,y-1); ctx.lineTo(sx+5,y-7); ctx.lineTo(sx-5,y-13); ctx.lineTo(sx+5,y-18); ctx.stroke();
  ctx.lineCap='butt';
  ctx.fillStyle=THEME.spring; rr(sx-10,y-25,20,9,4); ctx.fill();
  ctx.fillStyle='rgba(255,255,255,.45)'; rr(sx-8,y-24,12,2.6,1.2); ctx.fill();
  ctx.strokeStyle=THEME.springEdge; ctx.lineWidth=2; ctx.lineJoin='round'; rr(sx-10,y-25,20,9,4); ctx.stroke();
}
/* ---------- Fearless (starfield)：星空随歌节奏分层闪烁(音频联动) ---------- */
function flClock(){ var on=false,t=0; try{ if(audio && !audio.paused && audio.currentTime>0){ t=audio.currentTime; on=true; } }catch(e){} if(!on) t=nowSec(); return {t:t,on:on}; }
function flEnergy(t,on,B){ if(!on||!B||!B.env) return 0.42+0.22*Math.sin(t*0.4); var env=B.env,p=(t/B.dur)*(env.length-1),i=Math.floor(p),f=p-i; if(i<0)i=0; if(i>env.length-2)i=env.length-2; return (env[i]*(1-f)+env[i+1]*f)/99; }
function flBeatPhase(t,B){ var bp=(B&&B.bpm)?60/B.bpm:0.6036; return (t/bp)%1; }
function flBeatFlare(bp,off){ var x=((bp-off)%1+1)%1; return Math.pow(Math.max(0,1-x/0.55),1.8); }
function flDot(x,y,r,col,a){ ctx.globalAlpha=a; ctx.fillStyle=col; ctx.beginPath(); ctx.arc(x,y,r,0,6.2832); ctx.fill(); ctx.globalAlpha=1; }
function flSpike(x,y,R,col,a,rot){ ctx.save(); ctx.translate(x,y); if(rot) ctx.rotate(rot); ctx.globalAlpha=a; ctx.fillStyle=col; var w=R*0.13; ctx.beginPath(); ctx.moveTo(0,-R); ctx.quadraticCurveTo(w,-w,R,0); ctx.quadraticCurveTo(w,w,0,R); ctx.quadraticCurveTo(-w,w,-R,0); ctx.quadraticCurveTo(-w,-w,0,-R); ctx.closePath(); ctx.fill(); ctx.restore(); ctx.globalAlpha=1; }
function flStar(st,T,E,beatP){
  var own=0.5+0.5*Math.sin(T*st.tw+st.ph);
  var x=st.x+Math.sin(T*st.dx+st.ph)*st.amp, y=st.y+Math.cos(T*st.dy+st.ph)*st.amp*0.6;
  if(st.glint){
    var pu=flBeatFlare(beatP,st.boff), inten=0.78+0.22*E, tw=0.72*own+0.28*pu;
    var a=st.a*(0.62+0.38*tw)*inten, R=st.r*(2.4+0.7*tw);
    flSpike(x,y,R,st.col,a*0.7,0); flSpike(x,y,R*0.5,st.col,a*0.30,Math.PI/4); flDot(x,y,st.r*0.95,st.col,a);
  } else if(st.mid){
    var pu2=flBeatFlare(beatP,st.boff), inten2=0.78+0.22*E, tw2=0.74*own+0.26*pu2;
    flDot(x,y,st.r*(0.88+0.2*tw2),st.col,st.a*(0.55+0.45*tw2)*inten2);
  } else {
    flDot(x,y,st.r*(0.94+0.12*own),st.col,st.a*(0.6+0.4*own)*(0.68+0.32*E));
  }
}
function flCircles(T){ for(var i=0;i<bgDecor.length;i++){ var b=bgDecor[i]; if(b.kind!=='circle') continue;
  var yy=b.y+Math.sin(T*0.1+b.ph)*8, pulse=1+0.05*Math.sin(T*0.4+b.ph); ctx.globalAlpha=b.a; ctx.fillStyle=THEME.pN;
  if(b.ring){ ctx.lineWidth=Math.max(2,b.r*0.06); ctx.strokeStyle=THEME.pN; ctx.beginPath(); ctx.arc(b.x,yy,b.r*pulse,0,6.2832); ctx.stroke(); }
  else { ctx.beginPath(); ctx.arc(b.x,yy,b.r*pulse,0,6.2832); ctx.fill(); } } ctx.globalAlpha=1; }
function drawStarfield(){
  var T=nowSec(), c=flClock(), B=(curTheme&&curTheme.beat)||null;
  var E=flEnergy(c.t,c.on,B), bt=c.on?c.t:T, beatP=flBeatPhase(bt,B);
  var sky=cgrad('fl_bg',function(){ var g=ctx.createLinearGradient(0,0,0,GH); g.addColorStop(0,'#fbf6f3'); g.addColorStop(0.55,'#f6efeb'); g.addColorStop(1,'#f3e8e2'); return g; });
  ctx.fillStyle=sky; ctx.fillRect(0,0,GW,GH);
  flCircles(T);
  for(var L=0;L<=2;L++){ for(var i=0;i<bgDecor.length;i++){ var s=bgDecor[i]; if(s.kind==='star'&&s.layer===L) flStar(s,T,E,beatP); } }
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
  for(var ci=0;ci<coins.length;ci++){ if(!coins[ci].taken) drawCoin(coins[ci]); }
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
    var rcn=document.getElementById('runCoinNum'); if(rcn) rcn.textContent=runCoins;
    var fb=document.getElementById('frenzyBar'), ff=document.getElementById('frenzyFill');
    if(fb&&ff){ if(frenzy>0){ fb.style.display='block'; ff.style.width=(frenzy/MQLogic.FRENZY_DUR*100).toFixed(1)+'%'; ff.style.background=(frenzyType==='c')?'#f4b13a':'#5a8bff'; } else { fb.style.display='none'; } }
  } else { _acc=0; var fbx=document.getElementById('frenzyBar'); if(fbx)fbx.style.display='none'; }
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
  ['muteBtn','menuMusicBtn','shopMusicBtn'].forEach(function(id){ var b=$(id); if(b) b.innerHTML=html; });   // 局内HUD+菜单+商店 三处音乐键同步图标
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
function renderCoinHud(){ var a=document.getElementById('coinNum'); if(a)a.textContent=store.coins; }
function show(id){
  ['menu','pause','over','shop'].forEach(function(s){var el=$(s); if(el)el.classList.toggle('hidden',s!==id);});
  $('hud').classList.toggle('hidden',id!=='play');
  if(id==='menu'){ renderCoinHud(); fitMenu(); setTimeout(fitMenu,60); setTimeout(fitMenu,300); }   // 菜单显示后按需缩放，确保任何视口完整显示
  if(id==='shop'){ fitShop(); setTimeout(fitShop,60); setTimeout(fitShop,300); }   // 商店同样自适应缩放至整屏(不滚动)
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
var shopPage=0;   // 商店主题分页: 每组6个, 两侧箭头切组
function buildThemes(locate){
  var c=$('themes'); if(!c) return; c.innerHTML='';
  var PER=8, total=THEMES.length, pages=Math.max(1,Math.ceil(total/PER));
  if(locate){ var ai=0; for(var k=0;k<total;k++){ if(THEMES[k].id===store.theme){ ai=k; break; } } themesPage=Math.floor(ai/PER); }  // 打开菜单时定位到选中主题所在组
  if(themesPage>=pages) themesPage=pages-1; if(themesPage<0) themesPage=0;
  THEMES.slice(themesPage*PER, themesPage*PER+PER).forEach(function(t){
    var d=document.createElement('div');d.className='tcard'+(t.id===store.theme?' active':'')+(store.isUnlocked(t.id)?'':' locked');
    d.innerHTML='<div class="tcv"><img src="'+t.cover+'" alt="'+t.name+'" onerror="this.style.opacity=0">'+(store.isUnlocked(t.id)?'':'<span class="tlock"><svg class="lkico" viewBox="0 0 24 24" aria-hidden="true"><path class="lkshW" d="M8 11V8a4 4 0 0 1 8 0v3"/><rect class="lkbdW" x="5" y="10.6" width="14" height="10.8" rx="3.2"/><path class="lkshO" d="M8 11V8a4 4 0 0 1 8 0v3"/><path class="lksh" d="M8 11V8a4 4 0 0 1 8 0v3"/><rect class="lkbd" x="5" y="10.6" width="14" height="10.8" rx="3.2"/><circle class="lkkh" cx="12" cy="15" r="1.7"/><path class="lkkh" d="M11.1 15.7h1.8l-.55 2.8h-.7z"/></svg><b class="lkreq">达<em>'+t.unlockScore+'</em>分</b></span>')+'</div><span class="tnm">'+t.name+'</span>';
    d.onclick=(function(th){ return function(){ if(!store.isUnlocked(th.id)){ openShop(th.id); return; } ensureAudio(); store.theme=th.id; applyTheme(th); buildThemes(false); playMusic(); }; })(t);  // 未解锁→跳商店; 已解锁→选用
    c.appendChild(d);
  });
  var prev=$('themesPrev'), next=$('themesNext');
  if(prev&&next){ var multi=pages>1;
    prev.classList.toggle('thidden',!multi); next.classList.toggle('thidden',!multi);   // 只有一组就隐藏箭头
    prev.disabled=(themesPage<=0); next.disabled=(themesPage>=pages-1);
  }
  fitMenu();   // 网格行数变化后重新自适应缩放
}
function openShop(focusId){ buildShop(focusId); show('shop'); }
var CONSUMABLES=[
  {kind:'revive',  name:'复活',     price:80, desc:'死亡自动续命一次', invKey:'invRevive',  cap:1},
  {kind:'frenzy_h',name:'狂暴·高度',price:90,  desc:'本局保证出现 1 个高度狂暴球', invKey:'invFrenzyH', cap:1}
];
function buildConsumables(){
  var box=$('shopConsumables'); if(!box) return; box.innerHTML='';
  for(var i=0;i<CONSUMABLES.length;i++){ (function(c){
    var have=store[c.invKey], can=MQLogic.canBuyConsumable(store.coins,c.price,have,c.cap);
    var row=document.createElement('div'); row.className='shop-row consum';
    row.innerHTML='<div class="shop-info"><div class="shop-nm">'+c.name+'</div><div class="shop-st">'+c.desc+'（已备 '+have+'/'+c.cap+'）</div></div>';
    var btn=document.createElement('button'); btn.className='shop-buy';
    if(have>=c.cap){ btn.textContent='已备满'; btn.disabled=true; }
    else { btn.innerHTML='<svg class="coinico" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10.4" fill="#ffd95b" stroke="#b9851f" stroke-width="2"/><circle cx="12" cy="12" r="6.4" fill="none" stroke="#b9851f" stroke-opacity=".5" stroke-width="1.1"/><path d="M12 7.3L13.2 10.4L16.5 10.5L13.9 12.6L14.8 15.8L12 14L9.2 15.8L10.1 12.6L7.5 10.5L10.8 10.4Z" fill="#a9760f"/><circle cx="8.7" cy="8.4" r="1.9" fill="#fff" fill-opacity=".72"/></svg> <span style="display:inline-block;min-width:26px;text-align:center">'+c.price+'</span>'; btn.disabled=!can; btn.onclick=function(){ if(buyConsumable(c.kind)){ buildConsumables(); var sc=$('shopCoins'); if(sc)sc.textContent=store.coins; renderCoinHud&&renderCoinHud(); } }; }
    row.appendChild(btn); box.appendChild(row);
  })(CONSUMABLES[i]); }
}
function buyConsumable(kind){
  var c=null,i; for(i=0;i<CONSUMABLES.length;i++) if(CONSUMABLES[i].kind===kind) c=CONSUMABLES[i];
  if(!c) return false; var have=store[c.invKey];
  if(!MQLogic.canBuyConsumable(store.coins,c.price,have,c.cap)) return false;
  store.coins=store.coins-c.price; store[c.invKey]=have+1; return true;
}
function buildShop(focusId){
  var total=THEMES.length;
  if(focusId){ for(var fi=0;fi<total;fi++){ if(THEMES[fi].id===focusId){ shopPage=Math.floor(fi/6); break; } } }   // 聚焦某主题→跳到其所在组
  var info=MQLogic.pageInfo(total, shopPage, 6); shopPage=info.page;
  var multi=info.pages>1;
  var list=$('shopList'); if(list){ list.innerHTML='';
    THEMES.slice(info.start, info.end).forEach(function(t){
      var owned=store.isUnlocked(t.id), can=store.coins>=t.price;
      var row=document.createElement('div'); row.className='shop-row'+(owned?' owned':'')+(t.id===focusId?' focus':'');
      row.innerHTML='<img class="shop-cv" src="'+t.cover+'" onerror="this.style.opacity=0"><div class="shop-info"><div class="shop-nm">'+t.name+'</div>'+
        '<div class="shop-st">'+(owned?'已拥有':('达 '+t.unlockScore+' 分解锁'))+'</div></div>';
      var btn=document.createElement('button'); btn.className='shop-buy';
      if(owned){ if(t.id===store.theme) row.classList.add('sel'); btn.textContent='选用'; row.onclick=function(){ var rs=list.querySelectorAll('.shop-row'); for(var ri=0;ri<rs.length;ri++) rs[ri].classList.remove('sel'); row.classList.add('sel'); };   // 点卡片=选中高亮(不切主题)
        btn.onclick=function(ev){ if(ev&&ev.stopPropagation)ev.stopPropagation(); ensureAudio(); store.theme=t.id; applyTheme(t); show('menu'); buildThemes(true); playMusic(); };   // 点选用=真正切换并返回菜单
      }
      else { btn.innerHTML='<svg class="coinico" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10.4" fill="#ffd95b" stroke="#b9851f" stroke-width="2"/><circle cx="12" cy="12" r="6.4" fill="none" stroke="#b9851f" stroke-opacity=".5" stroke-width="1.1"/><path d="M12 7.3L13.2 10.4L16.5 10.5L13.9 12.6L14.8 15.8L12 14L9.2 15.8L10.1 12.6L7.5 10.5L10.8 10.4Z" fill="#a9760f"/><circle cx="8.7" cy="8.4" r="1.9" fill="#fff" fill-opacity=".72"/></svg> '+t.price; btn.disabled=!can; btn.onclick=function(){ if(shopBuy(t.id)){ buildShop(t.id); } }; }
      row.appendChild(btn); list.appendChild(row);
    });
    if(multi){ var tpl=list.querySelector('.shop-row'); for(var ph=(info.end-info.start); tpl&&ph<6; ph++){ var ghost=tpl.cloneNode(true); ghost.className='shop-row'; ghost.style.visibility='hidden'; ghost.setAttribute('aria-hidden','true'); list.appendChild(ghost); } }   // 多页:补满6行隐藏占位→每页高度恒定, 翻页不再向中间聚拢
  }
  buildConsumables();
  var prev=$('shopPrev'),next=$('shopNext'),ind=$('shopPageInd');
  if(prev&&next){
    prev.style.display=next.style.display=multi?'':'none';   // ≤6 时箭头不占位, 布局不变
    prev.disabled=shopPage<=0; next.disabled=shopPage>=info.pages-1;
  }
  var cbox=$('shopConsumables'); if(cbox) cbox.classList.toggle('noarr', !multi);   // 多页:消耗品右内缩与主题卡对齐; 单页:贴满
  if(ind){ ind.style.display=multi?'':'none'; ind.textContent='第 '+(shopPage+1)+' / '+info.pages+' 组'; }
  var sc=$('shopCoins'); if(sc)sc.textContent=store.coins; renderCoinHud&&renderCoinHud(); fitShop();
}
function shopBuy(id){ var t=findTheme(id); if(!t||store.isUnlocked(id)||store.coins<t.price) return false;
  store.coins=store.coins-t.price; store.unlock(id); buildThemes&&buildThemes(false); return true; }
if($('themesPrev')) $('themesPrev').onclick=function(){ if(themesPage>0){ themesPage--; buildThemes(false); } };
if($('themesNext')) $('themesNext').onclick=function(){ var pg=Math.ceil(THEMES.length/8); if(themesPage<pg-1){ themesPage++; buildThemes(false); } };
if($('shopPrev')) $('shopPrev').onclick=function(){ if(shopPage>0){ shopPage--; buildShop(); } };
if($('shopNext')) $('shopNext').onclick=function(){ var sp=Math.ceil(THEMES.length/6); if(shopPage<sp-1){ shopPage++; buildShop(); } };

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
  store.coins=store.coins+MQLogic.coinSettle(score,runCoins); if(typeof checkUnlocks==='function')checkUnlocks();
  $('bestScore').textContent='最高 '+store.best;
  var nr=$('newRecord'); if(nr)nr.classList.toggle('hidden',!isRecord);
  var rc=$('resultChar'); if(rc)rc.src='assets/char_'+store.skin+'.png?v=2';
  show('over');
  countUp($('finalScore'),score,650);
}
$('startBtn').onclick=startGame;
if($('shopBtn')) $('shopBtn').onclick=function(){ openShop(); };
if($('shopBack')) $('shopBack').onclick=function(){ show('menu'); buildThemes(true); };
$('retryBtn').onclick=startGame;
$('changeBtn').onclick=function(){state='menu';buildSwatches();buildThemes(true);show('menu');};
$('quitBtn').onclick=function(){state='menu';buildSwatches();buildThemes(true);show('menu');};
$('pauseBtn').onclick=function(){if(state==='play'){state='pause';show('pause');pauseMusicKeep();}};
$('resumeBtn').onclick=function(){if(state==='pause'){state='play';show('play');resumeMusic();}};
$('muteBtn').onclick=toggleMute;
if($('menuMusicBtn')) $('menuMusicBtn').onclick=toggleMute;
if($('shopMusicBtn')) $('shopMusicBtn').onclick=toggleMute;

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
function checkUnlocks(){
  var best=store.best, msg=null;
  for(var i=0;i<THEMES.length;i++){ var t=THEMES[i];
    if(!store.isUnlocked(t.id) && (t.unlockScore||0)<=best){ store.unlock(t.id); msg=t.name; } }
  if(msg){ try{ toast('解锁了「'+msg+'」！'); }catch(e){} buildThemes&&buildThemes(false); renderCoinHud&&renderCoinHud(); }
}
function migrateSave(){
  try{ if(localStorage.getItem('mq_sv')) return; }catch(e){ return; }
  var best=store.best, unl=['classic'];
  for(var i=0;i<THEMES.length;i++){ var t=THEMES[i]; if(t.id!=='classic' && (t.unlockScore||0)<=best && unl.indexOf(t.id)<0) unl.push(t.id); }
  store.unlocked=unl;
  try{ localStorage.setItem('mq_sv','1'); }catch(e){}
}
if(THEMES.length){ migrateSave(); applyTheme(findTheme(store.theme)); }
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
