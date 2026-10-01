import { Card } from '../types.js';
import { getJokerDefinition } from './joker-data.js';

export interface JokerClassification {
  index: number;
  label: string;
  key: string;
  category: 'ECONOMY' | 'CHIPS' | 'FLAT_MULT' | 'RETRIGGER' | 'BLUEPRINT' | 'BRAINSTORM' | 'XMULT';
  categoryRank: number; // 0=Economy, 1=Chips, 2=Flat Mult, 3=Retrigger, 4=Blueprint, 5=XMult
}

export class JokerSorter {
  /**
   * Classify a single Joker based on Balatro 1.0.1o mechanics:
   * 0 = Economy/Utility
   * 1 = +Chips
   * 2 = +Mult (Flat addition)
   * 3 = Retrigger (Repeats scoring or held-in-hand cards: Hanging Chad, Sock & Buskin, Mime, Hack, Dusk)
   * 4 = Blueprint (Must be placed directly to the LEFT of the target xMult)
   * 5 = ×Mult (Multiplicative multiplier, MUST BE ON THE FAR RIGHT)
   */
  static classifyJoker(joker: Card, index: number): JokerClassification {
    const key = (joker.key || '').toLowerCase();
    const label = (joker.label || '').toLowerCase();
    const effect = (joker.value?.effect || '').toLowerCase();
    const mod = joker.modifier as any;
    let edition = '';
    if (typeof mod?.edition === 'string') {
      edition = mod.edition.toLowerCase();
    } else if (Array.isArray(mod)) {
      edition = mod.map(m => String(m)).join(' ').toLowerCase();
    } else if (typeof mod === 'string') {
      edition = mod.toLowerCase();
    }

    // 0. Primary Check: Lookup exact definition from 150-Joker knowledge base
    const def = getJokerDefinition(joker.key) || getJokerDefinition(joker.label);

    // Polychrome edition gives X1.5 Mult, elevating any Joker to XMult tier
    const isPolychrome = edition.includes('poly');

    if (def) {
      if (def.category === 'BLUEPRINT') {
        return { index, label: joker.label || def.name, key: joker.key || def.key, category: 'BLUEPRINT', categoryRank: 4 };
      }
      if (def.category === 'BRAINSTORM') {
        return { index, label: joker.label || def.name, key: joker.key || def.key, category: 'BRAINSTORM', categoryRank: 4 };
      }
      if (isPolychrome || def.category === 'XMULT') {
        return { index, label: joker.label || def.name, key: joker.key || def.key, category: 'XMULT', categoryRank: 5 };
      }
      if (def.category === 'RETRIGGER') {
        return { index, label: joker.label || def.name, key: joker.key || def.key, category: 'RETRIGGER', categoryRank: 3 };
      }
      if (def.category === 'FLAT_MULT') {
        return { index, label: joker.label || def.name, key: joker.key || def.key, category: 'FLAT_MULT', categoryRank: 2 };
      }
      if (def.category === 'CHIPS') {
        return { index, label: joker.label || def.name, key: joker.key || def.key, category: 'CHIPS', categoryRank: 1 };
      }
      // Economy / Utility / Hand Modifier
      return { index, label: joker.label || def.name, key: joker.key || def.key, category: 'ECONOMY', categoryRank: 0 };
    }

    // 1. Copy Jokers (Blueprint & Brainstorm) fallback
    if (key.includes('blueprint') || label.includes('blueprint')) {
      return { index, label: joker.label || key, key, category: 'BLUEPRINT', categoryRank: 4 };
    }
    if (key.includes('brainstorm') || label.includes('brainstorm')) {
      return { index, label: joker.label || key, key, category: 'BRAINSTORM', categoryRank: 4 };
    }

    // 2. Retrigger Jokers (Sock & Buskin, Hanging Chad, Mime, Hack, Dusk)
    const knownRetriggerKeys = [
      'hanging_chad', 'sock_and_buskin', 'sock', 'mime', 'hack', 'dusk', 'seltzer'
    ];
    if (knownRetriggerKeys.some(k => key.includes(k) || label.includes(k)) || effect.includes('retrigger') || effect.includes('再次触发') || effect.includes('重复触发')) {
      return { index, label: joker.label || key, key, category: 'RETRIGGER', categoryRank: 3 };
    }

    // 3. Multiplicative XMult (Highest priority to be placed on the FAR RIGHT)
    const isExplicitXMult = effect.includes('x') || effect.includes('×') || effect.includes('乘') || effect.includes('xmult');
    const knownXMultKeys = [
      'cavendish', 'constellation', 'card_sharp', 'blackboard', 'baron', 'obelisk', 'idol',
      'seeing_double', 'hit_the_road', 'the_duo', 'the_trio', 'the_family', 'the_order', 'the_tribe',
      'canio', 'triboulet', 'yorick', 'driver_license', 'driver', 'bloodstone', 'vampire', 'hologram', 'madness',
      'campfire', 'acrobat', 'throwback', 'ancient', 'ramen', 'photograph', 'glass_joker', 'lucky_cat',
      'the_duo', 'the_trio', 'the_family', 'the_order', 'the_tribe', 'steel_joker'
    ];
    const matchesKnownXMult = knownXMultKeys.some(k => key.includes(k) || label.includes(k));

    if (isExplicitXMult || matchesKnownXMult || isPolychrome) {
      return { index, label: joker.label || key, key, category: 'XMULT', categoryRank: 5 };
    }

    // 4. Economy & Utility Jokers
    const knownEconomyKeys = [
      'drunkard', 'golden', 'trading', 'delayed_grat', 'satellite', 'rocket', 'gift',
      'to_the_moon', 'faceless', 'mail', 'credit_card', 'chaos', 'hallucination', 'fortune_teller',
      'juggler', 'troubadour', 'certificate', 'smeared', 'four_fingers', 'oops', 'diet_cola',
      'luchador', 'chicot', 'matador', 'cartomancer', 'astronomer', 'burglar', 'merry_andy'
    ];
    if (knownEconomyKeys.some(k => key.includes(k) || label.includes(k))) {
      return { index, label: joker.label || key, key, category: 'ECONOMY', categoryRank: 0 };
    }

    // 5. +Chips Jokers
    const isFoil = edition.includes('foil');
    const isChipsEffect = effect.includes('筹码') || effect.includes('chip');
    const knownChipsKeys = [
      'ice_cream', 'blue_joker', 'banner', 'bull', 'scary_face', 'odd_todd', 'sly',
      'wily', 'clever', 'devious', 'crafty', 'square', 'castle', 'hiker', 'runner',
      'wee', 'stuntman', 'arrowhead', 'onyx_agate', 'stone'
    ];
    if (isFoil || isChipsEffect || knownChipsKeys.some(k => key.includes(k) || label.includes(k))) {
      return { index, label: joker.label || key, key, category: 'CHIPS', categoryRank: 1 };
    }

    // 6. Default to +Flat Mult
    return { index, label: joker.label || key, key, category: 'FLAT_MULT', categoryRank: 2 };
  }

