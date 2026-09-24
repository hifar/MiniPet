const STORAGE_KEY = 'minipet-save-v2';
const OLD_STORAGE_KEY = 'minipet-save-v1';
const STAT_NAMES = { hunger: '饱腹', happy: '心情', clean: '清洁', energy: '体力', health: '健康' };
const STAT_COLORS = { hunger: '#edab70', happy: '#e792ae', clean: '#8ac9d4', energy: '#ad9bd4', health: '#91c99f' };
const $ = selector => document.querySelector(selector);
const esc = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const clamp = value => Math.max(0, Math.min(100, value));
const safeName = (value, fallback) => String(value || '').trim().slice(0, 12) || fallback;
const newTraits = () => Object.fromEntries(TRAITS.map(item => [item.id, 0]));
let state = loadState();
let view = state ? 'home' : 'adopt';
let selection = 0;
let diaryPage = 0;
let statusPage = 0;
let catalogPage = 0;
let game = null;
let rhythmTimer = null;
let toastTimer = null;
let audioContext;
let interaction = null;
let lastMotion = '';

function loadState() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || localStorage.getItem(OLD_STORAGE_KEY));
    if (!raw || !PET_BY_ID[raw.petId] || !raw.stats) return null;
    return {
      petId: raw.petId, name: safeName(raw.name, PET_BY_ID[raw.petId].name),
      bornAt: Number.isFinite(raw.bornAt) ? raw.bornAt : Date.now(),
      lastUpdated: Number.isFinite(raw.lastUpdated) ? raw.lastUpdated : Date.now(),
      stats: Object.fromEntries(Object.keys(STAT_NAMES).map(key => [key, clamp(Number(raw.stats[key]) || 0)])),
      xp: Number.isFinite(raw.xp) ? raw.xp : Math.min(30, (raw.careCount || 0) * 2),
      traits: Object.fromEntries(TRAITS.map(item => [item.id, Math.max(0, Number(raw.traits?.[item.id]) || 0)])),
      form: raw.form && MUTATION_BY_ID[raw.form] ? raw.form : null,
      discovered: [...new Set([...(Array.isArray(raw.discovered) ? raw.discovered : []), raw.form].filter(id => MUTATION_BY_ID[id]))],
      lastMutationCare: Number.isFinite(raw.lastMutationCare) ? raw.lastMutationCare : (raw.careCount || 0),
      coins: Number.isFinite(raw.coins) ? Math.max(0, raw.coins) : 30,
      place: PLACE_BY_ID[raw.place] ? raw.place : 'home',
      sleeping: !!raw.sleeping, sleepSince: Number.isFinite(raw.sleepSince) ? raw.sleepSince : raw.lastUpdated,
      sound: raw.sound !== false, careCount: Number.isFinite(raw.careCount) ? raw.careCount : 0,
      diary: Array.isArray(raw.diary) ? raw.diary.slice(0, 30) : []
    };
  } catch { return null; }
}
function saveState() {
  if (!state) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    $('#saveDot').classList.remove('error');
    $('#saveDot').title = '进度已自动保存';
  } catch {
    $('#saveDot').classList.add('error');
    $('#saveDot').title = '浏览器无法保存进度';
  }
}
function log(message, icon = '✦') {
  state.diary.unshift({ message, icon, at: Date.now() });
  state.diary = state.diary.slice(0, 30);
}
function dayNumber() { return Math.max(1, Math.floor((Date.now() - state.bornAt) / 86400000) + 1); }
function stageIndex() {
  let index = 0;
  STAGES.forEach((stage, i) => { if (state.xp >= stage.xp) index = i; });
  return index;
}
function pickWeighted(items, random = Math.random) {
  const total = items.reduce((sum, item) => sum + item.weight, 0);
  let roll = random() * total;
  for (const item of items) { roll -= item.weight; if (roll < 0) return item.form; }
  return items.at(-1)?.form;
}
function evolve(allowRoll = false) {
  if (!allowRoll || stageIndex() < 2) return;
  const dominant = TRAITS.reduce((winner, item) => state.traits[item.id] > state.traits[winner.id] ? item : winner);
  if (state.traits[dominant.id] < 12) return;
  if (state.form && state.careCount - state.lastMutationCare < 8) return;
  const candidates = MUTATIONS.filter(form => form.id !== state.form && (form.trait === dominant.id || form.wild))
    .map(form => ({ form, weight: form.weight * (form.trait === dominant.id ? 1 : .15) }));
  const next = pickWeighted(candidates);
  if (!next) return;
  state.form = next.id;
  state.lastMutationCare = state.careCount;
  if (!state.discovered.includes(next.id)) state.discovered.push(next.id);
  log(`${state.name}变成了「${next.name}」！${next.rarity === '传说' ? '传说形态出现了！' : ''}`, next.icon);
}
function gain(xp, trait, amount = 0) {
  const before = stageIndex();
  state.xp += xp;
  if (trait && Object.hasOwn(state.traits, trait)) state.traits[trait] += amount;
  if (stageIndex() !== before) log(`${state.name}长大了，进入${STAGES[stageIndex()].name}期！`, '★');
  evolve(true);
}
function updateTime() {
  if (!state) return;
  const now = Date.now();
  const hours = Math.min(Math.max((now - state.lastUpdated) / 3600000, 0), 72);
  if (hours < 1 / 60) return;
  const s = state.stats;
  const sleptBefore = state.sleeping ? Math.max(0, (state.lastUpdated - state.sleepSince) / 3600000) : 0;
  const sleepHours = state.sleeping ? Math.min(hours, Math.max(0, 8 - sleptBefore)) : 0;
  const awakeHours = hours - sleepHours;
  s.hunger = clamp(s.hunger - 3.1 * hours);
  s.clean = clamp(s.clean - 1.5 * hours);
  s.happy = clamp(s.happy - 2 * awakeHours - .7 * sleepHours);
  s.energy = clamp(s.energy - 2.9 * awakeHours + 12 * sleepHours);
  const low = [s.hunger, s.clean, s.happy, s.energy].filter(value => value < 20).length;
  s.health = clamp(s.health - low * 2.2 * hours + (low ? 0 : .2 * hours));
  state.xp += Math.min(hours * .15, 3);
  evolve();
  if (state.sleeping && now - state.sleepSince >= 8 * 3600000) {
    state.sleeping = false; state.sleepSince = null;
    log(`${state.name}睡醒啦，乌沙奇给它盖好了被子。`, '☀');
  }
  if (now - state.lastUpdated >= 3 * 3600000) log(`乌沙奇一直陪着${state.name}等你回来。`, '♥');
  state.lastUpdated = now;
  saveState();
}
function moodText() {
  const s = state.stats;
  if (state.sleeping) return '呼呼……乌沙奇在守护梦境。';
  if (s.health < 25) return '有点不舒服，想要看护。';
  if (s.hunger < 25) return '肚子咕咕叫啦！';
  if (s.clean < 25) return '想洗个香香的澡。';
  if (s.energy < 25) return '困困的，想睡一觉。';
  if (s.happy < 25) return '陪我玩一会儿吧？';
  return ['乌沙奇说：今天也要开心！', '我们一起去冒险吧 ✦', '今天会有什么新发现？'][Math.floor(Date.now() / 180000) % 3];
}
function drawSprite(canvas, rows, palette) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 16, 16);
  rows.forEach((row, y) => [...row].slice(0, 16).forEach((pixel, x) => {
    if (pixel !== '.' && palette[pixel]) { ctx.fillStyle = palette[pixel]; ctx.fillRect(x, y, 1, 1); }
  }));
  return ctx;
}
// 头饰像素按形态配置组合；身体配色、头饰和轮廓共同区分 50 种形态。
const MOTIF_PIXELS = {
  bow: '4,2 5,1 6,2 7,2 8,2 9,1 10,2',
  berry: '6,1 7,0 8,0 9,1 7,2 8,2',
  crown: '4,2 4,0 6,1 7,0 8,0 9,1 11,0 11,2 5,2 6,2 7,2 8,2 9,2 10,2',
  flower: '7,0 6,1 8,1 7,2 5,2 9,2',
  antenna: '4,0 4,1 5,2 11,0 11,1 10,2',
  wings: '0,5 1,4 1,6 2,7 14,7 15,6 15,4 14,5',
  halo: '5,0 6,0 7,0 8,0 9,0 10,0 4,1 11,1',
  dots: '3,3 12,3 2,6 13,6 4,10 11,10',
  heart: '6,0 9,0 5,1 7,1 8,1 10,1 6,2 9,2 7,3 8,3',
  rainbow: '3,2 4,1 5,0 6,0 7,0 8,0 9,0 10,0 11,1 12,2 4,3 11,3',
  sprout: '7,0 8,0 7,1 8,1 6,2 9,2',
  antlers: '3,0 3,1 4,2 5,2 10,2 11,2 12,1 12,0 2,1 13,1',
  cap: '4,1 5,0 6,0 7,0 8,0 9,0 10,0 11,1 3,2 12,2',
  leaf: '5,1 6,0 7,0 8,1 7,2 6,2 9,2',
  branch: '3,0 4,1 5,2 12,0 11,1 10,2 2,1 13,1',
  bubbles: '2,2 3,1 4,2 12,1 13,2 12,3 1,5',
  wave: '2,2 3,1 4,2 5,1 6,2 9,2 10,1 11,2 12,1 13,2',
  crystal: '7,0 8,0 6,1 9,1 5,2 10,2 7,3 8,3',
  fins: '1,5 2,4 3,3 3,5 12,5 12,3 13,4 14,5',
  spiral: '6,0 7,0 8,0 9,1 9,2 8,3 7,3 7,2',
  star: '7,0 8,0 7,1 8,1 5,2 6,2 9,2 10,2 7,3 8,3',
  trail: '3,0 5,1 7,0 9,1 11,0 12,2 13,3',
  burst: '2,1 4,0 6,1 7,0 8,0 9,1 11,0 13,1 7,3 8,3',
  moon: '6,0 7,0 5,1 5,2 6,3 7,3 8,2'
};
function drawMutationMotif(ctx, mutation) {
  const pixels = MOTIF_PIXELS[mutation.motif] || MOTIF_PIXELS.star;
  ctx.fillStyle = mutation.accent;
  pixels.split(' ').forEach(point => { const [x, y] = point.split(',').map(Number); ctx.fillRect(x, y, 1, 1); });
  ctx.fillStyle = mutation.cheek;
  ctx.fillRect(3, 8, 1, 1); ctx.fillRect(12, 8, 1, 1);
}
function drawPet(canvas, pet = PET_BY_ID[state?.petId] || PETS[0], preview = false, pose = 'idle') {
  const stage = preview || !state ? 0 : stageIndex();
  const mutation = !preview && state?.form ? MUTATION_BY_ID[state.form] : null;
  const palette = { ...pet.palette };
  if (mutation) { palette.b = mutation.body; palette.s = mutation.cheek; palette.o = mutation.line; }
  const sprite = stage === 0 ? pet.baby : (stage >= 3 && pet.adult) ? pet.adult : (stage >= 2 && pet.teen) ? pet.teen : pet.grown;
  const ctx = drawSprite(canvas, sprite, palette);
  if (!ctx) return;
  if (stage >= 2 && mutation) drawMutationMotif(ctx, mutation);
  if (stage >= 3) { ctx.fillStyle = '#fff6cd'; ctx.fillRect(1, 8, 1, 2); ctx.fillRect(14, 8, 1, 2); }
  if (preview) return;
  const eyes = [];
  sprite.forEach((row, y) => [...row].forEach((pixel, x) => { if (pixel === 'e') eyes.push([x, y]); }));
  if (['blink', 'sleep', 'happy', 'nibble', 'look'].includes(pose)) {
    eyes.forEach(([x, y], index) => {
      ctx.fillStyle = palette.b;
      ctx.fillRect(x, y, 1, 1);
      ctx.fillStyle = pose === 'sleep' || pose === 'blink' || pose === 'happy' ? palette.o : palette.e;
      ctx.fillRect(pose === 'look' ? Math.min(14, x + 1) : x, pose === 'sleep' || pose === 'blink' || pose === 'happy' ? y + 1 : y, 1, 1);
      if (pose === 'happy' && index === 0) { ctx.fillStyle = '#fff8e7'; ctx.fillRect(x - 1, y - 2, 1, 1); }
    });
  }
  if (pose === 'nibble') {
    ctx.fillStyle = palette.b; ctx.fillRect(7, 10, 2, 2);
    ctx.fillStyle = palette.o; ctx.fillRect(7, 10, 1, 1); ctx.fillRect(8, 11, 1, 1);
  } else if (pose === 'surprise') {
    ctx.fillStyle = palette.o; ctx.fillRect(7, 10, 2, 2);
    ctx.fillStyle = '#fff8e7'; ctx.fillRect(6, 7, 1, 1); ctx.fillRect(10, 7, 1, 1);
  }
}
function drawUsagi(canvas, pose = 'idle') {
  const rows = ['cheer', 'wave', 'dance'].includes(pose) ? USAGI.cheer : USAGI.idle;
  const ctx = drawSprite(canvas, rows, USAGI.palette);
  if (!ctx) return;
  if (pose === 'sleep' || pose === 'wink' || pose === 'sing') {
    ctx.fillStyle = USAGI.palette.y;
    ctx.fillRect(5, 7, 1, 1); ctx.fillRect(10, 7, 1, 1);
    ctx.fillStyle = USAGI.palette.o;
    if (pose === 'sleep') { ctx.fillRect(5, 8, 1, 1); ctx.fillRect(10, 8, 1, 1); }
    else if (pose === 'wink') ctx.fillRect(5, 8, 1, 1);
    else { ctx.fillRect(7, 10, 2, 2); }
  }
}
function drawCanvases() {
  document.querySelectorAll('canvas[data-pet]').forEach(canvas => drawPet(canvas, PET_BY_ID[canvas.dataset.pet], canvas.dataset.preview === 'true'));
  document.querySelectorAll('canvas[data-usagi]').forEach(canvas => drawUsagi(canvas));
}
function beep() {
  if (!state?.sound) return;
  try {
    audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioContext.createOscillator(); const gainNode = audioContext.createGain();
    osc.type = 'square'; osc.frequency.value = 650;
    gainNode.gain.setValueAtTime(.018, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(.001, audioContext.currentTime + .13);
    osc.connect(gainNode).connect(audioContext.destination); osc.start(); osc.stop(audioContext.currentTime + .14);
  } catch { /* 音频不可用时不影响操作 */ }
}
function toast(message) {
  const viewElement = $('#screenView');
  viewElement.querySelector('.screen-toast')?.remove();
  const box = document.createElement('div'); box.className = 'screen-toast'; box.textContent = message;
  viewElement.append(box);
  clearTimeout(toastTimer); toastTimer = setTimeout(() => box.remove(), 2200);
}
const ACTION_EFFECTS = {
  snack: ['✦', '♥', '✦'], chase: ['●', '✦', '●'], sing: ['♪', '♫', '♪'],
  cuddle: ['♥', '♥', '✿'], dance: ['✦', '✧', '✦'], bath: ['○', '◌', '○'],
  sleep: ['z', 'Z', 'z'], wake: ['☀', '✦', '☀'], heal: ['✚', '♥', '✚'],
  travel: ['✦', '✧', '✦'], explore: ['✿', '✦', '✿']
};
function startInteraction(kind = 'cuddle') {
  interaction = { kind, started: performance.now(), duration: kind === 'sleep' ? 2200 : 2600 };
  lastMotion = '';
  const scene = $('.pixel-scene');
  if (!scene) return;
  scene.querySelector('.action-effects')?.remove();
  const effects = document.createElement('div');
  effects.className = `action-effects effect-${kind}`;
  effects.setAttribute('aria-hidden', 'true');
  (ACTION_EFFECTS[kind] || ACTION_EFFECTS.cuddle).forEach(symbol => {
    const spark = document.createElement('span'); spark.textContent = symbol; effects.append(spark);
  });
  scene.append(effects);
  animateHome();
}
function animateHome() {
  if (view !== 'home' || document.hidden || !state) return;
  const petStage = $('.pet-stage');
  const usagiStage = $('.usagi-stage');
  if (!petStage || !usagiStage) return;
  const now = performance.now();
  if (interaction && now - interaction.started >= interaction.duration) {
    interaction = null;
    $('.action-effects')?.remove();
    lastMotion = '';
  }
  const step = Math.floor(now / 180);
  let motion, petPose, usagiPose;
  if (interaction) {
    motion = interaction.kind;
    const sequence = {
      snack: ['look', 'surprise', 'nibble', 'nibble', 'happy'],
      chase: ['surprise', 'look', 'happy', 'look', 'happy'],
      sing: ['look', 'happy', 'blink', 'happy'],
      cuddle: ['surprise', 'happy', 'blink', 'happy'],
      dance: ['happy', 'look', 'happy', 'blink'],
      bath: ['surprise', 'blink', 'happy', 'blink'],
      sleep: ['blink', 'sleep', 'sleep', 'sleep'],
      wake: ['sleep', 'blink', 'surprise', 'happy'],
      heal: ['blink', 'happy', 'surprise', 'happy'],
      travel: ['look', 'surprise', 'happy', 'look'],
      explore: ['look', 'surprise', 'look', 'happy']
    }[motion] || ['happy'];
    petPose = sequence[Math.floor((now - interaction.started) / 380) % sequence.length];
    usagiPose = ({ snack: 'wave', chase: 'cheer', sing: 'sing', cuddle: 'wink', dance: 'dance', bath: 'wave', sleep: 'sleep', wake: 'cheer', heal: 'wave', travel: 'cheer', explore: 'wink' })[motion] || 'cheer';
  } else if (state.sleeping) {
    motion = 'rest'; petPose = 'sleep'; usagiPose = step % 28 < 2 ? 'sleep' : 'idle';
  } else {
    const idleCycle = Math.floor(now / 4600) % 4;
    motion = ['idle', 'curious', 'idle', 'stretch'][idleCycle];
    petPose = step % 25 === 0 ? 'blink' : motion === 'curious' ? 'look' : motion === 'stretch' ? 'happy' : 'idle';
    usagiPose = step % 31 === 0 ? 'wink' : motion === 'curious' ? 'wave' : 'idle';
  }
  if (motion !== lastMotion || petStage.dataset.motion !== motion) {
    petStage.dataset.motion = motion;
    usagiStage.dataset.motion = motion;
    lastMotion = motion;
  }
  drawPet(petStage.querySelector('canvas'), PET_BY_ID[state.petId], false, petPose);
  drawUsagi(usagiStage.querySelector('canvas'), usagiPose);
}
function finishAction(message, icon, xp, trait, traitGain = 0, motion = 'cuddle') {
  state.careCount++;
  gain(xp, trait, traitGain);
  log(message, icon);
  state.lastUpdated = Date.now();
  saveState(); open('home'); startInteraction(motion); toast(message); beep();
}
function canAct(energy = 0) {
  if (state.sleeping) { toast('先叫醒小伙伴吧'); return false; }
  if (state.stats.energy < energy) { toast('体力不足，先休息一下'); return false; }
  return true;
}
function feed(food) {
  updateTime();
  if (!canAct()) return;
  if (state.stats.hunger >= 96) return toast('已经吃得饱饱啦');
  if (state.coins < food.cost) return toast('星币不够，玩游戏可以获得');
  state.coins -= food.cost;
  state.stats.hunger = clamp(state.stats.hunger + food.hunger);
  state.stats.happy = clamp(state.stats.happy + (food.happy || 0) + (PET_BY_ID[state.petId].favorite === food.name ? 5 : 0));
  state.stats.energy = clamp(state.stats.energy + (food.energy || 0));
  state.stats.clean = clamp(state.stats.clean - 3);
  finishAction(`乌沙奇喂${state.name}吃了${food.name}！`, food.icon, 5, food.trait, food.traitGain, 'snack');
}
function play(kind) {
  updateTime(); if (!canAct(kind === 'pat' ? 0 : 10)) return;
  const actions = {
    ball: { message: '一起追着彩球跑！', icon: '●', happy: 22, energy: -12, hunger: -7, trait: 'nature', gain: 2, xp: 7 },
    song: { message: '乌沙奇唱起奇妙的歌！', icon: '♫', happy: 19, energy: -7, hunger: -4, trait: 'star', gain: 2, xp: 6 },
    pat: { message: '被乌沙奇摸摸头啦！', icon: '♥', happy: 13, energy: 0, hunger: 0, trait: 'sweet', gain: 2, xp: 3 },
    dance: { message: '跳了一支摇摆舞！', icon: '✦', happy: 27, energy: -16, hunger: -8, trait: 'star', gain: 3, xp: 8 }
  }[kind];
  state.stats.happy = clamp(state.stats.happy + actions.happy);
  state.stats.energy = clamp(state.stats.energy + actions.energy);
  state.stats.hunger = clamp(state.stats.hunger + actions.hunger);
  state.stats.clean = clamp(state.stats.clean - 4);
  finishAction(actions.message, actions.icon, actions.xp, actions.trait, actions.gain, { ball: 'chase', song: 'sing', pat: 'cuddle', dance: 'dance' }[kind]);
}
function care(kind) {
  updateTime();
  if (kind !== 'sleep' && !canAct()) return;
  if (kind === 'clean') {
    if (state.stats.clean >= 96) return toast('已经干干净净啦');
    state.stats.clean = clamp(state.stats.clean + 44);
    state.stats.happy = clamp(state.stats.happy + 4);
    finishAction(`乌沙奇给${state.name}洗了香香澡！`, '✿', 5, 'ocean', 2, 'bath');
  } else if (kind === 'sleep') {
    state.sleeping = !state.sleeping;
    state.sleepSince = state.sleeping ? Date.now() : null;
    if (!state.sleeping) state.stats.energy = clamp(state.stats.energy + 6);
    finishAction(state.sleeping ? `乌沙奇哄${state.name}睡觉了。` : `${state.name}醒来了！`, '☾', 3, 'cozy', 2, state.sleeping ? 'sleep' : 'wake');
  } else if (kind === 'heal') {
    if (state.stats.health >= 96) return toast('小伙伴现在很健康');
    state.stats.health = clamp(state.stats.health + 32);
    finishAction(`乌沙奇照顾了${state.name}。`, '✚', 5, 'cozy', 2, 'heal');
  }
}
function travel(place) {
  updateTime(); if (!canAct(place.id === state.place ? 0 : 6)) return;
  if (place.id === state.place) return toast('已经在这里啦');
  state.place = place.id;
  state.stats.energy = clamp(state.stats.energy - 6);
  state.stats.happy = clamp(state.stats.happy + 6);
  finishAction(`乌沙奇带${state.name}到了${place.name}。`, place.icon, 4, place.trait, 1, 'travel');
}
function placeActivity() {
  updateTime(); if (!canAct(12)) return;
  const place = PLACE_BY_ID[state.place];
  const found = 3 + Math.floor(Math.random() * 6);
  state.coins += found;
  state.stats.energy = clamp(state.stats.energy - 12);
  state.stats.hunger = clamp(state.stats.hunger - 6);
  state.stats.happy = clamp(state.stats.happy + 13);
  finishAction(`${place.activity}，找到 ${found} 枚星币！`, place.icon, 7, place.trait, 3, 'explore');
}
function menuOptions() {
  switch (view) {
    case 'home': return [
      ['照顾', '♥', '乌沙奇来帮忙', () => open('care')], ['出门', '⌂', '去新的场地', () => open('places')],
      ['游戏', '✦', '赢星币', () => open('games')], ['状态', '▤', '成长与变异', () => open('status')],
      ['日记', '✎', '陪伴记录', () => open('diary')], ['设置', '⚙', '名字与声音', () => open('settings')]
    ];
    case 'care': return [
      ['食物', '▰', '选择不同口味', () => open('food')], ['陪玩', '✦', '一起玩', () => open('play')],
      ['洗澡', '✿', '清洁 +44', () => care('clean')], [state.sleeping ? '叫醒' : '睡觉', '☾', '恢复体力', () => care('sleep')],
      ['看护', '✚', '健康 +32', () => care('heal')], ['场地活动', '♣', PLACE_BY_ID[state.place].activity, placeActivity],
      ['返回', '↶', '回到小屋', () => open('home')]
    ];
    case 'food': return [...FOODS.map(food => [food.name, food.icon, `${food.cost} 星币 · ${TRAIT_BY_ID[food.trait].name}倾向`, () => feed(food)]), ['返回', '↶', '照顾菜单', () => open('care')]];
    case 'play': return [
      ['彩球', '●', '活泼与自然', () => play('ball')], ['唱歌', '♫', '星光倾向', () => play('song')],
      ['摸摸头', '♥', '甜蜜倾向', () => play('pat')], ['跳舞', '✦', '快乐加倍', () => play('dance')],
      ['返回', '↶', '照顾菜单', () => open('care')]
    ];
    case 'places': return [...PLACES.map(place => [place.name, place.icon, place.id === state.place ? '当前场地' : '旅行耗 6 体力', () => travel(place)]), ['返回', '↶', '回到主页', () => open('home')]];
    case 'games': return [
      ['猜宝箱', '▣', '选中惊喜宝箱', startBoxGame], ['节奏拍拍', '♫', '在黄色区域按确认', startRhythmGame],
      ['场地活动', '♣', PLACE_BY_ID[state.place].activity, placeActivity], ['返回', '↶', '回到主页', () => open('home')]
    ];
    case 'settings': return [
      ['改名字', '✎', '给它新称呼', () => open('rename')], [state.sound ? '声音：开' : '声音：关', '♫', '切换提示音', () => { state.sound = !state.sound; saveState(); render(); beep(); }],
      ['变异图鉴', '✦', `已发现 ${state.discovered.length} / ${MUTATIONS.length}`, () => open('catalog')],
      ['重新领养', '✿', '清除当前进度', () => open('reset')], ['返回', '↶', '回到主页', () => open('home')]
    ];
    case 'reset': return [
      ['保留宠物', '♥', '继续陪伴', () => open('settings')],
      ['确认重来', '✕', '清除存档', () => { try { localStorage.removeItem(STORAGE_KEY); localStorage.removeItem(OLD_STORAGE_KEY); } catch {} state = null; open('adopt'); }]
    ];
    default: return [];
  }
}
function open(next) {
  stopRhythm();
  if (next !== 'home') { interaction = null; lastMotion = ''; }
  view = next; selection = 0;
  if (next === 'status') statusPage = 0;
  if (next === 'catalog') catalogPage = 0;
  render();
}
function menuMarkup(title) {
  const options = menuOptions();
  const page = Math.floor(selection / 4);
  const visible = options.slice(page * 4, page * 4 + 4);
  const cells = visible.map((option, i) => `<div class="pixel-option ${selection === page * 4 + i ? 'selected' : ''}" data-choice="${page * 4 + i}"><span class="option-icon">${esc(option[1])}</span><span class="option-title">${esc(option[0])}</span><span class="option-sub">${esc(option[2])}</span></div>`);
  while (cells.length < 4) cells.push('<div class="empty-cell"></div>');
  return `<div class="menu-view"><div class="menu-heading"><strong>${esc(title)}</strong><span>${page + 1} / ${Math.ceil(options.length / 4)}</span></div><div class="menu-grid">${cells.join('')}</div><div class="menu-caption"><span>◀ ▶ 选择</span><span>${esc(options[selection]?.[2] || '')}</span></div></div>`;
}
// 每个地点有自己的近景和远景，保持像素宠物始终位于画面前方。
const SCENE_ART = {
  home: `<rect width="320" height="190" fill="#fae6e3"/><rect y="112" width="320" height="78" fill="#e9c4b8"/><path d="M0 112H320M0 145H320M80 112V190M160 112V190M240 112V190" stroke="#d9aaa7" stroke-width="3"/><rect x="22" y="22" width="98" height="82" rx="5" fill="#fff5d9" stroke="#b884a6" stroke-width="7"/><rect x="32" y="32" width="78" height="62" fill="#a9dfe6"/><path d="M71 32V94M32 63H110" stroke="#fff8e8" stroke-width="6"/><circle cx="91" cy="49" r="12" fill="#fff3b6"/><path d="M24 106Q72 88 119 106" fill="#eaa5b6"/><rect x="232" y="67" width="60" height="59" rx="5" fill="#ed9caa" stroke="#b87f99" stroke-width="5"/><path d="M225 69L263 29L300 69Z" fill="#f7cba9" stroke="#b87f99" stroke-width="5"/><rect x="251" y="91" width="19" height="35" fill="#fff0bb"/><ellipse cx="162" cy="161" rx="106" ry="24" fill="#fff0da" stroke="#dca2a8" stroke-width="6"/><path d="M8 113h304" stroke="#fff6e9" stroke-width="4"/>`,
  garden: `<rect width="320" height="190" fill="#c6ebdc"/><circle cx="260" cy="36" r="24" fill="#fff2a6"/><path d="M0 105Q80 61 160 104T320 95V190H0Z" fill="#92ccaa"/><path d="M0 131Q96 100 190 130T320 117V190H0Z" fill="#6fbc8a"/><path d="M10 190Q69 139 164 149T320 190" fill="#f6deb8"/><path d="M12 113V43M12 55h75M84 55v58" stroke="#f9f1cc" stroke-width="8"/><path d="M13 44Q43 12 86 44" fill="none" stroke="#8cc78e" stroke-width="14"/><path d="M224 127V72M272 133V71" stroke="#776e79" stroke-width="10"/><circle cx="224" cy="68" r="30" fill="#7fbd80"/><circle cx="269" cy="66" r="34" fill="#6bb782"/><circle cx="208" cy="65" r="6" fill="#f5939a"/><circle cx="242" cy="77" r="6" fill="#f5939a"/><circle cx="276" cy="53" r="6" fill="#f5939a"/><path d="M30 143v-18m0 7h-9m9 0h9M298 153v-20m0 8h-9m9 0h9" stroke="#539f70" stroke-width="4"/><g fill="#ffe9a1"><circle cx="30" cy="124" r="7"/><circle cx="298" cy="132" r="7"/></g><g fill="#fff8ef"><circle cx="21" cy="128" r="4"/><circle cx="39" cy="128" r="4"/><circle cx="30" cy="117" r="4"/><circle cx="289" cy="136" r="4"/><circle cx="307" cy="136" r="4"/></g>`,
  beach: `<rect width="320" height="190" fill="#a9dced"/><circle cx="266" cy="36" r="23" fill="#fff0b0"/><path d="M0 82H320V143H0Z" fill="#63c7da"/><path d="M0 102Q29 93 58 102T116 102T174 102T232 102T320 102M0 125Q29 116 58 125T116 125T174 125T232 125T320 125" fill="none" stroke="#e8fcf5" stroke-width="5"/><path d="M0 137Q85 126 165 141T320 137V190H0Z" fill="#f6dfae"/><path d="M0 158Q70 145 138 156T320 158" fill="none" stroke="#fff6d4" stroke-width="5"/><path d="M41 133V42" stroke="#a88180" stroke-width="7"/><path d="M41 42Q93 41 119 91H41Z" fill="#ffaaa3"/><path d="M41 42Q72 44 86 89H41Z" fill="#fff0c8"/><path d="M40 136h42" stroke="#a88180" stroke-width="6"/><path d="M253 138Q265 121 278 138L285 151H246Z" fill="#f4aba1" stroke="#ad818c" stroke-width="4"/><path d="M265 132v18M254 139l7 11M276 139l-7 11" stroke="#fff2db" stroke-width="3"/><path d="M294 168q9-15 18 0q-9 10-18 0" fill="#fff7df" stroke="#b8a190" stroke-width="3"/><circle cx="208" cy="165" r="4" fill="#f2b5a2"/>`,
  forest: `<rect width="320" height="190" fill="#283e58"/><circle cx="242" cy="36" r="19" fill="#e6e6bd"/><circle cx="251" cy="30" r="19" fill="#283e58"/><path d="M0 108L35 36L70 108M38 110L86 16L137 110M197 111L244 17L294 111M256 113L300 29L336 113" fill="#456c69"/><path d="M0 131L47 57L90 131M59 128L125 32L184 128M157 126L216 46L275 126M247 129L301 61L336 129" fill="#35615c"/><path d="M0 130Q75 113 160 132T320 124V190H0Z" fill="#315750"/><path d="M0 166Q76 128 152 151T320 150V190H0Z" fill="#406d61"/><path d="M42 163V99M42 110l-19 19M42 122l21 16M281 167V96M281 113l-22 16M281 122l21 14" stroke="#715f69" stroke-width="10"/><g fill="#dff2a2"><circle cx="23" cy="72" r="3"/><circle cx="92" cy="55" r="4"/><circle cx="144" cy="92" r="3"/><circle cx="194" cy="59" r="4"/><circle cx="304" cy="82" r="3"/><circle cx="77" cy="144" r="4"/><circle cx="242" cy="140" r="4"/></g><g fill="#9ee0ad" opacity=".5"><circle cx="23" cy="72" r="9"/><circle cx="92" cy="55" r="10"/><circle cx="194" cy="59" r="10"/><circle cx="242" cy="140" r="11"/></g><path d="M10 181q8-28 15 0m276 0q8-28 15 0" fill="#e89da8" stroke="#f7d2ac" stroke-width="3"/>`,
  arcade: `<rect width="320" height="190" fill="#39335f"/><path d="M0 0H320V128H0Z" fill="#51467b"/><path d="M0 124H320V190H0Z" fill="#65568b"/><path d="M0 127H320M0 159H320M80 127V190M160 127V190M240 127V190" stroke="#ae81bb" stroke-width="3"/><rect x="18" y="26" width="104" height="89" rx="7" fill="#f69cc4" stroke="#322e59" stroke-width="7"/><rect x="29" y="39" width="82" height="52" fill="#78d8d7" stroke="#fff0bb" stroke-width="4"/><path d="M70 50l5 11 12 1-9 8 3 12-11-6-11 6 3-12-9-8 12-1Z" fill="#ffe797"/><circle cx="54" cy="104" r="5" fill="#fff0bc"/><circle cx="77" cy="104" r="5" fill="#a9e5ea"/><rect x="237" y="29" width="65" height="91" rx="8" fill="#92c8e9" stroke="#322e59" stroke-width="7"/><rect x="246" y="40" width="47" height="44" fill="#25365f"/><circle cx="269" cy="60" r="12" fill="#ffe5a0"/><path d="M252 93h35" stroke="#fff0c8" stroke-width="7"/><path d="M151 27l5 12 13 1-10 9 3 13-11-7-11 7 3-13-10-9 13-1Z" fill="#fff0a6"/><path d="M190 73l3 8 9 1-7 6 2 9-7-5-8 5 3-9-7-6 9-1Z" fill="#d3c2ff"/><g fill="#f7add5"><circle cx="169" cy="106" r="3"/><circle cx="214" cy="31" r="3"/><circle cx="309" cy="14" r="3"/></g>`,
  cafe: `<rect width="320" height="190" fill="#f8d7d6"/><path d="M0 114H320V190H0Z" fill="#f2bcae"/><path d="M0 138H320M0 174H320M80 114V190M160 114V190M240 114V190" stroke="#fff0d7" stroke-width="4"/><rect x="18" y="28" width="100" height="78" rx="9" fill="#fff4df" stroke="#b97f91" stroke-width="6"/><path d="M23 65h90" stroke="#b97f91" stroke-width="5"/><path d="M48 65V49h14v16M76 65V44h13v21" stroke="#efa9ae" stroke-width="9"/><path d="M36 91h66" stroke="#d6a28b" stroke-width="7"/><path d="M214 87h92v43h-92Z" fill="#fff0d4" stroke="#aa7889" stroke-width="5"/><path d="M207 90l12-30h83l11 30Z" fill="#ed8fa5" stroke="#aa7889" stroke-width="5"/><path d="M220 75h80" stroke="#fff4dc" stroke-width="7"/><rect x="238" y="101" width="36" height="20" rx="4" fill="#f6b9a8"/><path d="M250 107q6-8 12 0q6-8 12 0q-9 12-12 13q-12-7-12-13" fill="#e76585"/><ellipse cx="159" cy="157" rx="42" ry="10" fill="#a87b8b"/><path d="M156 151V103M126 104h61" stroke="#ae8291" stroke-width="7"/><ellipse cx="157" cy="102" rx="43" ry="10" fill="#fff6df" stroke="#ae8291" stroke-width="4"/><path d="M143 97q10-20 22 0q12-15 19 0" fill="#f39aaa"/><circle cx="154" cy="91" r="4" fill="#e66183"/><circle cx="171" cy="91" r="4" fill="#e66183"/>`
};
function sceneArt(placeId) {
  return `<svg class="scene-art" viewBox="0 0 320 190" preserveAspectRatio="xMidYMid slice" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">${SCENE_ART[placeId] || SCENE_ART.home}</svg>`;
}
function homeMarkup() {
  const place = PLACE_BY_ID[state.place];
  const options = menuOptions();
  return `<div class="home-view"><div class="pixel-scene scene-${esc(place.id)}">${sceneArt(place.id)}<div class="scene-sign">${esc(place.name)}</div><div class="usagi-stage"><canvas data-usagi width="16" height="16" aria-label="乌沙奇"></canvas></div><div class="pet-stage" data-pet-id="${esc(state.petId)}"><canvas data-pet="${esc(state.petId)}" width="16" height="16" aria-label="${esc(state.name)}"></canvas></div><div class="scene-message">${esc(moodText())}</div></div><div class="home-toolbar">${options.map((option, i) => `<div class="home-tile ${selection === i ? 'selected' : ''}" data-choice="${i}"><span class="tile-icon">${esc(option[1])}</span>${esc(option[0])}</div>`).join('')}</div></div>`;
}
function statusMarkup() {
  const pet = PET_BY_ID[state.petId];
  const stage = stageIndex();
  const next = STAGES[stage + 1]?.xp;
  const progress = next ? Math.min(100, Math.round((state.xp - STAGES[stage].xp) / (next - STAGES[stage].xp) * 100)) : 100;
  const dominant = TRAITS.slice().sort((a, b) => state.traits[b.id] - state.traits[a.id]).slice(0, 2);
  if (statusPage === 1) {
    const maxTrait = Math.max(12, ...Object.values(state.traits));
    return `<div class="status-view"><div class="pixel-panel"><div class="panel-title">变异倾向 <small>2 / 2</small></div><div class="trait-line">当前形态：<b>${state.form ? MUTATION_BY_ID[state.form].name : '普通形态'}</b>　已发现 ${state.discovered.length}/${MUTATIONS.length}<br>少年期后，最高倾向达 12 可变异。</div><div class="stat-list">${TRAITS.map(item => `<div class="stat-line trait-stat"><span>${item.icon}</span><div class="stat-track"><i style="width:${Math.round(state.traits[item.id] / maxTrait * 100)}%;background:${item.color}"></i></div><strong>${Math.floor(state.traits[item.id])}</strong></div>`).join('')}</div><div class="trait-line">${dominant.map(item => `${item.icon} ${item.name}`).join('、')}倾向领先。每照顾 8 次会抽取新形态。</div><div class="back-choice">◀ ▶ 换页　● 返回</div></div></div>`;
  }
  return `<div class="status-view"><div class="pixel-panel"><div class="panel-title">成长档案 <small>1 / 2</small></div><div class="profile-summary"><canvas class="tiny-pet" data-pet="${esc(state.petId)}" width="16" height="16"></canvas><div><b>${esc(state.name)} · ${esc(pet.title)}</b>${STAGES[stage].name}期 · 第 ${dayNumber()} 天<br>成长 ${Math.floor(state.xp)} / ${next || 'MAX'}　星币 ${state.coins}</div></div><div class="xp-track"><i style="width:${progress}%"></i></div><div class="stat-list">${Object.entries(STAT_NAMES).map(([key, label]) => `<div class="stat-line"><span>${label}</span><div class="stat-track"><i style="width:${state.stats[key]}%;background:${STAT_COLORS[key]}"></i></div><strong>${Math.round(state.stats[key])}</strong></div>`).join('')}</div><div class="back-choice">◀ ▶ 看变异　● 返回</div></div></div>`;
}
function catalogMarkup() {
  const perPage = 4;
  const pages = Math.ceil(MUTATIONS.length / perPage);
  const items = MUTATIONS.slice(catalogPage * perPage, (catalogPage + 1) * perPage);
  return `<div class="status-view catalog-view"><div class="pixel-panel"><div class="panel-title">变异图鉴 <small>${catalogPage + 1} / ${pages}</small></div><div class="catalog-progress">已发现 ${state.discovered.length}/${MUTATIONS.length} · 稀有形态随机出现</div><div class="catalog-list">${items.map(form => {
    const found = state.discovered.includes(form.id);
    return `<div class="catalog-entry ${state.form === form.id ? 'current' : ''}"><span class="catalog-icon">${found ? form.icon : '?'}</span><span><b>${found ? esc(form.name) : '尚未发现'}</b><small>${found ? `${TRAIT_BY_ID[form.trait].name} · ${form.rarity}${form.wild ? ' · 随机' : ''}` : '继续照顾小伙伴来发现'}</small></span></div>`;
  }).join('')}</div><div class="back-choice">◀ ▶ 翻页　● 返回设置</div></div></div>`;
}
function diaryMarkup() {
  const entries = state.diary.slice(diaryPage * 4, diaryPage * 4 + 4);
  const pages = Math.max(1, Math.ceil(state.diary.length / 4));
  return `<div class="diary-view"><div class="pixel-panel"><div class="panel-title">陪伴日记 <small>${diaryPage + 1}/${pages}</small></div>${entries.map(item => `<div class="diary-entry"><span class="diary-icon">${esc(item.icon)}</span><span><b>${esc(item.message)}</b><small>${new Date(item.at).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</small></span></div>`).join('')}<div class="diary-navigation"><span>◀ ▶ 翻页</span><span>● 返回主页</span></div></div></div>`;
}
function adoptMarkup() {
  const pet = PETS[selection];
  return `<div class="adopt-view"><div class="pixel-panel"><div class="panel-title">选择小伙伴 <small>${selection + 1}/${PETS.length}</small></div><div class="portrait"><canvas data-pet="${esc(pet.id)}" data-preview="true" width="16" height="16"></canvas></div><div class="adopt-name">${esc(pet.name)} ✦</div><div class="adopt-desc">${esc(pet.title)} · ${esc(pet.nature)}</div><div class="choice-dots">${PETS.map((_, i) => `<i class="${i === selection ? 'active' : ''}"></i>`).join('')}</div><div class="hint-small">◀ ▶ 选择宠物，按圆键领养。<br>之后可以在设置里改名字。</div><div class="back-choice">● 领养 ${esc(pet.name)}</div></div></div>`;
}
function renameMarkup() {
  return `<div class="name-view"><div class="pixel-panel"><div class="panel-title">改名字 <small>设置</small></div><p>给小伙伴取一个喜欢的名字吧。点击输入框用键盘输入，按圆键保存。</p><label for="nameInput">新名字</label><input class="pixel-input" id="nameInput" maxlength="12" value="${esc(state.name)}" autocomplete="off"><div class="hint-small">最多 12 个字。存档保存在当前浏览器。</div><div class="back-choice">● 保存名字</div></div></div>`;
}
function boxMarkup() {
  return `<div class="game-view"><div class="pixel-panel"><div class="panel-title">猜宝箱 <small>乌沙奇的小游戏</small></div><div class="game-intro">猜猜星币藏在哪一个箱子？<br>◀ ▶ 选箱子，● 打开！</div><div class="box-row">${[0, 1, 2].map(i => `<div class="mystery-box ${selection === i ? 'selected' : ''}">?</div>`).join('')}</div><div class="hint-small">每次消耗 5 体力，猜中可得 12 星币。</div><div class="back-choice">选中一个宝箱后按圆键</div></div></div>`;
}
function rhythmMarkup() {
  return `<div class="game-view"><div class="pixel-panel"><div class="panel-title">节奏拍拍 <small>乌沙奇来打拍子</small></div><div class="game-intro">光标进入黄色区域时按圆键！<br>连续拍中 3 次就能拿奖励。</div><div class="rhythm-track"><div class="rhythm-zone"></div><div class="rhythm-needle" id="rhythmNeedle"></div></div><div class="game-score" id="rhythmScore">${game.hits} / 3</div><div class="hint-small">◀ 退出　● 拍一下　▶ 重新开始</div><div class="back-choice">${esc(game.message || '准备好了吗？')}</div></div></div>`;
}
function resultMarkup() {
  return `<div class="game-view"><div class="pixel-panel"><div class="panel-title">游戏结果 <small>✦</small></div><div class="portrait" style="font-size:76px;text-align:center;color:#e9a0b0">${game.win ? '★' : '♡'}</div><div class="game-result">${esc(game.message)}</div><div class="hint-small" style="text-align:center">星币 ${state.coins} · 成长 ${Math.floor(state.xp)}</div><div class="back-choice">● 返回游戏菜单</div></div></div>`;
}
function render() {
  $('#screenTitle').textContent = !state ? '领养小伙伴' : view === 'home' ? `${state.name} · ${STAGES[stageIndex()].name}期` : ({ care: '照顾', food: '食物', play: '陪玩', places: '出门', games: '游戏', status: '状态', catalog: '变异图鉴', diary: '日记', settings: '设置', reset: '重新领养', rename: '改名字', box: '猜宝箱', rhythm: '节奏拍拍', result: '游戏结果' }[view] || '口袋小伙伴');
  $('#screenMeta').textContent = state ? `✦ ${state.coins}` : '✦ 欢迎';
  $('#screenHint').textContent = view === 'rhythm' ? '◀ 退出 · ● 拍下 · ▶ 重试' : view === 'diary' || view === 'status' || view === 'catalog' ? '◀ ▶ 翻页 · ● 返回' : '◀ ▶ 选择 · ● 确认';
  let markup;
  if (view === 'adopt') markup = adoptMarkup();
  else if (view === 'home') markup = homeMarkup();
  else if (view === 'status') markup = statusMarkup();
  else if (view === 'catalog') markup = catalogMarkup();
  else if (view === 'diary') markup = diaryMarkup();
  else if (view === 'rename') markup = renameMarkup();
  else if (view === 'box') markup = boxMarkup();
  else if (view === 'rhythm') markup = rhythmMarkup();
  else if (view === 'result') markup = resultMarkup();
  else markup = menuMarkup({ care: '乌沙奇来照顾', food: '今天吃什么？', play: '一起玩什么？', places: '想去哪里？', games: '挑个小游戏', settings: '小小设置', reset: '真的要重新领养吗？' }[view] || '菜单');
  $('#screenView').innerHTML = markup;
  drawCanvases();
  if (view === 'home') animateHome();
  $('#screenView').querySelectorAll('[data-choice]').forEach(tile => tile.addEventListener('click', () => { selection = Number(tile.dataset.choice); render(); }));
  $('#nameInput')?.addEventListener('keydown', event => { if (event.key === 'Enter') confirmChoice(); });
  if (view === 'rhythm') updateRhythmNeedle();
}
function move(delta) {
  if (view === 'rhythm') { if (delta < 0) { stopRhythm(); open('games'); } else startRhythmGame(); return; }
  if (view === 'status') { statusPage = (statusPage + 1) % 2; render(); beep(); return; }
  if (view === 'catalog') { catalogPage = (catalogPage + delta + Math.ceil(MUTATIONS.length / 4)) % Math.ceil(MUTATIONS.length / 4); render(); beep(); return; }
  if (view === 'result' || view === 'rename') return;
  if (view === 'diary') { diaryPage = (diaryPage + delta + Math.max(1, Math.ceil(state.diary.length / 4))) % Math.max(1, Math.ceil(state.diary.length / 4)); render(); beep(); return; }
  const count = view === 'adopt' ? PETS.length : view === 'box' ? 3 : menuOptions().length;
  selection = (selection + delta + count) % count;
  render(); beep();
}
function confirmChoice() {
  if (view === 'adopt') {
    const pet = PETS[selection], now = Date.now();
    state = { petId: pet.id, name: pet.name, bornAt: now, lastUpdated: now, stats: { hunger: 82, happy: 85, clean: 90, energy: 88, health: 100 }, xp: 0, traits: newTraits(), form: null, discovered: [], lastMutationCare: 0, coins: 30, place: 'home', sleeping: false, sleepSince: null, sound: true, careCount: 0, diary: [] };
    log(`乌沙奇和${state.name}相遇啦！`, '♥'); saveState(); open('home'); toast(`欢迎回家，${state.name}！`); beep(); return;
  }
  if (view === 'status' || view === 'diary') { open('home'); beep(); return; }
  if (view === 'catalog') { open('settings'); beep(); return; }
  if (view === 'rename') {
    const name = safeName($('#nameInput').value, state.name);
    state.name = name; log(`乌沙奇给小伙伴取了新名字：${name}。`, '✎'); saveState(); open('settings'); toast('名字保存好啦'); beep(); return;
  }
  if (view === 'box') { finishBoxGame(); return; }
  if (view === 'rhythm') { hitRhythm(); return; }
  if (view === 'result') { open('games'); beep(); return; }
  menuOptions()[selection]?.[3](); beep();
}
function startBoxGame() {
  updateTime(); if (!canAct(5)) return;
  game = { kind: 'box', winningBox: Math.floor(Math.random() * 3) };
  open('box');
}
function finishBoxGame() {
  const won = selection === game.winningBox;
  state.stats.energy = clamp(state.stats.energy - 5);
  state.coins += won ? 12 : 2;
  state.stats.happy = clamp(state.stats.happy + (won ? 15 : 5));
  gain(won ? 9 : 3, 'star', won ? 3 : 1);
  game.win = won;
  game.message = won ? '猜中啦！乌沙奇找到 12 枚星币！' : `再试一次吧！获得 2 枚安慰星币。`;
  log(game.message, won ? '★' : '♡'); saveState(); open('result');
}
function startRhythmGame() {
  updateTime(); if (!canAct(8)) return;
  stopRhythm();
  game = { kind: 'rhythm', hits: 0, misses: 0, phase: 0, message: '' };
  view = 'rhythm'; selection = 0; render();
  rhythmTimer = setInterval(() => { game.phase = (game.phase + 4) % 101; updateRhythmNeedle(); }, 70);
}
function updateRhythmNeedle() {
  const needle = $('#rhythmNeedle');
  if (needle && game) needle.style.setProperty('--needle', `${game.phase}%`);
}
function hitRhythm() {
  const hit = game.phase >= 38 && game.phase <= 62;
  if (hit) { game.hits++; game.message = '好节奏！'; } else { game.misses++; game.message = '差一点，再试试！'; }
  $('#rhythmScore').textContent = `${game.hits} / 3`;
  $('.game-view .back-choice').textContent = game.message;
  beep();
  if (game.hits >= 3 || game.misses >= 3) {
    stopRhythm();
    const won = game.hits >= 3;
    state.stats.energy = clamp(state.stats.energy - 8);
    state.stats.happy = clamp(state.stats.happy + (won ? 18 : 5));
    state.coins += won ? 15 : 3;
    gain(won ? 10 : 3, 'star', won ? 4 : 1);
    game.win = won;
    game.message = won ? '完美合拍！得到 15 枚星币。' : '练习完成！得到 3 枚星币。';
    log(game.message, '♫'); saveState(); open('result');
  }
}
function stopRhythm() { if (rhythmTimer) clearInterval(rhythmTimer); rhythmTimer = null; }

$('#prevButton').addEventListener('click', () => move(-1));
$('#nextButton').addEventListener('click', () => move(1));
$('#selectButton').addEventListener('click', confirmChoice);
document.addEventListener('keydown', event => {
  if (event.target instanceof HTMLInputElement) return;
  if ((event.key === 'Enter' || event.key === ' ') && event.target instanceof HTMLButtonElement) return;
  if (event.key === 'ArrowLeft') { event.preventDefault(); move(-1); }
  if (event.key === 'ArrowRight') { event.preventDefault(); move(1); }
  if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); confirmChoice(); }
});
document.addEventListener('visibilitychange', () => { if (!document.hidden && state) { updateTime(); render(); } });
setInterval(() => { if (state) { updateTime(); if (view === 'home' || view === 'status') render(); } }, 60000);
setInterval(animateHome, 160);
if (state) { updateTime(); saveState(); }
render();
