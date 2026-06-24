const POKEMON_DATA = [
  { id: 1,  name: "이상해씨",   type: ["풀","독"],  hp: 45, atk: 49, emoji: "🌱", color: "#78C850", rarity: "common",   catchRate: 0.45 },
  { id: 4,  name: "파이리",     type: ["불"],       hp: 39, atk: 52, emoji: "🔥", color: "#F08030", rarity: "common",   catchRate: 0.45 },
  { id: 7,  name: "꼬부기",     type: ["물"],       hp: 44, atk: 48, emoji: "💧", color: "#6890F0", rarity: "common",   catchRate: 0.45 },
  { id: 10, name: "캐터피",     type: ["벌레"],     hp: 45, atk: 30, emoji: "🐛", color: "#A8B820", rarity: "common",   catchRate: 0.70 },
  { id: 13, name: "뿔충이",     type: ["벌레","독"],hp: 40, atk: 35, emoji: "🐝", color: "#A8A878", rarity: "common",   catchRate: 0.70 },
  { id: 16, name: "구구",       type: ["일반","날"],hp: 40, atk: 45, emoji: "🐦", color: "#A8A878", rarity: "common",   catchRate: 0.50 },
  { id: 19, name: "꼬렛",       type: ["일반"],     hp: 30, atk: 56, emoji: "🐭", color: "#A8A878", rarity: "common",   catchRate: 0.60 },
  { id: 23, name: "아보",       type: ["독"],       hp: 35, atk: 60, emoji: "🐍", color: "#A040A0", rarity: "uncommon", catchRate: 0.45 },
  { id: 25, name: "피카츄",     type: ["전기"],     hp: 35, atk: 55, emoji: "⚡", color: "#F8D030", rarity: "rare",     catchRate: 0.20 },
  { id: 35, name: "삐삐",       type: ["일반"],     hp: 70, atk: 45, emoji: "🌟", color: "#EE99AC", rarity: "uncommon", catchRate: 0.35 },
  { id: 39, name: "푸린",       type: ["일반","요"], hp: 115, atk: 45, emoji: "🎵", color: "#EE99AC", rarity: "uncommon", catchRate: 0.35 },
  { id: 43, name: "뚜벅초",     type: ["풀","독"],  hp: 45, atk: 50, emoji: "🌷", color: "#78C850", rarity: "common",   catchRate: 0.50 },
  { id: 52, name: "나옹",       type: ["일반"],     hp: 40, atk: 45, emoji: "🐱", color: "#F8D030", rarity: "uncommon", catchRate: 0.40 },
  { id: 54, name: "발챙이",     type: ["물"],       hp: 90, atk: 65, emoji: "🌀", color: "#6890F0", rarity: "uncommon", catchRate: 0.40 },
  { id: 58, name: "가디",       type: ["불"],       hp: 55, atk: 70, emoji: "🐕", color: "#F08030", rarity: "uncommon", catchRate: 0.35 },
  { id: 63, name: "케이시",     type: ["에스퍼"],  hp: 25, atk: 20, emoji: "🔮", color: "#F85888", rarity: "rare",     catchRate: 0.25 },
  { id: 66, name: "알통몬",     type: ["격투"],     hp: 70, atk: 80, emoji: "💪", color: "#C03028", rarity: "uncommon", catchRate: 0.40 },
  { id: 74, name: "꼬마돌",     type: ["바위","땅"],hp: 40, atk: 80, emoji: "🪨", color: "#B8A038", rarity: "uncommon", catchRate: 0.40 },
  { id: 92, name: "고오스",     type: ["고스트","독"], hp: 30, atk: 35, emoji: "👻", color: "#705898", rarity: "rare",  catchRate: 0.25 },
  { id: 129, name: "잉어킹",    type: ["물"],       hp: 20, atk: 10, emoji: "🐟", color: "#6890F0", rarity: "common",   catchRate: 0.65 },
  { id: 133, name: "이브이",    type: ["일반"],     hp: 55, atk: 55, emoji: "🦊", color: "#C07028", rarity: "rare",     catchRate: 0.20 },
  { id: 137, name: "폴리곤",    type: ["일반"],     hp: 65, atk: 60, emoji: "🔺", color: "#FF6868", rarity: "rare",     catchRate: 0.25 },
  { id: 143, name: "잠만보",    type: ["일반"],     hp: 160, atk: 110, emoji: "😴", color: "#C4A000", rarity: "rare",   catchRate: 0.25 },
  { id: 147, name: "미뇽",      type: ["용"],       hp: 41, atk: 64, emoji: "🐲", color: "#7038F8", rarity: "epic",     catchRate: 0.10 },
  { id: 151, name: "뮤",        type: ["에스퍼"],  hp: 100, atk: 100, emoji: "🌈", color: "#FF65A3", rarity: "legendary",catchRate: 0.05 },
];

const RARITY_WEIGHT = { common: 50, uncommon: 25, rare: 15, epic: 8, legendary: 2 };

function getRandomPokemon() {
  const total = POKEMON_DATA.reduce((s, p) => s + RARITY_WEIGHT[p.rarity], 0);
  let rand = Math.random() * total;
  for (const p of POKEMON_DATA) {
    rand -= RARITY_WEIGHT[p.rarity];
    if (rand <= 0) return { ...p, level: Math.floor(Math.random() * 15) + 1, cp: Math.floor((p.atk + p.hp) * (Math.random() * 0.5 + 0.5) * 10) };
  }
  return { ...POKEMON_DATA[0], level: 1, cp: 100 };
}

const RARITY_COLOR = { common: '#aaa', uncommon: '#4CAF50', rare: '#2196F3', epic: '#9C27B0', legendary: '#FF9800' };
const RARITY_LABEL = { common: '일반', uncommon: '비범', rare: '희귀', epic: '영웅', legendary: '전설' };
