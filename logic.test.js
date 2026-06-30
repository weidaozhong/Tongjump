const test = require('node:test');
const assert = require('node:assert');
const L = require('./logic.js');

test('coinSettle = runCoins + floor(score/40)', () => {
  assert.strictEqual(L.coinSettle(1000, 20), 45);
  assert.strictEqual(L.coinSettle(0, 0), 0);
  assert.strictEqual(L.coinSettle(39, 5), 5);
  assert.strictEqual(L.coinSettle(4000, 0), 100);
});

test('coinSpawnChance 线性插值并封顶', () => {
  assert.strictEqual(L.coinSpawnChance(0, 0.30, 0.85, 2600), 0.30);
  assert.ok(Math.abs(L.coinSpawnChance(1300, 0.30, 0.85, 2600) - 0.575) < 1e-9);
  assert.ok(Math.abs(L.coinSpawnChance(5200, 0.30, 0.85, 2600) - 0.85) < 1e-9);
});
test('coinValue 高分段翻倍', () => {
  assert.strictEqual(L.coinValue(1999, 2000), 1);
  assert.strictEqual(L.coinValue(2000, 2000), 2);
});

test('jackpotRoll: rand < p 命中', () => {
  assert.strictEqual(L.jackpotRoll(0.05, 0.10), true);
  assert.strictEqual(L.jackpotRoll(0.10, 0.10), false);
  assert.strictEqual(L.JACKPOT_VAL, 70);
});

test('frenzyOnPickup: 任意拾取都接管→切到该类型并满时长(异类不再被忽略)', () => {
  assert.deepStrictEqual(L.frenzyOnPickup('h', 360), { frames: 360, type: 'h' });
  assert.deepStrictEqual(L.frenzyOnPickup('c', 360), { frames: 360, type: 'c' });
  assert.strictEqual(L.FRENZY_DUR, 360);
});

test('jetRefreshesFrenzy: 每次高度狂暴仅第一个喷气刷新狂暴', () => {
  assert.strictEqual(L.jetRefreshesFrenzy(120, 'h', false), true);
  assert.strictEqual(L.jetRefreshesFrenzy(120, 'h', true), false);
  assert.strictEqual(L.jetRefreshesFrenzy(120, 'c', false), false);
  assert.strictEqual(L.jetRefreshesFrenzy(0, 'h', false), false);
});

test('effectiveCoinVal: 仅金币狂暴生效期翻倍', () => {
  assert.strictEqual(L.effectiveCoinVal(2, 100, 'c'), 4);
  assert.strictEqual(L.effectiveCoinVal(2, 0, 'c'), 2);
  assert.strictEqual(L.effectiveCoinVal(2, 100, 'h'), 2);
  assert.strictEqual(L.effectiveCoinVal(70, 100, 'c'), 140);
});

test('canBuyConsumable: 钱够且未达上限', () => {
  assert.strictEqual(L.canBuyConsumable(100, 100, 0, 1), true);
  assert.strictEqual(L.canBuyConsumable(99, 100, 0, 1), false);
  assert.strictEqual(L.canBuyConsumable(100, 100, 1, 1), false);
});
test('shouldRevive: 有库存且本局未用过', () => {
  assert.strictEqual(L.shouldRevive(1, false), true);
  assert.strictEqual(L.shouldRevive(0, false), false);
  assert.strictEqual(L.shouldRevive(1, true), false);
});

test('pageInfo: 分组切片与夹取', () => {
  assert.deepStrictEqual(L.pageInfo(6,0,6), {pages:1,page:0,start:0,end:6});
  assert.deepStrictEqual(L.pageInfo(8,1,6), {pages:2,page:1,start:6,end:8});
  assert.deepStrictEqual(L.pageInfo(8,9,6), {pages:2,page:1,start:6,end:8});
  assert.deepStrictEqual(L.pageInfo(8,-2,6), {pages:2,page:0,start:0,end:6});
  assert.deepStrictEqual(L.pageInfo(0,0,6), {pages:1,page:0,start:0,end:0});
});
