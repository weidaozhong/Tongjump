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
var sceneStyle='grid', platStyle='round', itemStyle='classic', bgDecor=[];

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
var maxHP=3, hp=3, lastItemType=null, sinceItem=99;
var tiltX=0, keyDir=0, touchActive=false, touchAxis=0, touchStartX=0, particles=[];

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
  player={x:GW/2-22, y:GH-160, w:44, h:48, vx:0, vy:JUMP, face:1, squash:0, jet:0, shield:false, magOn:false, magTarget:null, magArm:0, inv:0};
  platforms=[]; items=[]; particles=[]; score=0; scrolled=0; frame=0; lastItemType=null; sinceItem=99;
  platforms.push({x:GW/2-40,y:GH-90,w:80,type:'normal',vx:0,broken:false,spring:false});
  var y=GH-90;
  for(var i=0;i<14;i++){ y-=randGap(); platforms.push(makePlatform(y)); }
  hp=maxHP; renderHP();
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
function jStart(x){ if(state!=='play')return; touchActive=true; touchStartX=x; touchAxis=0; }
function jMove(x){ if(!touchActive)return;
  var r=cv.getBoundingClientRect();
  var maxDrag=Math.max(78,r.width*0.28);            // 满速所需滑动距离加大 → 不那么灵敏
  var raw=(x-touchStartX)/maxDrag;
  var s=raw<0?-1:1, a=Math.abs(raw);
  var dead=0.10;                                     // 死区：忽略微小抖动
  a=Math.min(1,Math.max(0,(a-dead)/(1-dead)));
  touchAxis=s*Math.pow(a,1.7);                       // 缓和曲线：近中心细腻、中段跟手、远端满速
}
function jEnd(){ touchActive=false; touchAxis=0; }
cv.addEventListener('touchstart',function(e){ if(e.touches&&e.touches.length)jStart(e.touches[0].clientX); e.preventDefault(); },{passive:false});
cv.addEventListener('touchmove',function(e){ if(e.touches&&e.touches.length)jMove(e.touches[0].clientX); e.preventDefault(); },{passive:false});
cv.addEventListener('touchend',function(e){ jEnd(); e.preventDefault(); },{passive:false});
cv.addEventListener('touchcancel',function(){ jEnd(); },{passive:false});
cv.addEventListener('mousedown',function(e){ jStart(e.clientX); });
cv.addEventListener('mousemove',function(e){ jMove(e.clientX); });
window.addEventListener('mouseup',function(){ jEnd(); });

