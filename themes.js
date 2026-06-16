/* 主题配置：每个主题 = 一张卡片封面 + 可选歌曲 + 配色。
   字段：
     photo:false  表示不把封面铺成游戏背景（用纯色纸面），封面只作选择卡片缩略图。
     audio:null   表示该主题无音乐。
   增量添加：以后每做好一个主题，往这个数组里追加一项即可。 */
window.THEMES = [
  {
    id: 'classic',
    name: '经典',
    artist: '原版 · 无音乐',
    cover: 'themes/covers/classic.jpg?v=2',
    audio: null,
    synth: true,
    photo: false,
    dark: false,
    scene: 'grid', plat: 'round', item: 'classic',
    pal: {
      bg:'#fff7ed',
      dimTop:'rgba(255,247,237,0)', dimBot:'rgba(255,247,237,0)',
      grid:'#efe3cf',
      pN:'#a8d84f', pNe:'#6f9a2e',
      pM:'#7fc8f0', pMe:'#3f93c8',
      pB:'#c79b6a', pBe:'#8c6438',
      spring:'#ffcf5b', springEdge:'#c89a2e',
      accent:'#ff9a6c', accentDark:'#e07a48',
      ink:'#3a3027', sub:'#8a7c66',
      score:'#3a3027', scoreShadow:'rgba(0,0,0,0.4)',
      card:'#ffffff', cardBorder:'#efe2cc',
      ctrlBg:'rgba(255,255,255,0.8)', ctrlBd:'#e7dccb',
      particleBreak:'#c79b6a'
    }
  },
  {
    id: 'even_in_the_dark',
    name: 'Even in the Dark',
    artist: 'DOUDOU · 电影《匿杀》',
    cover: 'themes/covers/even_in_the_dark.jpg?v=2',
    audio: 'themes/audio/even_in_the_dark.mp3?v=96',
    photo: false,
    dark: true,
    scene: 'embers', plat: 'slab', item: 'noir',
    pal: {
      bg:'#1b1714',
      dimTop:'rgba(255,255,255,0.02)', dimBot:'rgba(0,0,0,0.22)',
      grid:'rgba(255,255,255,0.07)',
      rim:'#f4eee6',
      pN:'#ece7e1', pNe:'#a9a098',
      pM:'#93acc4', pMe:'#566f86',
      pB:'#c0473b', pBe:'#7e2820',
      spring:'#ffcf5b', springEdge:'#c89a2e',
      accent:'#e23a32', accentDark:'#a4231d',
      ink:'#f2ede8', sub:'#c7bcae',
      score:'#f5efe8', scoreShadow:'rgba(0,0,0,0.55)',
      card:'#241f1c', cardBorder:'#3a322d',
      ctrlBg:'rgba(255,255,255,0.12)', ctrlBd:'rgba(255,255,255,0.34)',
      particleBreak:'#c0473b'
    }
  },
  {
    id: 'fearless',
    name: 'Fearless',
    artist: '福禄寿 FloruitShow',
    cover: 'themes/covers/fearless.jpg?v=2',
    audio: 'themes/audio/fearless.mp3?v=96',
    photo: false,
    dark: false,
    scene: 'bubbles', plat: 'pill', item: 'pop',
    pal: {
      bg:'#f7f2ef',
      dimTop:'rgba(247,242,239,0)', dimBot:'rgba(247,242,239,0)',
      grid:'#ecdcd5',
      pN:'#f3826b', pNe:'#cb5440',
      pM:'#8ba2bf', pMe:'#566f8c',
      pB:'#e0b48d', pBe:'#b07f53',
      spring:'#ffcf5b', springEdge:'#c89a2e',
      accent:'#ef5a4a', accentDark:'#cf3d33',
      ink:'#2c2622', sub:'#8a7d74',
      score:'#2c2622', scoreShadow:'rgba(0,0,0,0.32)',
      card:'#ffffff', cardBorder:'#efddd5',
      ctrlBg:'rgba(255,255,255,0.8)', ctrlBd:'#ecdcd3',
      particleBreak:'#e0b48d'
    }
  },
  {
    id: 'how_remix',
    name: '如何 (Blue Foundation Remix)',
    artist: '福禄寿 FloruitShow x Blue Foundation',
    cover: 'themes/covers/how_remix.jpg?v=2',
    audio: 'themes/audio/how_remix.mp3?v=96',
    photo: false,
    dark: false,
    scene: 'waves', plat: 'wave', item: 'aqua',
    pal: {
      bg:'#cdd6ec',
      dimTop:'rgba(255,255,255,0)', dimBot:'rgba(120,150,175,0.10)',
      grid:'rgba(255,255,255,0.06)',
      pN:'#86b6ee', pNe:'#4666a6',
      pM:'#a673cf', pMe:'#6e419e',
      pB:'#f2a085', pBe:'#c2603c',
      spring:'#f4be3e', springEdge:'#bd8e2a',
      accent:'#e2718e', accentDark:'#b94e6c',
      ink:'#37314a', sub:'#6f6a86',
      score:'#39324c', scoreShadow:'rgba(255,255,255,0.5)',
      card:'#ffffff', cardBorder:'#e2d8ee',
      ctrlBg:'rgba(255,255,255,0.82)', ctrlBd:'#d8cfe6',
      particleBreak:'#f2a085'
    }
  },
  {
    id: 'chaoduwo',
    name: '超度我',
    artist: '福禄寿 FloruitShow',
    cover: 'themes/covers/chaoduwo.jpg?v=1',
    audio: 'themes/audio/chaoduwo.mp3?v=96',
    photo: false,
    dark: true,
    scene: 'souls', plat: 'tablet', item: 'relic',
    pal: {
      bg:'#103a44',
      dimTop:'rgba(190,245,238,0.03)', dimBot:'rgba(6,28,34,0.10)',
      grid:'rgba(120,220,210,0.06)',
      rim:'#dff5ef',
      pN:'#cda259', pNe:'#8a5e1f',
      pM:'#80dcc8', pMe:'#43998a',
      pB:'#c4544a', pBe:'#7c2c22',
      spring:'#b07cd8', springEdge:'#7e52a8',
      accent:'#43d8c4', accentDark:'#1f8e84',
      ui:'#d49a48', uiDark:'#a06a1e',
      ink:'#eaf6f2', sub:'#a9cfc8',
      score:'#eef9f5', scoreShadow:'rgba(0,0,0,0.5)',
      card:'#13313c', cardBorder:'#225a5e',
      ctrlBg:'rgba(180,240,235,0.12)', ctrlBd:'rgba(180,240,235,0.34)',
      particleBreak:'#5fe0cc'
    }
  }
];
window.DEFAULT_THEME = 'classic';
