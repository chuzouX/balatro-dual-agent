import { Card } from '../types.js';

export interface JokerClassification {
  index: number;
  label: string;
  key: string;
  category: 'ECONOMY' | 'CHIPS' | 'FLAT_MULT' | 'XMULT' | 'COPY';
  categoryRank: number; // 0=Economy, 1=Chips, 2=Flat Mult, 3=Copy, 4=XMult
}

export class JokerSorter {
  /**
   * Classify a single Joker into one of the core strategic tiers:
   * 0 = Economy/Utility
   * 1 = +Chips
   * 2 = +Mult (Flat addition)
   * 3 = Copy (Blueprint, Brainstorm)
   * 4 = ×Mult (Multiplicative multiplier, MUST BE ON THE FAR RIGHT)
   */
  static classifyJoker(joker: Card, index: number): JokerClassification {
    const key = (joker.key || '').toLowerCase();
    const label = (joker.label || '').toLowerCase();
    const effect = (joker.value?.effect || '').toLowerCase();
    const edition = (joker.modifier as any)?.edition?.toLowerCase() || '';

    // 1. Copy Jokers (Blueprint, Brainstorm)
    if (key.includes('blueprint') || key.includes('brainstorm') || label.includes('blueprint') || label.includes('brainstorm')) {
      return { index, label: joker.label || key, key, category: 'COPY', categoryRank: 3 };
    }

    // 2. Multiplicative XMult (Highest priority to be placed on the FAR RIGHT)
    const isExplicitXMult = effect.includes('x') || effect.includes('×') || effect.includes('乘');
    const knownXMultKeys = [
      'cavendish', 'constellation', 'card_sharp', 'blackboard', 'baron', 'obelisk', 'idol',
      'seeing_double', 'hit_the_road', 'the_duo', 'the_trio', 'the_family', 'the_order', 'the_tribe',
      'cain', 'triboulet', 'yorick', 'driver_license', 'bloodstone', 'vampire', 'hologram', 'madness',
      'campfire', 'acrobat', 'throwback', 'ancient', 'ramen'
    ];
    const matchesKnownXMult = knownXMultKeys.some(k => key.includes(k) || label.includes(k));
    const isPolychrome = edition.includes('poly');

    if (isExplicitXMult || matchesKnownXMult || isPolychrome) {
      return { index, label: joker.label || key, key, category: 'XMULT', categoryRank: 4 };
    }

    // 3. Economy & Utility Jokers
    const knownEconomyKeys = [
      'drunkard', 'golden', 'trading', 'delayed_grat', 'satellite', 'rocket', 'gift',
      'to_the_moon', 'faceless', 'mail', 'credit_card', 'chaos', 'hallucination', 'fortune_teller',
      'juggler', 'troubadour', 'certificate', 'smeared', 'four_fingers', 'oops', 'diet_cola',
      'luchador', 'chicot'
    ];
    if (knownEconomyKeys.some(k => key.includes(k) || label.includes(k))) {
      return { index, label: joker.label || key, key, category: 'ECONOMY', categoryRank: 0 };
    }

    // 4. +Chips Jokers
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

    // 5. Default to +Flat Mult
    return { index, label: joker.label || key, key, category: 'FLAT_MULT', categoryRank: 2 };
  }

  /**
   * Determine optimal permutation of Joker indices to maximize activation order:
   * [Economy/Utility] -> [+Chips] -> [+Flat Mult] -> [Copy (Blueprint) adjacent to XMult] -> [×Mult on the far right]
   */
  static getOptimalOrder(jokers: Card[]): { needsRearrange: boolean; newOrder: number[]; description: string } {
    if (!jokers || jokers.length <= 1) {
      return { needsRearrange: false, newOrder: jokers.map((_, i) => i), description: '小丑数量不足，无需排序' };
    }

    const classified = jokers.map((j, i) => this.classifyJoker(j, i));

    // Sort order:
    // Economy (0) -> Chips (1) -> Flat Mult (2) -> Copy (3) -> XMult (4)
    // Note: If XMult exists, Copy Jokers (Rank 3) will be placed immediately before or after XMult.
    const sorted = [...classified].sort((a, b) => {
      if (a.categoryRank !== b.categoryRank) {
        return a.categoryRank - b.categoryRank;
      }
      return a.index - b.index;
    });

    const newOrder = sorted.map(c => c.index);

    // Check if the order is already identical
    const isAlreadyOptimal = newOrder.every((val, idx) => val === idx);

    const desc = sorted.map(c => `[${c.label} (${c.category})]`).join(' -> ');

    return {
      needsRearrange: !isAlreadyOptimal,
      newOrder,
      description: desc,
    };
  }
}