  /**
   * Determine optimal permutation of Joker indices to maximize activation order:
   * [Economy/Utility] -> [+Chips] -> [+Flat Mult] -> [Retriggers] -> [Blueprint adjacent to XMult] -> [×Mult on the far right]
   */
  static getOptimalOrder(jokers: Card[]): { needsRearrange: boolean; newOrder: number[]; description: string } {
    if (!jokers || jokers.length <= 1) {
      return { needsRearrange: false, newOrder: jokers.map((_, i) => i), description: '小丑数量不足，无需排序' };
    }

    const classified = jokers.map((j, i) => this.classifyJoker(j, i));

    // Separate by tiers
    const economies = classified.filter(c => c.categoryRank === 0);
    const chips = classified.filter(c => c.categoryRank === 1);
    const flatMults = classified.filter(c => c.categoryRank === 2);
    const retriggers = classified.filter(c => c.categoryRank === 3);
    const blueprints = classified.filter(c => c.category === 'BLUEPRINT');
    const brainstorms = classified.filter(c => c.category === 'BRAINSTORM');
    const xMults = classified.filter(c => c.categoryRank === 5);

    // Assembly rule:
    // Blueprint copies the card to its right.
    // If xMult exists, Blueprint should be placed IMMEDIATELY before the best xMult!
    // If no xMult exists, Blueprint should copy the best +Mult or +Chips card.
    const sortedResult: JokerClassification[] = [
      ...economies,
      ...chips,
      ...flatMults,
      ...retriggers,
      ...brainstorms,
      ...blueprints,
      ...xMults,
    ];

    // Special alignment: If Blueprint and XMult exist, ensure Blueprint is immediately to the left of XMult
    if (blueprints.length > 0 && xMults.length > 0) {
      // Clean assembly:
      const beforeBlueprint = [
        ...economies,
        ...chips,
        ...flatMults,
        ...retriggers,
        ...brainstorms,
      ];
      sortedResult.length = 0;
      sortedResult.push(...beforeBlueprint, ...blueprints, ...xMults);
    }

    const newOrder = sortedResult.map(c => c.index);
    const isAlreadyOptimal = newOrder.every((val, idx) => val === idx);
    const desc = sortedResult.map(c => `[${c.label} (${c.category})]`).join(' -> ');

    return {
      needsRearrange: !isAlreadyOptimal,
      newOrder,
      description: desc,
    };
  }
}
