// 可替换的宠物配置：新增物种时，复制一个对象并修改 id、文案、配色与像素图。
// 像素图每行 16 格；. 为透明，其他字符在 palette 中对应颜色。
const sprite = art => art.trim().split('\n').map(row => row.trim().padEnd(16, '.').slice(0, 16));
const PETS = [
  {
    id: 'mimi', name: '米米', title: '云朵团子', nature: '贪吃又爱撒娇',
    favorite: '草莓蛋糕', accent: '#f38c9f', shadow: '#c95679',
    palette: { o: '#5b486b', b: '#fff0d8', s: '#f6b6cc', c: '#fa839c', e: '#382b4a', w: '#ffffff' },
    baby: [
      '................','................','.....oooooo.....','...oobbbbbboo...','..obbbbbbbbbbo..','..obbbbbbbbbbo..','..obbbbbbbbbbo..','..obbsbebbssbo..','..obbsbebbssbo..','..obbbbbcbbbbo..','...obbbccbbbo...','...obbbbbbbbo...','....oobbbboo....','.....oooooo.....','................','................'
    ],
    grown: [
      '................','....oo....oo....','...obbo..obbo...','...obbo..obbo...','..oobbboobbbboo.','.obbbbbbbbbbbbo.','.obbbbbbbbbbbbo.','.obssbebebssbbo.','.obssbebebssbbo.','.obbbbbcbbbbbo..','.obbbbbccbbbbo..','..obbbbbbbbbo...','...obbbbbbbbo...','....oobbbboo....','.....oooooo.....','................'
    ]
  },
  {
    id: 'dou', name: '豆豆', title: '森林芽芽', nature: '喜欢阳光和游戏',
    favorite: '苹果片', accent: '#78b889', shadow: '#3d826a',
    palette: { o: '#42646a', b: '#b8e99e', s: '#82cf92', c: '#f994a4', e: '#304750', w: '#ffffff', l: '#68b782' },
    baby: [
      '................','.......ll.......','......llll......','.....ollbo......','......obbo......','....oobbbboo....','...obbbbbbbbo...','..obbbbbbbbbbo..','..obbsbebssbbo..','..obbsbebssbbo..','..obbbbbcbbbbo..','...obbbccbbbo...','....obbbbbbo....','.....oooooo.....','................','................'
    ],
    grown: [
      '.......ll.......','......llll......','....oolllloo....','...obbolbbboo...','....obbbbbo.....','..oobbbbbbbboo..','.obbbbbbbbbbbbo.','.obbbbbbbbbbbbo.','.obssbebebssbbo.','.obssbebebssbbo.','.obbbbbcbbbbbo..','..obbbbccbbbbo..','...obbbbbbbbo...','....oobbbboo....','.....oooooo.....','................'
    ]
  },
  {
    id: 'xing', name: '星星', title: '星光精灵', nature: '夜晚会闪闪发光',
    favorite: '星星饼干', accent: '#eab566', shadow: '#ca875d',
    palette: { o: '#6b5875', b: '#ffe49a', s: '#ffca91', c: '#f58d9b', e: '#443c5d', w: '#ffffff' },
    baby: [
      '................','.......oo.......','......obbo......','....oobbbboo....','...obbbbbbbo....','..obbbbbbbbbbo..','..obbsbebssbbo..','..obbsbebssbbo..','..obbbbbcbbbbo..','...obbbccbbbo...','....obbbbbbo....','....obbbbbbo....','...ooobbbbooo...','..oo..oooo..oo..','................','................'
    ],
    grown: [
      '.......oo.......','......obbo......','.....obbbbo.....','..ooobbbbbooo...','..obbbbbbbbbbo..','...obbbbbbbbo...','..obbbbbbbbbbo..','.obssbebebssbbo.','.obssbebebssbbo.','.obbbbbcbbbbbo..','..obbbbccbbbbo..','..obbbbbbbbbbo..','..oobbbbbbbboo..','..oo..oooo..oo..','................','................'
    ]
  },
  {
    id: 'diandian', name: '点点', title: '斑点团子', nature: '爱收集亮晶晶的小东西',
    favorite: '苹果片', accent: '#efaa78', shadow: '#ae7069',
    palette: { o: '#76596d', b: '#ffe8bb', s: '#ffc9a9', c: '#e98b9b', e: '#40354d', d: '#ce916f', w: '#fff' },
    baby: sprite(`
................
................
.....oooooo.....
...oobbbbbboo...
..obbbdbdbbbbo..
..obbbbbbbbbbo...
..obdbbbbbdbbo...
..obbebbbebbbo...
..obbsbbbssbbo...
..obbbbbcbbbbo...
...obbbccbbbo....
....obbbbbbo.....
.....oooooo......
................
................
................`),
    grown: sprite(`
................
....ooo..ooo....
...obbo..obbo...
..obbbbbbbbbbo...
.obdbbbdbbbdbbo..
.obbbbbbbbbbbbo..
.obbbbbbbbbbbbo..
.obbebbbbbebbo...
.obbsbbbbbsbbo...
.obbbbbcbbbbbo...
..obbbbccbbbbo...
..obdbbbbbdbbo...
...obbbbbbbbo....
....oobbbboo.....
.....oooooo......
................`)
  },
  {
    id: 'xiaoxiao', name: '小小', title: '口袋飞鼠', nature: '个子小，胆子却很大',
    favorite: '星星饼干', accent: '#9eb9e5', shadow: '#677eaf',
    palette: { o: '#59617d', b: '#dce9ff', s: '#b6c8ee', c: '#e99caf', e: '#303a5d', d: '#8fa9d9', w: '#fff' },
    baby: sprite(`
................
..oo........oo..
..obbo......obbo
...obbo....obbo.
....obbbbbbo....
...obbbbbbbbo...
..obbbbbbbbbbo..
.oobbbebebbbboo.
.obbsbbbbbsbbbo.
..obbbbcbbbbo...
...obbbccbbbo...
....obbbbbbo....
.....oooooo.....
................
................
................`),
    grown: sprite(`
.oo..........oo.
.obbo......obbo.
..obbo....obbo..
...obbbbbbbbo...
..obbbbbbbbbbo..
.obbbbbbbbbbbbo.
oobbbbbbbbbbbboo
obbbbsbebsbbbbo
obbbbbbbbbbbbbbo
oobbbbbcbbbbboo
..obbbbccbbbbo..
...obbbbbbbbo...
....obbbbbbo....
...ooobbbbooo...
..oo..oooo..oo..
................`)
  },
  {
    id: 'maomao', name: '毛毛', title: '蓬蓬绒球', nature: '高兴时全身毛会炸开',
    favorite: '草莓蛋糕', accent: '#e7a9c2', shadow: '#b46f95',
    palette: { o: '#795a77', b: '#f6d8ef', s: '#edb8d9', c: '#f48ca9', e: '#4d385c', d: '#dba9cf', w: '#fff' },
    baby: sprite(`
................
.....oo..oo.....
...oobboobboo...
..obbbbbbbbbbo..
.obbbbbbbbbbbbo.
..obbbbbbbbbbo..
.obbbbbbbbbbbbo.
..obbebbbebbbo..
.obbsbbbbbsbbbo.
..obbbbcbbbbo...
...obbbccbbbo...
..obbbbbbbbbbo..
...oobbbbbboo...
.....oooooo.....
................
................`),
    grown: sprite(`
..oo..oo..oo....
.obboobboobbbo..
obbbbbbbbbbbbbo.
.obbbbbbbbbbbbbo
obbbbbbbbbbbbbo.
.obbbbbbbbbbbbbo
obbbbbbbbbbbbbo.
.obbebbbbbebbo..
obbsbbbbbbssbbo.
.obbbbbcbbbbbo..
obbbbbbccbbbbbo.
.obbbbbbbbbbbbo..
..obbbbbbbbbbo...
...oobbbbbboo....
.....oooooo.....
................`)
  },
  {
    id: 'rongrong', name: '茸茸', title: '垂耳棉花糖', nature: '喜欢把朋友抱得暖暖的',
    favorite: '月光牛奶', accent: '#c8b3e9', shadow: '#9278b7',
    palette: { o: '#71627f', b: '#eae1fb', s: '#d3c4ef', c: '#ee9da8', e: '#413c5c', d: '#bba7e3', w: '#fff' },
    baby: sprite(`
................
..ooo......ooo..
.obbo......obbo.
.obbooooooobbo.
..obbbbbbbbbbo..
..obbbbbbbbbbo..
..obbbbbbbbbbo..
..obbebbbebbbo..
..obbsbbbssbbo..
...obbbcbbbbo...
...obbbccbbbo...
....obbbbbbo....
.....oooooo.....
................
................
................`),
    grown: sprite(`
oo............oo
obbo........obbo
obbo........obbo
obboooooooooobbo
.obbbbbbbbbbbbo.
.obbbbbbbbbbbbo.
.obbbbbbbbbbbbo.
.obbebbbbbebbo..
.obbsbbbbbsbbo..
.obbbbbcbbbbbo..
..obbbbccbbbbo..
...obbbbbbbbo...
....obbbbbbo....
...ooobbbbooo...
..oo..oooo..oo..
................`)
  },
  {
    id: 'mimi_cat', name: '咪咪', title: '奶油小猫', nature: '好奇心旺盛，爱晒太阳',
    favorite: '海苔饭团', accent: '#f3b88a', shadow: '#bf846e',
    palette: { o: '#755b64', b: '#ffe4c8', s: '#f7bda6', c: '#e88d94', e: '#493a50', d: '#d69777', w: '#fff' },
    baby: sprite(`
................
..oo........oo..
..obbo......obbo
...obbbo..obbbo.
....obbbbbbo....
...obbbbbbbbo...
..obbbbbbbbbbo..
..obbebbbebbbo..
..obbsbbbssbbo..
..obbbbcbbbbo...
...obbbccbbbo...
....obbbbbbo....
.....oooooo.....
..........oo....
...........oo...
................`),
    grown: sprite(`
.oo..........oo.
.obbo......obbo.
..obbbo....obbbo
...obbbbbbbbo...
..obbbbbbbbbbo..
.obbbbbbbbbbbbo.
.obbbbbbbbbbbbo.
.obbebbbbbebbo..
.obbsbbbbbsbbo..
.obbbbbcbbbbbo..
..obbbbccbbbbo..
...obbbbbbbbo...
....obbbbbbo....
.....oooooo..oo.
.............oo.
................`)
  }
];

