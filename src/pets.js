// 可替换的宠物配置：新增物种时，复制一个对象并修改 id、文案、配色与像素图。
// 像素图每行 16 格；. 为透明，其他字符在 palette 中对应颜色。
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
  }
];

const PET_BY_ID = Object.fromEntries(PETS.map(pet => [pet.id, pet]));

// 食物和场地会积累不同倾向；成长达到少年期后，最高倾向会决定变异形态。
const MUTATIONS = [
  { id: 'sweet', name: '蜜桃绒', icon: '♥', body: '#ffd0d9', cheek: '#f28da6', line: '#965f82' },
  { id: 'nature', name: '森之芽', icon: '✿', body: '#b9e9a3', cheek: '#75c498', line: '#507a67' },
  { id: 'ocean', name: '海泡泡', icon: '≈', body: '#aee9e9', cheek: '#79b9d8', line: '#557e9c' },
  { id: 'star', name: '星光闪', icon: '✦', body: '#ffe69e', cheek: '#eca3c1', line: '#7d6a9b' },
  { id: 'cozy', name: '月绒绒', icon: '☾', body: '#d9cff5', cheek: '#b7a6db', line: '#776a9b' }
];
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
