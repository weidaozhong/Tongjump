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
    cover: 'themes/covers/classic.jpg',
    audio: null,
    synth: true,
    photo: false,
    dark: false,
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
    cover: 'themes/covers/even_in_the_dark.jpg',
    audio: 'themes/audio/even_in_the_dark.mp3',
    photo: false,
    dark: true,
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
  }
];
window.DEFAULT_THEME = 'classic';