const PET_BY_ID = Object.fromEntries(PETS.map(pet => [pet.id, pet]));

// 五种倾向各有十种可收藏形态；weight 是同倾向抽取时的相对权重。
const TRAITS = [
  { id: 'sweet', name: '甜蜜', icon: '♥', color: '#f28da6', hue: 340 },
  { id: 'nature', name: '自然', icon: '✿', color: '#75c498', hue: 125 },
  { id: 'ocean', name: '海洋', icon: '≈', color: '#79b9d8', hue: 190 },
  { id: 'star', name: '星光', icon: '✦', color: '#e8bb77', hue: 44 },
  { id: 'cozy', name: '安睡', icon: '☾', color: '#b7a6db', hue: 263 }
];
const TRAIT_BY_ID = Object.fromEntries(TRAITS.map(item => [item.id, item]));
const MUTATION_SETS = {
  sweet: [
    ['sweet', '蜜桃绒', 'bow'], ['berry_puff', '草莓泡芙', 'berry'], ['caramel', '焦糖布丁', 'crown'],
    ['sakura', '樱花糖', 'flower'], ['honeybee', '蜜糖蜂', 'antenna'], ['rose_cloud', '玫瑰云', 'wings'],
    ['cotton_candy', '棉花糖', 'halo'], ['raspberry', '覆盆莓', 'dots'], ['heart_wish', '心愿糖', 'heart'],
    ['rainbow_dream', '虹彩甜梦', 'rainbow']
  ],
  nature: [
    ['nature', '森之芽', 'sprout'], ['clover', '四叶苗', 'flower'], ['moss_deer', '青苔鹿', 'antlers'],
    ['pinecone', '松果球', 'crown'], ['mushroom', '蘑菇伞', 'cap'], ['bamboo', '竹叶团', 'leaf'],
    ['flower_crown', '花冠灵', 'halo'], ['fern', '雨露蕨', 'wings'], ['golden_ear', '金穗兔', 'antenna'],
    ['ancient_tree', '秘境古树', 'branch']
  ],
  ocean: [
    ['ocean', '海泡泡', 'bubbles'], ['coral', '珊瑚芽', 'branch'], ['sea_spray', '浪花团', 'wave'],
    ['pearl_shell', '珍珠贝', 'crown'], ['sea_salt', '海盐晶', 'crystal'], ['whale_dream', '蓝鲸梦', 'fins'],
    ['jelly_lamp', '水母灯', 'antenna'], ['tide_fin', '潮汐鳍', 'wings'], ['deep_vortex', '深蓝涡', 'spiral'],
    ['aurora_sea', '极光海灵', 'halo']
  ],
  star: [
    ['star', '星光闪', 'star'], ['comet_tail', '彗星尾', 'trail'], ['galaxy_sugar', '银河糖', 'dots'],
    ['meteor', '月陨石', 'crystal'], ['neon_wing', '霓虹翼', 'wings'], ['orbit', '星轨环', 'halo'],
    ['sun_crown', '日曜冠', 'crown'], ['shooting_feather', '流星羽', 'leaf'], ['sky_crystal', '天穹晶', 'antlers'],
    ['supernova', '超新星', 'burst']
  ],
  cozy: [
    ['cozy', '月绒绒', 'moon'], ['cloud_pillow', '云朵枕', 'cap'], ['night_dew', '夜露眠', 'dots'],
    ['fleece_dream', '绒球梦', 'bow'], ['hearth', '暖炉心', 'heart'], ['snow_cap', '雪绒帽', 'crown'],
    ['lavender', '薰衣草', 'flower'], ['night_light', '小夜灯', 'antenna'], ['frost_fox', '霜月狐', 'wings'],
    ['eternal_night', '永夜王', 'halo']
  ]
};
const RARITY_WEIGHTS = [28, 21, 16, 11, 7, 5, 3, 1.8, .8, .2];
const MUTATIONS = TRAITS.flatMap((trait, group) => MUTATION_SETS[trait.id].map(([id, name, motif], index) => {
  const hue = (trait.hue + index * 9 - 12 + 360) % 360;
  return {
    id, name, motif, trait: trait.id, icon: trait.icon,
    rarity: index < 3 ? '常见' : index < 6 ? '少见' : index < 8 ? '稀有' : index < 9 ? '珍奇' : '传说',
    weight: RARITY_WEIGHTS[index] * (1 + group * .08 + index * .007),
    wild: index === 9,
    body: `hsl(${hue}, 78%, ${83 - index * 1.6}%)`,
    cheek: `hsl(${(hue + 27) % 360}, 73%, 67%)`,
    line: `hsl(${(hue + 18) % 360}, 30%, 41%)`,
    accent: `hsl(${(hue + 48) % 360}, 85%, 71%)`
  };
}));
const MUTATION_BY_ID = Object.fromEntries(MUTATIONS.map(item => [item.id, item]));
const STAGES = [
  { name: '幼崽', xp: 0 }, { name: '童年', xp: 20 },
  { name: '少年', xp: 55 }, { name: '成年', xp: 120 }
];
const FOODS = [
  { id: 'apple', name: '苹果片', icon: '●', cost: 2, hunger: 20, happy: 2, trait: 'nature', traitGain: 2 },
  { id: 'cake', name: '草莓蛋糕', icon: '▣', cost: 5, hunger: 23, happy: 8, trait: 'sweet', traitGain: 3 },
  { id: 'seaweed', name: '海苔饭团', icon: '◆', cost: 4, hunger: 26, happy: 3, trait: 'ocean', traitGain: 3 },
  { id: 'cookie', name: '星星饼干', icon: '✦', cost: 4, hunger: 18, happy: 9, trait: 'star', traitGain: 3 },
  { id: 'milk', name: '月光牛奶', icon: '☾', cost: 3, hunger: 16, energy: 6, trait: 'cozy', traitGain: 3 }
];
const PLACES = [
  { id: 'home', name: '糖果小屋', icon: '⌂', color: '#d7f5f4', activity: '整理小屋', trait: 'cozy' },
  { id: 'garden', name: '花朵庭院', icon: '✿', color: '#dcf3cb', activity: '采摘苹果', trait: 'nature' },
  { id: 'beach', name: '贝壳海滩', icon: '≈', color: '#c9eef5', activity: '寻找贝壳', trait: 'ocean' },
  { id: 'forest', name: '萤火森林', icon: '♣', color: '#d7e9c7', activity: '寻找萤火', trait: 'nature' },
  { id: 'arcade', name: '星星游乐屋', icon: '✦', color: '#dcd7f6', activity: '收集星光', trait: 'star' },
  { id: 'cafe', name: '草莓咖啡馆', icon: '♥', color: '#fbdce5', activity: '帮忙烘焙', trait: 'sweet' }
];
const PLACE_BY_ID = Object.fromEntries(PLACES.map(place => [place.id, place]));

// 乌沙奇的 16×16 像素图。动画由 CSS 跳跃与帧切换完成。
const USAGI = {
  palette: { o: '#6a4a5e', y: '#ffe89b', p: '#f6a4b7', e: '#383348', w: '#fffaf0' },
  idle: [
    '....oo....oo....','...oyyo..oyyo...','...oypo..opyo...','...oyyo..oyyo...','....oyyyyyyo....','...oyyyyyyyyo...','..oyyyyyyyyyyo..','..oyyeyyyeyyyo..','..oyyyyyyyyyyo..','..oyyyowoyyyyo..','...oyyyyyyyyo...','...oyyyyyyyyo...','....oyyyyyyo....','...ooyooooyoo...','...oo.....oo....','................'
  ],
  cheer: [
    '...oo......oo...','..oyyo....oyyo..','..oypo....opyo..','...oyyo..oyyo...','....oyyyyyyo....','...oyyyyyyyyo...','..oyyyyyyyyyyo..','..oyyeyyyeyyyo..','..oyyyyyyyyyyo..','..oyyyowoyyyyo..','o..oyyyyyyyyo..o','oo.oyyyyyyyyo.oo','....oyyyyyyo....','...ooyooooyoo...','...oo.....oo....','................'
  ]
};
