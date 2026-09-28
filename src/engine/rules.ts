/**
 * Balatro Core Rules & Strategy Knowledge Base
 * 《小丑牌》核心计分机制与大师战术百科（依据高分秘诀引擎论深度重构）
 */


export const PLANET_HAND_MAP: Record<string, string> = {
  // 12 Full Planets (Standard + Special Hands)
  c_pluto: 'High Card',
  c_mercury: 'Pair',
  c_uranus: 'Two Pair',
  c_venus: 'Three of a Kind',
  c_saturn: 'Straight',
  c_jupiter: 'Flush',
  c_earth: 'Full House',
  c_mars: 'Four of a Kind',
  c_neptune: 'Straight Flush',
  c_planet_x: 'Five of a Kind',
  c_ceres: 'Flush House',
  c_eris: 'Flush Five',

  // Label aliases
  'Pluto': 'High Card',
  'Mercury': 'Pair',
  'Uranus': 'Two Pair',
  'Venus': 'Three of a Kind',
  'Saturn': 'Straight',
  'Jupiter': 'Flush',
  'Earth': 'Full House',
  'Mars': 'Four of a Kind',
  'Neptune': 'Straight Flush',
  'Planet X': 'Five of a Kind',
  'Ceres': 'Flush House',
  'Eris': 'Flush Five',
};

export const BASE_HAND_STATS: Record<string, { chips: number; mult: number; lvlChips: number; lvlMult: number }> = {
  'Flush Five': { chips: 160, mult: 16, lvlChips: 50, lvlMult: 3 },
  'Flush House': { chips: 140, mult: 14, lvlChips: 40, lvlMult: 4 },
  'Five of a Kind': { chips: 120, mult: 12, lvlChips: 35, lvlMult: 3 },
  'Straight Flush': { chips: 100, mult: 8, lvlChips: 40, lvlMult: 4 },
  'Four of a Kind': { chips: 60, mult: 7, lvlChips: 30, lvlMult: 3 },
  'Full House': { chips: 40, mult: 4, lvlChips: 25, lvlMult: 2 },
  'Flush': { chips: 35, mult: 4, lvlChips: 15, lvlMult: 2 },
  'Straight': { chips: 30, mult: 4, lvlChips: 30, lvlMult: 3 },
  'Three of a Kind': { chips: 30, mult: 3, lvlChips: 20, lvlMult: 2 },
  'Two Pair': { chips: 20, mult: 2, lvlChips: 20, lvlMult: 1 },
  'Pair': { chips: 10, mult: 2, lvlChips: 15, lvlMult: 1 },
  'High Card': { chips: 5, mult: 1, lvlChips: 10, lvlMult: 1 },
};

