const STORAGE_KEY = 'minipet-save-v2';
const OLD_STORAGE_KEY = 'minipet-save-v1';
const STAT_NAMES = { hunger: '饱腹', happy: '心情', clean: '清洁', energy: '体力', health: '健康' };
const STAT_COLORS = { hunger: '#edab70', happy: '#e792ae', clean: '#8ac9d4', energy: '#ad9bd4', health: '#91c99f' };
const $ = selector => document.querySelector(selector);
const esc = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const clamp = value => Math.max(0, Math.min(100, value));
const safeName = (value, fallback) => String(value || '').trim().slice(0, 12) || fallback;
const newTraits = () => Object.fromEntries(MUTATIONS.map(item => [item.id, 0]));
let state = loadState();
let view = state ? 'home' : 'adopt';
let selection = 0;
let diaryPage = 0;
let statusPage = 0;
let game = null;
let rhythmTimer = null;
let helperTimer = null;
let toastTimer = null;
let audioContext;

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
      traits: Object.fromEntries(MUTATIONS.map(item => [item.id, Math.max(0, Number(raw.traits?.[item.id]) || 0)])),
      form: raw.form && MUTATION_BY_ID[raw.form] ? raw.form : null,
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
function evolve() {
  const previous = state.form;
  const best = MUTATIONS.reduce((winner, item) => state.traits[item.id] > state.traits[winner.id] ? item : winner);
  const next = stageIndex() >= 2 && state.traits[best.id] >= 12 ? best.id : null;
  if (next !== previous) {
    state.form = next;
    if (next) log(`${state.name}变成了「${MUTATION_BY_ID[next].name}」！`, '✦');
  }
}
function gain(xp, trait, amount = 0) {
  const before = stageIndex();
  state.xp += xp;
  if (trait && Object.hasOwn(state.traits, trait)) state.traits[trait] += amount;
  if (stageIndex() !== before) log(`${state.name}长大了，进入${STAGES[stageIndex()].name}期！`, '★');
  evolve();
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
function drawPet(canvas, pet = PET_BY_ID[state?.petId] || PETS[0], preview = false) {
  const stage = preview || !state ? 0 : stageIndex();
  const mutation = !preview && state?.form ? MUTATION_BY_ID[state.form] : null;
  const palette = { ...pet.palette };
  if (mutation) { palette.b = mutation.body; palette.s = mutation.cheek; palette.o = mutation.line; }
  const sprite = stage === 0 ? pet.baby : (stage >= 3 && pet.adult) ? pet.adult : (stage >= 2 && pet.teen) ? pet.teen : pet.grown;
  const ctx = drawSprite(canvas, sprite, palette);
  if (!ctx) return;
  if (stage >= 2) {
    ctx.fillStyle = mutation?.cheek || '#ffe79d';
    if (state.form === 'nature') { ctx.fillRect(3, 1, 3, 2); ctx.fillRect(5, 0, 2, 2); }
    else if (state.form === 'ocean') { ctx.fillRect(1, 1, 2, 2); ctx.fillRect(13, 2, 2, 2); }
    else if (state.form === 'star') { ctx.fillRect(6, 0, 3, 1); ctx.fillRect(7, 0, 1, 3); }
    else if (state.form === 'cozy') { ctx.fillRect(2, 1, 3, 1); ctx.fillRect(2, 2, 1, 2); }
    else { ctx.fillRect(2, 2, 3, 2); ctx.fillRect(11, 2, 3, 2); }
  }
  if (stage >= 3) { ctx.fillStyle = '#fff6cd'; ctx.fillRect(1, 8, 1, 2); ctx.fillRect(14, 8, 1, 2); }
}
function drawCanvases() {
  document.querySelectorAll('canvas[data-pet]').forEach(canvas => drawPet(canvas, PET_BY_ID[canvas.dataset.pet], canvas.dataset.preview === 'true'));
  document.querySelectorAll('canvas[data-usagi]').forEach(canvas => drawSprite(canvas, USAGI.idle, USAGI.palette));
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
function helperAnimation(icon) {
  clearTimeout(helperTimer);
  const helper = $('.usagi-stage');
  if (!helper) return;
  helper.classList.remove('helping'); void helper.offsetWidth; helper.classList.add('helping');
  const effect = document.createElement('span'); effect.className = 'care-effect'; effect.textContent = icon;
  $('.pixel-scene')?.append(effect);
  drawSprite(helper.querySelector('canvas'), USAGI.cheer, USAGI.palette);
  helperTimer = setTimeout(() => {
    helper.classList.remove('helping'); effect.remove();
    drawSprite(helper.querySelector('canvas'), USAGI.idle, USAGI.palette);
  }, 1500);
}
function finishAction(message, icon, xp, trait, traitGain = 0) {
  state.careCount++;
  gain(xp, trait, traitGain);
  log(message, icon);
  state.lastUpdated = Date.now();
  saveState(); open('home'); helperAnimation(icon); toast(message); beep();
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
  finishAction(`乌沙奇喂${state.name}吃了${food.name}！`, food.icon, 5, food.trait, food.traitGain);
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
  finishAction(actions.message, actions.icon, actions.xp, actions.trait, actions.gain);
}
function care(kind) {
  updateTime();
  if (kind !== 'sleep' && !canAct()) return;
  if (kind === 'clean') {
    if (state.stats.clean >= 96) return toast('已经干干净净啦');
    state.stats.clean = clamp(state.stats.clean + 44);
    state.stats.happy = clamp(state.stats.happy + 4);
    finishAction(`乌沙奇给${state.name}洗了香香澡！`, '✿', 5, 'ocean', 2);
  } else if (kind === 'sleep') {
    state.sleeping = !state.sleeping;
    state.sleepSince = state.sleeping ? Date.now() : null;
    if (!state.sleeping) state.stats.energy = clamp(state.stats.energy + 6);
    finishAction(state.sleeping ? `乌沙奇哄${state.name}睡觉了。` : `${state.name}醒来了！`, '☾', 3, 'cozy', 2);
  } else if (kind === 'heal') {
    if (state.stats.health >= 96) return toast('小伙伴现在很健康');
    state.stats.health = clamp(state.stats.health + 32);
    finishAction(`乌沙奇照顾了${state.name}。`, '✚', 5, 'cozy', 2);
  }
}
function travel(place) {
  updateTime(); if (!canAct(place.id === state.place ? 0 : 6)) return;
  if (place.id === state.place) return toast('已经在这里啦');
  state.place = place.id;
  state.stats.energy = clamp(state.stats.energy - 6);
  state.stats.happy = clamp(state.stats.happy + 6);
  finishAction(`乌沙奇带${state.name}到了${place.name}。`, place.icon, 4, place.trait, 1);
}
function placeActivity() {
  updateTime(); if (!canAct(12)) return;
  const place = PLACE_BY_ID[state.place];
  const found = 3 + Math.floor(Math.random() * 6);
  state.coins += found;
  state.stats.energy = clamp(state.stats.energy - 12);
  state.stats.hunger = clamp(state.stats.hunger - 6);
  state.stats.happy = clamp(state.stats.happy + 13);
  finishAction(`${place.activity}，找到 ${found} 枚星币！`, place.icon, 7, place.trait, 3);
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
    case 'food': return [...FOODS.map(food => [food.name, food.icon, `${food.cost} 星币 · ${MUTATION_BY_ID[food.trait].name}`, () => feed(food)]), ['返回', '↶', '照顾菜单', () => open('care')]];
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
  view = next; selection = 0;
  if (next === 'status') statusPage = 0;
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
function homeMarkup() {
  const place = PLACE_BY_ID[state.place];
  const options = menuOptions();
  const floor = state.place === 'beach' ? '#f5d9a9' : state.place === 'forest' ? '#b8d6a5' : state.place === 'arcade' ? '#d9c6e6' : '#ecd2b9';
  return `<div class="home-view"><div class="pixel-scene" style="--sky:${place.color};--floor:${floor}"><div class="scene-prop">${esc(place.icon)}</div><div class="scene-sign">${esc(place.name)}</div><div class="scene-ground"></div><div class="scene-rug"></div><span class="scene-spark one">✦</span><span class="scene-spark two">✧</span><div class="usagi-stage"><canvas data-usagi width="16" height="16" aria-label="乌沙奇"></canvas></div><div class="pet-stage ${state.sleeping ? 'sleeping' : ''}"><canvas data-pet="${esc(state.petId)}" width="16" height="16" aria-label="${esc(state.name)}"></canvas></div><div class="scene-message">${esc(moodText())}</div></div><div class="home-toolbar">${options.map((option, i) => `<div class="home-tile ${selection === i ? 'selected' : ''}" data-choice="${i}"><span class="tile-icon">${esc(option[1])}</span>${esc(option[0])}</div>`).join('')}</div></div>`;
}
function statusMarkup() {
  const pet = PET_BY_ID[state.petId];
  const stage = stageIndex();
  const next = STAGES[stage + 1]?.xp;
  const progress = next ? Math.min(100, Math.round((state.xp - STAGES[stage].xp) / (next - STAGES[stage].xp) * 100)) : 100;
  const dominant = MUTATIONS.slice().sort((a, b) => state.traits[b.id] - state.traits[a.id]).slice(0, 2);
  if (statusPage === 1) {
    const maxTrait = Math.max(12, ...Object.values(state.traits));
    return `<div class="status-view"><div class="pixel-panel"><div class="panel-title">变异图鉴 <small>2 / 2</small></div><div class="trait-line">当前形态：<b>${state.form ? MUTATION_BY_ID[state.form].name : '普通形态'}</b><br>少年期后，最高倾向达 12 就会变化。</div><div class="stat-list">${MUTATIONS.map(item => `<div class="stat-line trait-stat"><span>${item.icon}</span><div class="stat-track"><i style="width:${Math.round(state.traits[item.id] / maxTrait * 100)}%;background:${item.cheek}"></i></div><strong>${Math.floor(state.traits[item.id])}</strong></div>`).join('')}</div><div class="trait-line">${dominant.map(item => `${item.icon} ${item.name}`).join('、')}倾向领先。食物、陪玩和旅行会改变倾向。</div><div class="back-choice">◀ ▶ 换页　● 返回</div></div></div>`;
  }
  return `<div class="status-view"><div class="pixel-panel"><div class="panel-title">成长档案 <small>1 / 2</small></div><div class="profile-summary"><canvas class="tiny-pet" data-pet="${esc(state.petId)}" width="16" height="16"></canvas><div><b>${esc(state.name)} · ${esc(pet.title)}</b>${STAGES[stage].name}期 · 第 ${dayNumber()} 天<br>成长 ${Math.floor(state.xp)} / ${next || 'MAX'}　星币 ${state.coins}</div></div><div class="xp-track"><i style="width:${progress}%"></i></div><div class="stat-list">${Object.entries(STAT_NAMES).map(([key, label]) => `<div class="stat-line"><span>${label}</span><div class="stat-track"><i style="width:${state.stats[key]}%;background:${STAT_COLORS[key]}"></i></div><strong>${Math.round(state.stats[key])}</strong></div>`).join('')}</div><div class="back-choice">◀ ▶ 看变异　● 返回</div></div></div>`;
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
  $('#screenTitle').textContent = !state ? '领养小伙伴' : view === 'home' ? `${state.name} · ${STAGES[stageIndex()].name}期` : ({ care: '照顾', food: '食物', play: '陪玩', places: '出门', games: '游戏', status: '状态', diary: '日记', settings: '设置', reset: '重新领养', rename: '改名字', box: '猜宝箱', rhythm: '节奏拍拍', result: '游戏结果' }[view] || '口袋小伙伴');
  $('#screenMeta').textContent = state ? `✦ ${state.coins}` : '✦ 欢迎';
  $('#screenHint').textContent = view === 'rhythm' ? '◀ 退出 · ● 拍下 · ▶ 重试' : view === 'diary' || view === 'status' ? '◀ ▶ 翻页 · ● 返回' : '◀ ▶ 选择 · ● 确认';
  let markup;
  if (view === 'adopt') markup = adoptMarkup();
  else if (view === 'home') markup = homeMarkup();
  else if (view === 'status') markup = statusMarkup();
  else if (view === 'diary') markup = diaryMarkup();
  else if (view === 'rename') markup = renameMarkup();
  else if (view === 'box') markup = boxMarkup();
  else if (view === 'rhythm') markup = rhythmMarkup();
  else if (view === 'result') markup = resultMarkup();
  else markup = menuMarkup({ care: '乌沙奇来照顾', food: '今天吃什么？', play: '一起玩什么？', places: '想去哪里？', games: '挑个小游戏', settings: '小小设置', reset: '真的要重新领养吗？' }[view] || '菜单');
  $('#screenView').innerHTML = markup;
  drawCanvases();
  $('#screenView').querySelectorAll('[data-choice]').forEach(tile => tile.addEventListener('click', () => { selection = Number(tile.dataset.choice); render(); }));
  $('#nameInput')?.addEventListener('keydown', event => { if (event.key === 'Enter') confirmChoice(); });
  if (view === 'rhythm') updateRhythmNeedle();
}
function move(delta) {
  if (view === 'rhythm') { if (delta < 0) { stopRhythm(); open('games'); } else startRhythmGame(); return; }
  if (view === 'status') { statusPage = (statusPage + 1) % 2; render(); beep(); return; }
  if (view === 'result' || view === 'rename') return;
  if (view === 'diary') { diaryPage = (diaryPage + delta + Math.max(1, Math.ceil(state.diary.length / 4))) % Math.max(1, Math.ceil(state.diary.length / 4)); render(); beep(); return; }
  const count = view === 'adopt' ? PETS.length : view === 'box' ? 3 : menuOptions().length;
  selection = (selection + delta + count) % count;
  render(); beep();
}
function confirmChoice() {
  if (view === 'adopt') {
    const pet = PETS[selection], now = Date.now();
    state = { petId: pet.id, name: pet.name, bornAt: now, lastUpdated: now, stats: { hunger: 82, happy: 85, clean: 90, energy: 88, health: 100 }, xp: 0, traits: newTraits(), form: null, coins: 30, place: 'home', sleeping: false, sleepSince: null, sound: true, careCount: 0, diary: [] };
    log(`乌沙奇和${state.name}相遇啦！`, '♥'); saveState(); open('home'); toast(`欢迎回家，${state.name}！`); beep(); return;
  }
  if (view === 'status' || view === 'diary') { open('home'); beep(); return; }
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
if (state) { updateTime(); saveState(); }
render();
