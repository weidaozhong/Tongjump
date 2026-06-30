/* logic.js — 纯经济/道具逻辑（无 DOM）。浏览器挂 window.MQLogic；Node 可 require。 */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory();
  else root.MQLogic = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  var FRENZY_DUR = 360, JACKPOT_P = 0.10, JACKPOT_VAL = 70;

  function coinSettle(score, runCoins) { return runCoins + Math.floor(score / 40); }
  function coinSpawnChance(score, p0, p1, ramp) { return p0 + Math.min(score / ramp, 1) * (p1 - p0); }
  function coinValue(score, goldScore) { return score >= goldScore ? 2 : 1; }
  function jackpotRoll(rand, p) { return rand < p; }
  function frenzyOnPickup(pickType, dur) {
    return { frames: dur, type: pickType };   // 任意拾取都接管: 切到该类型并满时长(异类不再被忽略/白吃)
  }
  function effectiveCoinVal(baseVal, frenzyFrames, frenzyType) {
    return baseVal * ((frenzyFrames > 0 && frenzyType === 'c') ? 2 : 1);
  }
  function jetRefreshesFrenzy(frenzyFrames, frenzyType, refreshUsed) {
    return frenzyFrames > 0 && frenzyType === 'h' && !refreshUsed;   // 每次高度狂暴只允许一个喷气刷新时长
  }
  function canBuyConsumable(coins, price, invCount, cap) { return coins >= price && invCount < cap; }
  function shouldRevive(invRevive, reviveUsed) { return invRevive > 0 && !reviveUsed; }
  function pageInfo(total, page, perPage) {
    var pages = Math.max(1, Math.ceil(total / perPage));
    if (page >= pages) page = pages - 1;
    if (page < 0) page = 0;
    var start = page * perPage, end = Math.min(start + perPage, total);
    return { pages: pages, page: page, start: start, end: end };
  }

  return {
    FRENZY_DUR: FRENZY_DUR, JACKPOT_P: JACKPOT_P, JACKPOT_VAL: JACKPOT_VAL,
    coinSettle: coinSettle, coinSpawnChance: coinSpawnChance, coinValue: coinValue,
    jackpotRoll: jackpotRoll, frenzyOnPickup: frenzyOnPickup, effectiveCoinVal: effectiveCoinVal,
    jetRefreshesFrenzy: jetRefreshesFrenzy,
    canBuyConsumable: canBuyConsumable, shouldRevive: shouldRevive, pageInfo: pageInfo
  };
});