export const BALATRO_RULEBOOK = `
【《小丑牌》(Balatro 1.0.1o) 核心机制与终极高分指南】

一、分数来源与核心引擎公式：
- 每手分数的核心是：筹码 (Chips, 蓝色) × 倍率 (Mult, 红色) ＝ 得分。
- 筹码与倍率必须同步成长。若 200 筹码、10 倍率得 2,000 分；增加 20 筹码只多 200 分，而增加 10 倍率多 2,000 分！反过来，若倍率极高而筹码很低，升级牌型或增加筹码小丑收益暴涨。
- 倍率分为两类：
  1. +Mult (加法倍率)：如当前倍率为 10，+15 Mult 后变为 25。
  2. ×Mult (乘法倍率)：如当前倍率为 25，×3 Mult 后变为 75！
- 【三位一体构筑模型】：一套能稳定通关第 8 底注直至无尽模式的可靠阵容，必须同时具备：
  ① 筹码来源 (Chips)
  ② 加法倍率来源 (+Mult)
  ③ 乘法倍率来源 (×Mult)
  ④ 经济/功能辅助 (Economy/Utility)
  只堆单项后面必然乏力！

二、小丑牌 6 大触发分类与黄金摆放铁律 (从左到右生效)：
- 触发分类：
  1. 打出牌计分时触发 (On scoring)：Half Joker, Fibonacci, Even Steven, Odd Todd, Scholar, Photograph, Hanging Chad
  2. 留在手中触发 (In hand)：Baron (K手持 x1.5 Mult), Shoot the Moon (Q手持 +13 Mult), Reserve Parking
  3. 出牌时触发 (Hand played)：Green Joker, Supernova, Ride the Bus, Red Card, Fortune Teller
  4. 小丑独立结算 (Joker self-calc)：Cavendish (x3), Constellation, Card Sharp, Blackboard, Duo/Trio/Family/Order/Tribe, Acrobat
  5. 商店/回合/弃牌 (Shop/Round/Discard)：Golden Joker, Trading Card, Mail-In Rebate, Castle, Faceless Joker
  6. 复制与重复触发 (Copy & Retrigger)：Blueprint (复制右侧小丑), Brainstorm (复制最左侧小丑), Dusk, Sock and Buskin, Hack, Mime (手牌效果重触)
- 摆放顺序物理铁律：
  【经济/功能小丑】 -> 【+筹码 Chips 小丑】 -> 【+加法倍率 +Mult 小丑】 -> 【重触小丑】 -> 【复制小丑 Blueprint (对齐右边最强xMult)】 -> 【×乘法倍率 ×Mult 小丑最右端】！
- 原理示例：(10 基础 + 15 加法) × 3 乘法 ＝ 75 分；若放反了变成 10 × 3 + 15 ＝ 45 分，整整损失 40% 分数！

三、全部 12 张星球牌 (Planet Cards)：
- 基础 9 种：
  - 冥王星 (Pluto): 高牌 (+10 Chips, +1 Mult)
  - 水星 (Mercury): 对子 (+15 Chips, +1 Mult)
  - 天王星 (Uranus): 两对 (+20 Chips, +1 Mult)
  - 金星 (Venus): 三条 (+20 Chips, +2 Mult)
  - 土星 (Saturn): 顺子 (+30 Chips, +3 Mult)
  - 木星 (Jupiter): 同花 (+15 Chips, +2 Mult)
  - 地球 (Earth): 葫芦 (+25 Chips, +2 Mult)
  - 火星 (Mars): 四条 (+30 Chips, +3 Mult)
  - 海王星 (Neptune): 同花顺 (+40 Chips, +4 Mult)
- 特殊牌型 3 种：
  - X行星 (Planet X): 五条 Five of a Kind (+35 Chips, +3 Mult)
  - 谷神星 (Ceres): 同花葫芦 Flush House (+40 Chips, +4 Mult)
  - 阋神星 (Eris): 同花五条 Flush Five (+50 Chips, +3 Mult)
- 规则：星球牌购买即用，永久提升牌型等级，绝不占用卡槽！

四、全部 18 张幻灵牌 (Spectral Cards) 战术指导：
1. 黑洞 (Black Hole): 所有牌型等级 +1 级！【无脑直接使用】
2. 灵魂 (The Soul): 生成一张传奇小丑牌 (需要小丑空位)！【有空位必用】
3. 献祭 (Immolate): 摧毁手中随机 5 张牌，获得 $20！【前期极大瘦牌与经济提速】
4. 护身符 (Talisman): 为 1 张选定牌附加金色蜡封 (计分时+$3)。
5. 灵气 (Aura): 为 1 张选定牌附加闪箔(+50 Chips)、镭射(+10 Mult)或双色(x1.5 Mult)。
6. 既视感 (Deja Vu): 为 1 张选定牌附加红色蜡封 (重复计分 1 次，核心神蜡封)！
7. 恍惚 (Trance): 为 1 张选定牌附加蓝色蜡封 (回合结束留在手中生成最后打出牌型的星球牌)！
8. 通灵 (Medium): 为 1 张选定牌附加紫色蜡封 (弃牌时生成 1 张随机塔罗牌，刷资源神器)！
9. 密室 (Cryptid): 选择 1 张手牌，复制 2 张完全相同的副本放入牌组 (复制钢铁牌/玻璃牌神级牌)！
10. 死灵 (Wraith): 生成随机稀有小丑，金币归 $0 (仅在资金极低或前期缺乏核心牌时使用)。
11. 咒符 (Sigil): 将手中所有牌变成同一随机花色 (冲同花神器)。
12. 通灵板 (Ouija): 手牌全变成同一随机点数，手牌上限-1 (慎用)。
13. 外质 (Ectoplasm): 随机小丑附加负片(+1槽位)，手牌上限-1。
14. 铁锚 (Ankh): 复制 1 张随机小丑，摧毁其他所有小丑！(严禁在满小丑时使用，仅在只有 1 张核心小丑时使用)。
15. 妖术 (Hex): 随机小丑附加双色(x1.5 Mult)，摧毁其他小丑 (仅单小丑时使用)。
16. 魔宠/阴森/咒语 (Familiar/Grim/Incantation): 摧毁 1 张随机手牌，生成增强的人头牌/A/数字牌。

五、8 种手牌强化 (Enhancements)、4 种蜡封 (Seals) 与 4 种版本 (Editions)：
- 强化：
  1. 钢铁牌 (Steel): 留在手中提供 ×1.5 Mult (配合高牌/对子留在手中，爆分核心！)
  2. 玻璃牌 (Glass): 计分时 ×2 Mult，1/4 几率碎裂 (爆发斩杀 Boss 核心！)
  3. 黄金牌 (Gold): 回合结束留在手中奖励 $3。
  4. 幸运牌 (Lucky): 1/5 几率 +20 Mult，1/15 几率获得 $20。
  5. 筹码牌 (Bonus): 计分时 +30 Chips。
  6. 倍率牌 (Mult): 计分时 +4 Mult。
  7. 万能牌 (Wild): 可充当任何花色。
  8. 石头牌 (Stone): 计分时 +50 Chips，无点数与花色。
- 蜡封：
  - 红色蜡封 (Red Seal): 计分时重复触发 1 次 (双倍享受牌面筹码、强化和倍率)！
  - 蓝色蜡封 (Blue Seal): 回合结束留在手中生成专属星球牌！
  - 紫色蜡封 (Purple Seal): 弃牌时生成塔罗牌！(弃牌阶段极高优先级弃掉紫色蜡封牌白嫖塔罗！)
  - 金色蜡封 (Gold Seal): 参与计分时奖励 $3。
- 版本：
  - 闪箔 (Foil): +50 Chips
  - 镭射 (Holographic): +10 Mult
  - 双色 (Polychrome): ×1.5 Mult
  - 负片 (Negative): +1 小丑卡槽

六、前期节奏与商店刷新铁律：
- 节省出牌次数：剩余的每次出牌都会在过关时转化为 $1 额外奖金。能 1 手牌秒杀绝不用第 2 手！
- 积攒利息本金：每持有 $5 在结算时奖励 $1 利息，持有 $25 时吃满每回合 $5 利息上限。
- 严禁小丑满格 (5/5) 时盲目刷新商店！
- 存款未越过 $25 满利息门槛时，禁止随意刷新！
- 小丑满位时，仅当商店出现决定性的核心乘倍 (×Mult) 或机制神卡且手中有已衰减小丑时，执行智能置换。

七、盲注作战与前两底注生存铁律：
1. 【小盲注与大盲注没有任何 BOSS 限制！】BOSS 词条效果只在 BOSS 盲注关卡生效！
   - 严禁在小盲/大盲为防备未来 BOSS 而故意打垃圾牌或故意放水留手！普通盲注首要目标是全力打出最高分通过、保留剩余手数换钱并进店买小丑！
2. 【底注 1~2 前期生存阶段严禁单走高牌或对子！】
   - 在未建立小丑数值引擎前，高牌/对子基础分极低（单手仅20~60分），出满 4 手也无法打过 450/600 分，盲目打对子是自杀！
   - 前两底注必须依靠高基础分牌型斩杀：【同花 Flush (约280~320分)】、【葫芦 Full House (约300~350分)】、【顺子 Straight (约240~280分)】、【三条 Three of a Kind (约150~180分)】！
   - 只有在中后期拥有+筹码/+Mult小丑、冥王星/水星高等级或大量钢铁牌留手时，才适合转型高牌/对子！
`;