/* ---------- 更新 ---------- */
function update(){
  frame++;
  if(player.inv>0)player.inv--;
  if(player.magOn){ magnetTick(); }
  var ax=0;
  if(keyDir!==0) ax=keyDir;
  else if(touchActive) ax=touchAxis;
  else if(Math.abs(tiltX)>0.04) ax=tiltX;
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
  if(player.y>GH+10 && player.inv<=0){
    if(player.shield){ player.shield=false; sfx('spring'); respawn(); }
    else { hp--; renderHP(); sfx('brk'); if(hp<=0){ gameOver(); } else { respawn(); } }
  }
}
function bounceFx(p){for(var i=0;i<5;i++)particles.push({x:p.x+p.w/2,y:p.y+8,vx:(Math.random()-.5)*3,vy:-Math.random()*2,life:18,c:'#fff',r:2+Math.random()*2});}
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
function respawn(){
  player.inv=72;
  var rx=Math.max(10,Math.min(GW-90,player.x));
  var rp={x:rx,y:GH-110,w:80,type:'normal',vx:0,broken:false,spring:false};
  platforms.push(rp);
  player.x=rp.x+rp.w/2-player.w/2; player.y=rp.y-player.h;
  player.vy=JUMP; player.vx=0; player.squash=1; player.jet=0;
}
function collectItems(){
  var pl=player.x, pt=player.y, pr=player.x+player.w, pb=player.y+player.h;
  for(var i=0;i<items.length;i++){ var it=items[i]; if(it.taken)continue;
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
  if(sinceItem<4) return;                 // 两道具至少隔 4 块平台，避免同屏扎堆
  if(Math.random()>0.34) return;          // 满足间隔后再按概率出
  var pool=[];                            // 加权候选
  if(hp<maxHP) pool.push(['heart',38]);
  pool.push(['jet',30]); pool.push(['shield',18]); pool.push(['magnet',16]);
  pool=pool.filter(function(p){return p[0]!==lastItemType;});  // 绝不连续同种
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
    for(var i=0;i<11;i++){bgDecor.push({x:Math.random()*GW,y:Math.random()*960,r:26+Math.random()*92,a:0.05+Math.random()*0.12,ring:Math.random()<0.28});}
  } else if(sceneStyle==='embers'){
    for(var j=0;j<30;j++){bgDecor.push({x:Math.random()*GW,y:Math.random()*GH,r:0.6+Math.random()*2.0,sp:8+Math.random()*26,ph:Math.random()*6.28,sw:2+Math.random()*7});}
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
  var TILE=960, base=(scrolled*0.35)%TILE;
  ctx.save();
  for(var i=0;i<bgDecor.length;i++){
    var b=bgDecor[i], y=((b.y+base)%TILE+TILE)%TILE;
    for(var k=-1;k<=1;k++){
      var yy=y+k*TILE; if(yy<-140||yy>GH+140) continue;
      if(b.ring){ctx.globalAlpha=b.a*1.5;ctx.lineWidth=Math.max(2,b.r*0.10);ctx.strokeStyle=THEME.accent;ctx.beginPath();ctx.arc(b.x,yy,b.r,0,6.2832);ctx.stroke();}
      else{ctx.globalAlpha=b.a;ctx.fillStyle=THEME.accent;ctx.beginPath();ctx.arc(b.x,yy,b.r,0,6.2832);ctx.fill();}
    }
  }
  ctx.restore(); ctx.globalAlpha=1;
}
function drawEmbers(){
  var vg=ctx.createRadialGradient(GW/2,GH*0.42,GH*0.16,GW/2,GH*0.52,GH*0.74);
  vg.addColorStop(0,'rgba(0,0,0,0)'); vg.addColorStop(1,'rgba(0,0,0,0.45)');
  ctx.fillStyle=vg; ctx.fillRect(0,0,GW,GH);
  var T=nowSec();
  ctx.save();
  for(var i=0;i<bgDecor.length;i++){
    var e=bgDecor[i];
    var y=((e.y - T*e.sp)%GH+GH)%GH;
    var x=e.x + Math.sin(T*1.2+e.ph)*e.sw;
    var tw=0.35+0.65*(0.5+0.5*Math.sin(T*3+e.ph));
    ctx.globalAlpha=tw*0.85; ctx.fillStyle=THEME.accent;
    ctx.beginPath();ctx.arc(x,y,e.r,0,6.2832);ctx.fill();
  }
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
  else drawGrid();
  var g=ctx.createLinearGradient(0,0,0,GH);
  g.addColorStop(0,THEME.dimTop); g.addColorStop(1,THEME.dimBot);
  ctx.fillStyle=g; ctx.fillRect(0,0,GW,GH);
}
/* ---------- 平台：按主题三种造型 ---------- */
function drawSpring(x,y,w){
  if(itemStyle==='noir') drawSpringNoir(x,y,w);
  else if(itemStyle==='pop') drawSpringPop(x,y,w);
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
function roundPlat(p){
  var x=p.x,y=p.y,w=p.w,h=14,fill,edge;
  if(p.type==='moving'){fill=THEME.pM;edge=THEME.pMe;}
  else if(p.type==='breakable'){fill=THEME.pB;edge=THEME.pBe;}
  else {fill=THEME.pN;edge=THEME.pNe;}
  ctx.save();
  if(p.broken){ctx.globalAlpha=Math.max(0,1-(p.fade||0));}
  if(platStyle==='slab') drawSlab(p,x,y,w,h,fill,edge);
  else if(platStyle==='pill') drawPill(p,x,y,w,h,fill,edge);
  else drawRound(p,x,y,w,h,fill,edge);
  if(p.spring) drawSpring(x,y,w);
  ctx.restore();
}
function itemGlow(){ return itemStyle==='noir'; }
function itemGloss(){ return itemStyle==='pop'; }
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
  var noir=itemStyle==='noir';
  var body=noir?'#2c2622':THEME.accent, edge=THEME.accentDark, flame=noir?THEME.accent:'#ffd45b';
  if(itemGlow()){ctx.shadowColor=THEME.accent;ctx.shadowBlur=8;}
  ctx.fillStyle=body;rr(-9,-12,18,22,5);ctx.fill();ctx.shadowBlur=0;
  ctx.lineWidth=2;ctx.strokeStyle=edge;rr(-9,-12,18,22,5);ctx.stroke();
  ctx.fillStyle=noir?THEME.accent:'#ffffff';ctx.beginPath();ctx.arc(0,-4,3.4,0,6.2832);ctx.fill();
  if(itemGloss()){ctx.fillStyle='rgba(255,255,255,.45)';rr(-6,-10,4,12,2);ctx.fill();}
  ctx.fillStyle=flame;ctx.beginPath();ctx.moveTo(-6,10);ctx.lineTo(0,20);ctx.lineTo(6,10);ctx.closePath();ctx.fill();
  ctx.restore();
}
function drawHeart(it){
  ctx.save();ctx.translate(it.x+it.w/2,it.y+it.h/2);
  var sz=15, c=THEME.accent, e=THEME.accentDark;
  if(itemGlow()){ctx.shadowColor=c;ctx.shadowBlur=9;}
  heartPath(sz);ctx.fillStyle=c;ctx.fill();ctx.shadowBlur=0;
  ctx.lineWidth=1.6;ctx.strokeStyle=e;heartPath(sz);ctx.stroke();
  if(itemGloss()){ctx.fillStyle='rgba(255,255,255,.55)';ctx.beginPath();ctx.ellipse(-sz*0.2,-sz*0.18,sz*0.16,sz*0.10,-0.5,0,6.2832);ctx.fill();}
  ctx.restore();
}
function drawShield(it){
  ctx.save();ctx.translate(it.x+it.w/2,it.y+it.h/2);
  var noir=itemStyle==='noir', w=18,h=22, c=THEME.accent, e=THEME.accentDark;
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
  var noir=itemStyle==='noir';
  var bodyC=noir?'#6a645c':(itemStyle==='pop'?'#e08a72':'#9aa0a6');
  if(itemGlow()){ctx.shadowColor=THEME.accent;ctx.shadowBlur=8;}
  ctx.lineWidth=6;ctx.strokeStyle=bodyC;
  ctx.beginPath();ctx.arc(0,-1,7,Math.PI,0,false);ctx.stroke();
  ctx.beginPath();ctx.moveTo(-7,-1);ctx.lineTo(-7,8);ctx.moveTo(7,-1);ctx.lineTo(7,8);ctx.stroke();
  ctx.shadowBlur=0;
  ctx.lineWidth=6;ctx.strokeStyle=THEME.accent;ctx.beginPath();ctx.moveTo(-7,5);ctx.lineTo(-7,9.5);ctx.stroke();
  ctx.strokeStyle='#dcdcdc';ctx.beginPath();ctx.moveTo(7,5);ctx.lineTo(7,9.5);ctx.stroke();
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
function render(){
  drawBg();
  if(state!=='play' && state!=='pause') return;   // 菜单/结算只显示纯主题背景，不画平台与毛球
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
var audio=new Audio(); audio.loop=true; audio.preload='auto';
var curTrack=null, audioUnlocked=false, muted=store.muted;
audio.volume=muted?0:0.9;
// 手机端解锁：首次用户手势内静音播放再暂停，解锁这个复用的音频元素
function unlockAudioEl(){
  if(audioUnlocked) return; audioUnlocked=true;
  var pv=audio.volume; audio.muted=true;
  try{
    var pr=audio.play();
    if(pr&&pr.then){ pr.then(function(){ try{audio.pause();}catch(e){} audio.muted=false; audio.volume=pv; })
                       .catch(function(){ audio.muted=false; audio.volume=pv; }); }
    else { try{audio.pause();}catch(e){} audio.muted=false; audio.volume=pv; }
  }catch(e){ audio.muted=false; audio.volume=pv; }
}
function loadAudio(t){
  var src=t.audio||null;
  if(src!==curTrack){
    curTrack=src;
    if(src){ audio.src=src; try{audio.load();}catch(e){} }
    else { try{audio.pause();}catch(e){} }
  }
  audio.volume=muted?0:0.9;
}
function ensureAudio(){ if(window.AudioEngine){ AudioEngine.ensure(); AudioEngine.setMuted(muted); } }
function playMusic(){
  if(muted) return;
  if(curTheme && curTheme.synth){ ensureAudio(); if(window.SynthBGM) SynthBGM.start(); return; }
  if(curTrack){ audio.volume=0.9; var pr=audio.play(); if(pr&&pr.catch)pr.catch(function(){}); }
}
function pauseMusic(){ if(window.SynthBGM) SynthBGM.stop(); try{audio.pause();}catch(e){} }
function restartMusic(){
  if(window.SynthBGM) SynthBGM.stop();
  try{ audio.pause(); audio.currentTime=0; }catch(e){}
  playMusic();
}
function pauseMusicKeep(){   // 真正暂停，保留播放进度
  if(window.SynthBGM) SynthBGM.pause();
  try{ audio.pause(); }catch(e){}
}
function resumeMusic(){      // 从暂停处续播
  if(muted) return;
  if(curTheme && curTheme.synth){ if(window.SynthBGM) SynthBGM.resume(); return; }
  if(curTrack){ var pr=audio.play(); if(pr&&pr.catch)pr.catch(function(){}); }
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
  audio.volume=muted?0:0.9;
  if(muted){ pauseMusic(); } else { playMusic(); }
  refreshMute();
}

/* ---------- 主题应用 ---------- */
function setVar(k,v){ document.documentElement.style.setProperty(k,v); }
function applyTheme(t){
  curTheme=t; THEME=t.pal||LIGHT_FALLBACK; var p=THEME;
  sceneStyle=t.scene||'grid'; platStyle=t.plat||'round'; itemStyle=t.item||'classic'; seedDecor();
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
  renderHP();
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
$('ctrlHint').innerHTML=
  '电脑：方向键 或 A / D 控制左右方向<br>手机：按住屏幕左右滑动，越远越快、松手减速';

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
  unlockAudioEl();
  if(!muted) playMusic();
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
  window.addEventListener('load',function(){navigator.serviceWorker.register('sw.js').catch(function(){});});
}
})();
