import { Card, HandCandidate, PokerHandInfo } from '../types.js';
import { BASE_HAND_STATS, PLANET_HAND_MAP } from './rules.js';
import { SelfCorrectionEngine } from './self-correction-engine.js';
import { getJokerDefinition, BALATRO_JOKERS, JokerDefinition } from './joker-data.js';

export const RANK_VALUES: Record<string, number> = {
  '2': 2,
  '3': 3,
  '4': 4,
  '5': 5,
  '6': 6,
  '7': 7,
  '8': 8,
  '9': 9,
  '10': 10,
  'T': 10,
  'J': 10,
  'Q': 10,
  'K': 10,
  'A': 11,
};

export const RANK_ORDER: Record<string, number> = {
  '2': 2,
  '3': 3,
  '4': 4,
  '5': 5,
  '6': 6,
  '7': 7,
  '8': 8,
  '9': 9,
  '10': 10,
  'T': 10,
  'J': 11,
  'Q': 12,
  'K': 13,
  'A': 14,
};

export const SUIT_NAMES: Record<string, string> = {
  'S': '♠黑桃',
  'H': '♥红桃',
  'C': '♣梅花',
  'D': '♦方片',
};

export interface CardModifierInfo {
  isSteel: boolean;
  isGlass: boolean;
  isBonus: boolean;
  isMult: boolean;
  isStone: boolean;
  isGold: boolean;
  isLucky: boolean;
  isWild: boolean;
  hasRedSeal: boolean;
  hasBlueSeal: boolean;
  hasPurpleSeal: boolean;
  hasGoldSeal: boolean;
  isFoil: boolean;
  isHolo: boolean;
  isPoly: boolean;
}

export function getCardModifiers(card: Card): CardModifierInfo {
  const str = (
    JSON.stringify(card.modifier || '') +
    ' ' +
    JSON.stringify(card.ability || '') +
    ' ' +
    (card.label || '')
  ).toUpperCase();

  const mods = Array.isArray(card.modifier) ? card.modifier.map(m => String(m).toUpperCase()) : [];

  return {
    isSteel: str.includes('STEEL'),
    isGlass: str.includes('GLASS'),
    isBonus: str.includes('BONUS'),
    isMult: (str.includes('M_MULT') || str.includes('MULT CARD') || mods.some(m => m.includes('MULT') && !m.includes('XMULT'))),
    isStone: str.includes('STONE'),
    isGold: (str.includes('M_GOLD') || str.includes('GOLD CARD') || mods.some(m => m === 'GOLD')),
    isLucky: str.includes('LUCKY'),
    isWild: str.includes('WILD'),
    hasRedSeal: str.includes('RED_SEAL') || str.includes('RED SEAL') || mods.some(m => m.includes('RED')),
    hasBlueSeal: str.includes('BLUE_SEAL') || str.includes('BLUE SEAL') || mods.some(m => m.includes('BLUE')),
    hasPurpleSeal: str.includes('PURPLE_SEAL') || str.includes('PURPLE SEAL') || mods.some(m => m.includes('PURPLE')),
    hasGoldSeal: str.includes('GOLD_SEAL') || str.includes('GOLD SEAL') || mods.some(m => m.includes('GOLD_SEAL')),
    isFoil: str.includes('FOIL'),
    isHolo: str.includes('HOLO'),
    isPoly: str.includes('POLY'),
  };
}

export function handContainsPair(handType: string): boolean {
  return [
    'Pair',
    'Two Pair',
    'Three of a Kind',
    'Full House',
    'Four of a Kind',
    'Five of a Kind',
    'Flush House',
    'Flush Five',
  ].includes(handType);
}

export function handContainsTwoPair(handType: string): boolean {
  return ['Two Pair', 'Full House', 'Flush House'].includes(handType);
}

export function handContainsThreeOfAKind(handType: string): boolean {
  return [
    'Three of a Kind',
    'Full House',
    'Four of a Kind',
    'Five of a Kind',
    'Flush House',
    'Flush Five',
  ].includes(handType);
}

export function handContainsFourOfAKind(handType: string): boolean {
  return ['Four of a Kind', 'Five of a Kind', 'Flush Five'].includes(handType);
}

export function handContainsStraight(handType: string): boolean {
  return ['Straight', 'Straight Flush'].includes(handType);
}

export function handContainsFlush(handType: string): boolean {
  return ['Flush', 'Straight Flush', 'Flush House', 'Flush Five'].includes(handType);
}

export function isCardDebuffed(
  card: Card,
  bossName?: string,
  anteCardsPlayed?: Set<string>,
  hasChicot = false
): boolean {
  if (!card) return false;
  if (hasChicot) return false; // Chicot permanently disables all Boss Blinds
  if ((card as any).debuffed || (card as any).debuff) return true;
  if (!bossName) return false;

  const mod = getCardModifiers(card);
  // Stone cards have NO rank and NO suit, and are immune to suit/face debuffs
  if (mod.isStone) return false;

  const rawRank = (card.value?.rank || '2').toUpperCase();
  const rank = rawRank === 'T' ? '10' : rawRank;
  const suit = (card.value?.suit || 'S').toUpperCase();
  const isFace = rank === 'J' || rank === 'Q' || rank === 'K';

  switch (bossName) {
    case 'The Plant':
      return isFace;
    case 'The Goad':
      return suit === 'S' || mod.isWild;
    case 'The Head':
      return suit === 'H' || mod.isWild;
    case 'The Club':
      return suit === 'C' || mod.isWild;
    case 'The Window':
      return suit === 'D' || mod.isWild;
    case 'The Pillar':
      if (anteCardsPlayed) {
        return anteCardsPlayed.has(`${rank}_${suit}_${card.id}`);
      }
      return false;
    default:
      return false;
  }
}


export interface ExtractedJokerStats {
  chips?: number;
  mult?: number;
  xMult?: number;
}

export function extractJokerStats(joker: Card): ExtractedJokerStats {
  const result: ExtractedJokerStats = {};
  if (!joker) return result;

  const effectStr = [
    joker.value?.effect || '',
    joker.label || '',
    typeof joker.ability?.extra === 'string' ? joker.ability.extra : '',
  ].join(' ');

  // 1. Try to extract dynamic scaling values first: "Currently / 当前 / 目前"
  const currChipsMatch = effectStr.match(/(?:currently|目前|当前)[^0-9\n]*\+\s*(\d+)\s*(?:chips|筹码)/i);
  if (currChipsMatch) {
    result.chips = parseInt(currChipsMatch[1], 10);
  }

  const currMultMatch = effectStr.match(/(?:currently|目前|当前)[^0-9\n]*\+\s*(\d+(?:\.\d+)?)\s*(?:mult|倍率)/i);
  if (currMultMatch) {
    result.mult = parseFloat(currMultMatch[1]);
  }

  const currXMultMatch = effectStr.match(/(?:currently|目前|当前)[^0-9\n]*[xX×]\s*(\d+(?:\.\d+)?)\s*(?:mult|倍率)?/i);
  if (currXMultMatch) {
    result.xMult = parseFloat(currXMultMatch[1]);
  }

  // 2. Static / Flat value extraction if dynamic regex was not found
  if (result.chips === undefined) {
    const chipsMatch = effectStr.match(/\+\s*(\d+)\s*(?:chips|筹码)/i);
    if (chipsMatch) {
      result.chips = parseInt(chipsMatch[1], 10);
    }
  }

  if (result.mult === undefined) {
    const multMatch = effectStr.match(/\+\s*(\d+(?:\.\d+)?)\s*(?:mult|倍率)/i);
    if (multMatch) {
      result.mult = parseFloat(multMatch[1]);
    }
  }

  if (result.xMult === undefined) {
    const xMultMatch = effectStr.match(/[xX×]\s*(\d+(?:\.\d+)?)\s*(?:mult|倍率)?/i);
    if (xMultMatch) {
      const val = parseFloat(xMultMatch[1]);
      if (val > 1.0) {
        result.xMult = val;
      }
    }
  }

  // 3. Fallback to joker.ability if available
  const ability = joker.ability || {};
  if (result.chips === undefined && typeof ability.chips === 'number') {
    result.chips = ability.chips;
  }
  if (result.mult === undefined && typeof ability.mult === 'number') {
    result.mult = ability.mult;
  }
  if (result.xMult === undefined) {
    if (typeof ability.x_mult === 'number') {
      result.xMult = ability.x_mult;
    } else if (typeof ability.xmult === 'number') {
      result.xMult = ability.xmult;
    } else if (typeof ability.extra_x_mult === 'number') {
      result.xMult = ability.extra_x_mult;
    }
  }

  // 4. Ability.extra could be a number or object
  if (typeof ability.extra === 'number') {
    if (result.chips === undefined && (joker.key?.includes('ice_cream') || joker.key?.includes('castle') || joker.key?.includes('runner') || joker.key?.includes('square'))) {
      result.chips = ability.extra;
    }
    if (result.mult === undefined && (joker.key?.includes('popcorn') || joker.key?.includes('half') || joker.key?.includes('swashbuckler'))) {
      result.mult = ability.extra;
    }
    if (result.xMult === undefined && ability.extra > 1.0 && (
      joker.key?.includes('cavendish') ||
      joker.key?.includes('constellation') ||
      joker.key?.includes('hologram') ||
      joker.key?.includes('campfire')
    )) {
      result.xMult = ability.extra;
    }
  } else if (typeof ability.extra === 'object' && ability.extra !== null) {
    const extraObj = ability.extra as Record<string, unknown>;
    if (result.chips === undefined && typeof extraObj.chips === 'number') {
      result.chips = extraObj.chips;
    }
    if (result.mult === undefined && typeof extraObj.mult === 'number') {
      result.mult = extraObj.mult;
    }
    if (result.xMult === undefined && typeof extraObj.x_mult === 'number') {
      result.xMult = extraObj.x_mult;
    } else if (result.xMult === undefined && typeof extraObj.Xmult === 'number') {
      result.xMult = extraObj.Xmult;
    }
  }


  // 5. Fallback to 150-Joker Knowledge Base definition
  const def = getJokerDefinition(joker.key) || getJokerDefinition(joker.label);
  if (def) {
    if (result.chips === undefined && def.baseChips !== undefined) {
      result.chips = def.baseChips;
    }
    if (result.mult === undefined && def.baseMult !== undefined) {
      result.mult = def.baseMult;
    }
    if (result.xMult === undefined && def.baseXMult !== undefined) {
      result.xMult = def.baseXMult;
    }
  }

  return result;
}

export interface ResolvedJoker {
  joker: Card;
  originalEdition: string;
}

export function resolveEffectiveJokers(jokers: Card[]): ResolvedJoker[] {
  if (!jokers || jokers.length === 0) return [];

  const getEdition = (j: Card): string => {
    if (!j || !j.modifier) return '';
    const mod = j.modifier as any;
    if (typeof mod?.edition === 'string') {
      return mod.edition.toLowerCase();
    }
    if (Array.isArray(mod)) {
      return mod.map(m => String(m)).join(' ').toLowerCase();
    }
    if (typeof mod === 'string') {
      return mod.toLowerCase();
    }
    try {
      return JSON.stringify(mod).toLowerCase();
    } catch {
      return '';
    }
  };

  const findTarget = (startIndex: number, visited: Set<number>, isBrainstorm: boolean): Card | null => {
    let targetIndex = isBrainstorm ? 0 : startIndex + 1;
    if (isBrainstorm && targetIndex === startIndex) {
      for (let i = 0; i < jokers.length; i++) {
        if (i !== startIndex) {
          targetIndex = i;
          break;
        }
      }
    }

    if (targetIndex < 0 || targetIndex >= jokers.length || visited.has(targetIndex)) {
      return null;
    }

    visited.add(targetIndex);
    const target = jokers[targetIndex];
    const key = (target.key || target.label || '').toLowerCase();

    if (key.includes('blueprint')) {
      return findTarget(targetIndex, visited, false);
    }
    if (key.includes('brainstorm')) {
      return findTarget(targetIndex, visited, true);
    }

    // Check blueprint compatibility from definition
    const targetDef = getJokerDefinition(target.key || target.label);
    if (targetDef && targetDef.blueprintCompat === false) {
      return null;
    }

    return target;
  };

  return jokers.map((j, idx) => {
    const key = (j.key || j.label || '').toLowerCase();
    const originalEdition = getEdition(j);

    if (key.includes('blueprint')) {
      const target = findTarget(idx, new Set([idx]), false);
      if (target) {
        return { joker: { ...target, id: j.id }, originalEdition };
      }
    } else if (key.includes('brainstorm')) {
      const target = findTarget(idx, new Set([idx]), true);
      if (target) {
        return { joker: { ...target, id: j.id }, originalEdition };
      }
    }

    return { joker: j, originalEdition };
  });
}

export interface EvaluatedPokerHand {
  handType: string;
  scoringCardIndices: number[];
  chips: number;
  mult: number;
  totalScore: number;
  description: string;
}

export class PokerEvaluator {
  /**
   * Calculate legacy Joker bonuses for compatibility
   */
  static evaluateJokers(
    jokers: Card[],
    context: {
      handType: string;
      scoringCards: Card[];
      allPlayedCards: Card[];
      heldCards: Card[];
      remainingDiscards: number;
      remainingHands: number;
      money: number;
      handsPlayedThisRound?: number;
      bossName?: string;
    }
  ): { flatChips: number; flatMult: number; xMult: number } {
    const dummyCards = [...context.scoringCards, ...context.heldCards];
    const dummyIndices = context.scoringCards.map((_, i) => i);
    const evalResult = this.evaluateCombination(dummyCards, dummyIndices, undefined, jokers, {
      remainingDiscards: context.remainingDiscards,
      remainingHands: context.remainingHands,
      money: context.money,
      handsPlayedThisRound: context.handsPlayedThisRound,
      bossName: context.bossName,
    });

    const base = (BASE_HAND_STATS as any)[evalResult.handType] || { chips: 10, mult: 2 };
    const flatChips = Math.max(0, evalResult.chips - base.chips);
    const flatMult = Math.max(0, evalResult.mult - base.mult);
    return { flatChips, flatMult, xMult: 1.0 };
  }

  /**
   * Deterministic 6-Phase Physical Scoring Pipeline based on balatrolator and balatro-calculator:
   * Phase 1: Base Phase (Hand levels & The Flint check)
   * Phase 2: Played Cards Phase (Left-to-right triggers, rank chips, enhancements, editions, card jokers)
   * Phase 3: Held Cards Phase (Steel x1.5, Baron x1.5, Shoot the Moon +13, Mime triggers, Raised Fist)
   * Phase 4: Jokers Phase (Blueprint/Brainstorm resolution, dynamic scaling values, condition checks, editions)
   * Phase 5: Observatory Phase (Held planet cards x1.5)
   * Phase 6: Deck Phase (Plasma deck chip/mult balancing, Boss zero-score checks)
   */
  static evaluateCombination(
    cards: Card[],
    indices: number[],
    handLevels?: Record<string, PokerHandInfo>,
    jokers?: Card[],
    jokerContext?: {
      remainingDiscards?: number;
      remainingHands?: number;
      money?: number;
      handsPlayedThisRound?: number;
      bossName?: string;
      deck?: string;
      consumables?: Card[];
      mouthLockedHandType?: string | null;
      eyePlayedHandTypes?: Set<string>;
      jokerLimit?: number;
      deckCardCount?: number;
      enhancedCardCount?: number;
      steelCardCount?: number;
      stoneCardCount?: number;
    }
  ): EvaluatedPokerHand {
    const selected = indices.map(idx => cards[idx]);
    if (selected.length === 0 || selected.length > 5) {
      return { handType: 'High Card', scoringCardIndices: [], chips: 0, mult: 0, totalScore: 0, description: 'None' };
    }

    const resolvedJokers = resolveEffectiveJokers(jokers || []);

    const hasFourFingers = resolvedJokers.some(r => {
      const k = (r.joker.key || r.joker.label || '').toLowerCase();
      return k.includes('four_fingers') || k.includes('four fingers');
    });
    const hasShortcut = resolvedJokers.some(r => {
      const k = (r.joker.key || r.joker.label || '').toLowerCase();
      return k.includes('shortcut');
    });
    const hasSmeared = resolvedJokers.some(r => {
      const k = (r.joker.key || r.joker.label || '').toLowerCase();
      return k.includes('smeared');
    });
    const hasSplash = resolvedJokers.some(r => {
      const k = (r.joker.key || r.joker.label || '').toLowerCase();
      return k.includes('splash');
    });
    const hasPareidolia = resolvedJokers.some(r => {
      const k = (r.joker.key || r.joker.label || '').toLowerCase();
      return k.includes('pareidolia');
    });
    const hasChicot = resolvedJokers.some(r => {
      const k = (r.joker.key || r.joker.label || '').toLowerCase();
      return k.includes('chicot');
    });

    const flushRequired = hasFourFingers ? 4 : 5;
    const straightRequired = hasFourFingers ? 4 : 5;


    const rankCounts: Record<string, number> = {};
    const rankIndices: Record<string, number[]> = {};
    const suitCounts: Record<string, number> = { S: 0, H: 0, C: 0, D: 0 };
    let wildCount = 0;

    for (let i = 0; i < indices.length; i++) {
      const idx = indices[i];
      const card = cards[idx];
      const mod = getCardModifiers(card);
      const rawRank = card.value?.rank || '2';
      const rank = mod.isStone ? 'STONE' : (rawRank === 'T' ? '10' : rawRank);
      const suit = card.value?.suit || 'S';

      if (mod.isWild) {
        wildCount++;
      } else if (!mod.isStone) {
        suitCounts[suit] = (suitCounts[suit] || 0) + 1;
      }

      rankCounts[rank] = (rankCounts[rank] || 0) + 1;
      if (!rankIndices[rank]) rankIndices[rank] = [];
      rankIndices[rank].push(idx);
    }

    // Flush check (respecting Smeared Joker: Hearts==Diamonds and Spades==Clubs)
    let isFlush = false;
    if (hasSmeared) {
      const redCount = (suitCounts['H'] || 0) + (suitCounts['D'] || 0) + wildCount;
      const blackCount = (suitCounts['S'] || 0) + (suitCounts['C'] || 0) + wildCount;
      if (redCount >= flushRequired || blackCount >= flushRequired) {
        isFlush = true;
      }
    } else {
      for (const s of ['S', 'H', 'C', 'D']) {
        if ((suitCounts[s] + wildCount) >= flushRequired) {
          isFlush = true;
          break;
        }
      }
    }

    // Straight check (respecting Four Fingers & Shortcut 1-rank gaps)
    let isStraight = false;
    const nonStoneCards = selected.filter(c => !getCardModifiers(c).isStone);
    if (nonStoneCards.length >= straightRequired) {
      const ranksPresent = new Set<number>();
      for (const c of nonStoneCards) {
        const rawRank = c.value?.rank || '2';
        const r = rawRank === 'T' ? '10' : rawRank;
        const val = RANK_ORDER[r] || 2;
        ranksPresent.add(val);
      }

      let straightLength = 0;
      let skippedRank = false;
      for (let j = 1; j <= 14; j++) {
        const rankKey = j === 1 ? 14 : j;
        if (ranksPresent.has(rankKey)) {
          straightLength++;
          skippedRank = false;
        } else if (hasShortcut && !skippedRank && j !== 14) {
          skippedRank = true;
        } else {
          straightLength = 0;
          skippedRank = false;
        }
        if (straightLength >= straightRequired) {
          isStraight = true;
          break;
        }
      }
    }



    const counts = Object.entries(rankCounts)
      .filter(([r]) => r !== 'STONE')
      .sort((a, b) => b[1] - a[1]);

    let handType = 'High Card';
    let scoringIndices: number[] = [];

    // Hand Hierarchy
    if (counts[0] && counts[0][1] >= 5 && isFlush) {
      handType = 'Flush Five';
      scoringIndices = rankIndices[counts[0][0]].slice(0, 5);
    } else if (counts[0] && counts[0][1] >= 3 && counts[1] && counts[1][1] >= 2 && isFlush) {
      handType = 'Flush House';
      scoringIndices = [...rankIndices[counts[0][0]].slice(0, 3), ...rankIndices[counts[1][0]].slice(0, 2)];
    } else if (counts[0] && counts[0][1] >= 5) {
      handType = 'Five of a Kind';
      scoringIndices = rankIndices[counts[0][0]].slice(0, 5);
    } else if (isFlush && isStraight) {
      handType = 'Straight Flush';
      scoringIndices = [...indices];
    } else if (counts[0] && counts[0][1] >= 4) {
      handType = 'Four of a Kind';
      scoringIndices = rankIndices[counts[0][0]].slice(0, 4);
    } else if (counts[0] && counts[0][1] >= 3 && counts[1] && counts[1][1] >= 2) {
      handType = 'Full House';
      scoringIndices = [...rankIndices[counts[0][0]].slice(0, 3), ...rankIndices[counts[1][0]].slice(0, 2)];
    } else if (isFlush) {
      handType = 'Flush';
      scoringIndices = [...indices];
    } else if (isStraight) {
      handType = 'Straight';
      scoringIndices = [...indices];
    } else if (counts[0] && counts[0][1] >= 3) {
      handType = 'Three of a Kind';
      scoringIndices = rankIndices[counts[0][0]].slice(0, 3);
    } else if (counts[0] && counts[0][1] >= 2 && counts[1] && counts[1][1] >= 2) {
      handType = 'Two Pair';
      scoringIndices = [...rankIndices[counts[0][0]].slice(0, 2), ...rankIndices[counts[1][0]].slice(0, 2)];
    } else if (counts[0] && counts[0][1] >= 2) {
      handType = 'Pair';
      scoringIndices = rankIndices[counts[0][0]].slice(0, 2);
    } else {
      handType = 'High Card';
      const highestCard = indices
        .map(i => {
          const rawRank = cards[i].value?.rank || '2';
          const r = rawRank === 'T' ? '10' : rawRank;
          return { idx: i, val: RANK_ORDER[r] || 0 };
        })
        .sort((a, b) => b.val - a.val)[0];
      scoringIndices = highestCard ? [highestCard.idx] : [];
    }

    // Splash Joker: every played card scores!
    if (hasSplash) {
      scoringIndices = [...indices];
    } else {
      // Always include any Stone cards played in scoringIndices
      for (const idx of indices) {
        if (getCardModifiers(cards[idx]).isStone && !scoringIndices.includes(idx)) {
          scoringIndices.push(idx);
        }
      }
    }

    // Preserve natural left-to-right play order
    scoringIndices.sort((a, b) => indices.indexOf(a) - indices.indexOf(b));

    // ─────────────────────────────────────────────────────────────
    // Phase 1: Base Phase (Hand Levels & The Flint check)
    // ─────────────────────────────────────────────────────────────
    // Chicot disables all Boss Blinds permanently
    const bossName = hasChicot ? undefined : jokerContext?.bossName;
    const base = (handLevels && handLevels[handType]) || BASE_HAND_STATS[handType] || { chips: 10, mult: 1 };
    let chips = base.chips;
    let mult = base.mult;

    if (bossName === 'The Flint') {
      chips = Math.max(1, Math.round(chips * 0.5));
      mult = Math.max(1, Math.round(mult * 0.5));
    }

    // ─────────────────────────────────────────────────────────────
    // Phase 2: Played Cards Phase (Left to right)
    // ─────────────────────────────────────────────────────────────
    let hasHangingChadCount = 0;
    let hasHackCount = 0;
    let hasSockAndBuskinCount = 0;
    let hasDuskCount = 0;
    let hasSeltzerCount = 0;

    for (const r of resolvedJokers) {
      const k = (r.joker.key || r.joker.label || '').toLowerCase();
      if (k.includes('hanging_chad') || k.includes('hanging chad')) hasHangingChadCount++;
      if (k.includes('hack')) hasHackCount++;
      if (k.includes('sock_and_buskin') || k.includes('sock and buskin')) hasSockAndBuskinCount++;
      if (k.includes('dusk')) hasDuskCount++;
      if (k.includes('seltzer')) hasSeltzerCount++;
    }

    const remainingHands = jokerContext?.remainingHands ?? 1;
    const remainingDiscards = jokerContext?.remainingDiscards ?? 0;
    const money = jokerContext?.money ?? 0;
    const handsPlayedThisRound = jokerContext?.handsPlayedThisRound ?? 0;

    let firstFaceCardScored = false;

    for (let sIdx = 0; sIdx < scoringIndices.length; sIdx++) {
      const cardIdx = scoringIndices[sIdx];
      const card = cards[cardIdx];
      const mod = getCardModifiers(card);
      const rawRank = card.value?.rank || '2';
      const rank = rawRank === 'T' ? '10' : rawRank;
      const suit = card.value?.suit || 'S';
      const isFace = hasPareidolia || rank === 'J' || rank === 'Q' || rank === 'K';
      const isAce = rank === 'A';
      const debuffed = isCardDebuffed(card, bossName, undefined, hasChicot);

      let triggers = 1;
      if (mod.hasRedSeal) triggers += 1;
      if (sIdx === 0) triggers += 2 * hasHangingChadCount;
      if (['2', '3', '4', '5'].includes(rank)) triggers += 1 * hasHackCount;
      if (isFace) triggers += 1 * hasSockAndBuskinCount;
      if (remainingHands === 1) triggers += 1 * hasDuskCount;
      triggers += 1 * hasSeltzerCount;

      for (let t = 0; t < triggers; t++) {
        if (debuffed) {
          if (mod.isStone) chips += 50;
          continue;
        }

        // 1. Rank chips
        if (mod.isStone) {
          chips += 50;
        } else {
          chips += RANK_VALUES[rank] || 2;
        }

        // 2. Enhancements
        if (mod.isBonus) chips += 30;
        if (mod.isMult) mult += 4;
        if (mod.isLucky) mult += 4;
        if (mod.isGlass) mult = mult * 2.0;

        // 3. Editions
        if (mod.isFoil) chips += 50;
        if (mod.isHolo) mult += 10;
        if (mod.isPoly) mult = mult * 1.5;

        // 4. Card-triggered Jokers
        for (const r of resolvedJokers) {
          const j = r.joker;
          const k = (j.key || j.label || '').toLowerCase();
          const stats = extractJokerStats(j);

          if (isFace) {
            if (k.includes('scary_face') || k.includes('scary face') || k === 'j_scary_face') {
              chips += (stats.chips ?? 30);
            }
            if (k.includes('smiley') || k.includes('smiley_face')) {
              mult += (stats.mult ?? 5);
            }
            if (k.includes('photograph') && !firstFaceCardScored) {
              mult = mult * (stats.xMult ?? 2.0);
              firstFaceCardScored = true;
            }
          }



          if (isAce && (k.includes('scholar') || k.includes('scholar'))) {
            chips += 20;
            mult += 4;
          }
          if ((rank === '10' || rank === '4') && (k.includes('walkie_talkie') || k.includes('walkie talkie'))) {
            chips += 10;
            mult += 4;
          }
          if (['A', '2', '3', '5', '8'].includes(rank) && (k.includes('fibonacci') || k.includes('fibonacci'))) {
            mult += 8;
          }
          if (['2', '4', '6', '8', '10'].includes(rank) && (k.includes('even_steven') || k.includes('even steven'))) {
            mult += 4;
          }
          if (['A', '3', '5', '7', '9'].includes(rank) && (k.includes('odd_todd') || k.includes('odd todd'))) {
            chips += 31;
          }
          if (rank === '2' && (k.includes('wee_joker') || k.includes('wee joker'))) {
            const stats = extractJokerStats(j);
            chips += stats.chips || 8;
          }
          if (k.includes('hiker')) {
            chips += 5;
          }
          if ((rank === 'K' || rank === 'Q' || (hasPareidolia && isFace)) && (k.includes('triboulet') || k.includes('triboulet'))) {
            mult = mult * 2.0;
          }
          if (k === 'j_idol' || k.includes('the idol') || (k.includes('idol') && !k.includes('pareidolia'))) {
            const extraObj = typeof j.ability?.extra === 'object' && j.ability?.extra !== null ? (j.ability.extra as Record<string, unknown>) : undefined;
            const idolSuit = extraObj?.suit;
            const idolRank = extraObj?.rank;
            if ((!idolSuit || suit === idolSuit) && (!idolRank || rank === idolRank)) {
              mult = mult * 2.0;
            }
          }



          // Suit triggers (respecting Smeared Joker: Hearts==Diamonds, Spades==Clubs, and Wild Cards)
          const isDiamonds = suit === 'D' || mod.isWild || (hasSmeared && suit === 'H');
          const isHearts = suit === 'H' || mod.isWild || (hasSmeared && suit === 'D');
          const isSpades = suit === 'S' || mod.isWild || (hasSmeared && suit === 'C');
          const isClubs = suit === 'C' || mod.isWild || (hasSmeared && suit === 'S');

          if (isHearts) {
            if (k.includes('lusty')) mult += (stats.mult ?? 3);
            if (k.includes('bloodstone')) mult = mult * (stats.xMult ?? 1.5);
          }
          if (isDiamonds) {
            if (k.includes('greedy') || k.includes('dapper')) mult += (stats.mult ?? 3);
          }
          if (isSpades) {
            if (k.includes('wrathful')) mult += (stats.mult ?? 3);
            if (k.includes('arrowhead')) chips += (stats.chips ?? 50);
          }
          if (isClubs) {
            if (k.includes('gluttonous') || k.includes('gluttenous')) mult += (stats.mult ?? 3);
            if (k.includes('onyx')) mult += (stats.mult ?? 7);
          }
          if (k.includes('ancient')) {
            const extraObj = typeof j.ability?.extra === 'object' && j.ability?.extra !== null ? (j.ability.extra as Record<string, unknown>) : undefined;
            const ancientSuit = extraObj?.suit || (typeof j.ability?.extra === 'string' ? j.ability.extra : null);
            if (!ancientSuit || suit === ancientSuit || (hasSmeared && ((ancientSuit === 'Hearts' && suit === 'Diamonds') || (ancientSuit === 'Diamonds' && suit === 'Hearts') || (ancientSuit === 'Spades' && suit === 'Clubs') || (ancientSuit === 'Clubs' && suit === 'Spades')))) {
              mult = mult * (stats.xMult ?? 1.5);
            }
          }
        }
      }

      if (isFace) {
        firstFaceCardScored = true;
      }
    }

    // ─────────────────────────────────────────────────────────────
    // Phase 3: Held Cards Phase (In-hand effects)
    // ─────────────────────────────────────────────────────────────
    const heldCards = cards.filter((_, i) => !indices.includes(i));
    let mimeCount = 0;
    let baronCount = 0;
    let shootTheMoonCount = 0;
    let hasRaisedFist = false;

    for (const r of resolvedJokers) {
      const k = (r.joker.key || r.joker.label || '').toLowerCase();
      if (k.includes('mime')) mimeCount++;
      if (k.includes('baron')) baronCount++;
      if (k.includes('shoot_the_moon') || k.includes('shoot the moon')) shootTheMoonCount++;
      if (k.includes('raised_fist') || k.includes('raised fist')) hasRaisedFist = true;
    }

    let lowestRankVal = 999;

    for (const card of heldCards) {
      const mod = getCardModifiers(card);
      const rawRank = card.value?.rank || '2';
      const rank = rawRank === 'T' ? '10' : rawRank;
      const debuffed = isCardDebuffed(card, bossName);

      if (!mod.isStone) {
        const val = RANK_VALUES[rank] || 2;
        if (val < lowestRankVal) lowestRankVal = val;
      }

      if (debuffed) continue;

      const triggers = 1 + (mod.hasRedSeal ? 1 : 0) + mimeCount;

      for (let t = 0; t < triggers; t++) {
        if (mod.isSteel) {
          mult = mult * 1.5;
        }
        if (rank === 'K' && baronCount > 0) {
          for (let b = 0; b < baronCount; b++) {
            mult = mult * 1.5;
          }
        }
        if (rank === 'Q' && shootTheMoonCount > 0) {
          mult += 13 * shootTheMoonCount;
        }
      }
    }

    if (hasRaisedFist && lowestRankVal < 999) {
      mult += 2 * lowestRankVal;
    }

    // ─────────────────────────────────────────────────────────────
    // Phase 4: Jokers Phase (Left-to-right evaluation)
    // ─────────────────────────────────────────────────────────────
    const allPlayedCards = indices.map(i => cards[i]);

    for (const r of resolvedJokers) {
      const j = r.joker;
      const k = (j.key || j.label || '').toLowerCase();
      const stats = extractJokerStats(j);

      // Card-triggered and in-hand jokers already triggered in Phase 2 or Phase 3; only their edition applies in Phase 4
      const isCardOrHeldTriggerJoker =
        k.includes('photograph') ||
        k.includes('bloodstone') ||
        k.includes('triboulet') ||
        k.includes('ancient') ||
        (k === 'j_idol' || k.includes('the idol') || (k.includes('idol') && !k.includes('pareidolia'))) ||

        k.includes('greedy') ||
        k.includes('lusty') ||
        k.includes('wrathful') ||
        k.includes('gluttonous') ||
        k.includes('gluttenous') ||
        k.includes('arrowhead') ||
        k.includes('onyx') ||
        k.includes('rough_gem') ||
        k.includes('scary_face') ||
        k.includes('smiley') ||
        k.includes('scholar') ||
        k.includes('walkie_talkie') ||
        k.includes('fibonacci') ||
        k.includes('even_steven') ||
        k.includes('odd_todd') ||
        k.includes('wee') ||
        k.includes('hiker') ||
        k.includes('baron') ||
        k.includes('shoot_the_moon') ||
        k.includes('hanging_chad') ||
        k.includes('hack') ||
        k.includes('sock_and_buskin') ||
        k.includes('dusk') ||
        k.includes('selzer') ||
        k.includes('seltzer') ||
        k.includes('mime') ||
        k.includes('four_fingers') ||
        k.includes('shortcut') ||
        k.includes('smeared') ||
        k.includes('splash') ||
        k.includes('pareidolia') ||
        k.includes('chicot');

      if (isCardOrHeldTriggerJoker) {
        const editionStr = (r.originalEdition || '').toLowerCase();

        if (editionStr.includes('foil')) chips += 50;
        if (editionStr.includes('holo')) mult += 10;
        if (editionStr.includes('poly')) mult = mult * 1.5;
        continue;
      }

      // Chip Jokers
      if (k.includes('ice_cream') || k.includes('ice cream')) {
        chips += stats.chips ?? 100;
      } else if (k.includes('blue_joker') || k.includes('blue joker')) {
        chips += stats.chips ?? (2 * 52);
      } else if (k.includes('banner')) {
        chips += (stats.chips ?? 30) * remainingDiscards;
      } else if (k.includes('bull')) {
        chips += 2 * money;
      } else if (k.includes('stuntman')) {
        chips += stats.chips ?? 250;
      } else if (k.includes('castle')) {
        chips += stats.chips ?? 30;
      } else if (k.includes('runner')) {
        chips += stats.chips ?? 15;
      } else if (k.includes('square')) {
        chips += stats.chips ?? 16;
      } else if (k.includes('stone') && !k.includes('stone_card')) {
        chips += stats.chips ?? 25;
      } else if (k.includes('sly') && handContainsPair(handType)) {
        chips += stats.chips ?? 50;
      } else if (k.includes('wily') && handContainsThreeOfAKind(handType)) {
        chips += stats.chips ?? 100;
      } else if (k.includes('clever') && handContainsTwoPair(handType)) {
        chips += stats.chips ?? 80;
      } else if (k.includes('devious') && handContainsStraight(handType)) {
        chips += stats.chips ?? 100;
      } else if (k.includes('crafty') && handContainsFlush(handType)) {
        chips += stats.chips ?? 80;
      } else if (stats.chips && stats.chips > 0) {
        chips += stats.chips;
      }

      // Flat Mult Jokers
      if ((k === 'j_joker' || k === 'joker') && !k.includes('greedy') && !k.includes('lusty') && !k.includes('blue')) {
        mult += stats.mult ?? 4;
      } else if (k.includes('gros_michel') || k.includes('gros michel')) {
        mult += stats.mult ?? 15;
      } else if (k.includes('popcorn')) {
        mult += stats.mult ?? 20;
      } else if (k.includes('half') && allPlayedCards.length <= 3) {
        mult += stats.mult ?? 20;
      } else if (k.includes('mystic_summit') || k.includes('mystic summit')) {
        if (remainingDiscards === 0) mult += stats.mult ?? 15;
      } else if (k.includes('misprint')) {
        mult += stats.mult ?? 11;
      } else if (k.includes('swashbuckler')) {
        mult += stats.mult ?? 10;
      } else if (k.includes('supernova')) {
        const playedCount = handLevels?.[handType]?.played ?? 6;
        mult += stats.mult ?? playedCount;
      } else if (k.includes('fortune_teller') || k.includes('fortune teller')) {
        mult += stats.mult ?? 8;
      } else if (k.includes('green_joker') || k.includes('green joker')) {
        mult += stats.mult ?? 10;
      } else if (k.includes('ride_the_bus') || k.includes('ride the bus')) {
        mult += stats.mult ?? 8;
      } else if (k.includes('red_card') || k.includes('red card')) {
        mult += stats.mult ?? 9;
      } else if (k.includes('flash_card') || k.includes('flash card') || k === 'j_flash') {
        mult += stats.mult ?? 8;
      } else if (k.includes('abstract_joker') || k.includes('abstract joker') || k === 'j_abstract') {
        mult += 3 * (jokers?.length || 1);
      } else if (k.includes('bootstraps')) {
        mult += 2 * Math.floor(money / 5);
      } else if (k.includes('erosion')) {
        mult += stats.mult ?? 4;
      } else if (k.includes('trousers') && (handContainsTwoPair(handType) || handType === 'Full House')) {
        mult += stats.mult ?? 2;
      } else if (k.includes('jolly') && handContainsPair(handType)) {
        mult += stats.mult ?? 8;
      } else if (k.includes('zany') && handContainsThreeOfAKind(handType)) {
        mult += stats.mult ?? 12;
      } else if ((k === 'j_mad' || k.includes('mad joker') || (k.includes('mad') && !k.includes('madness'))) && handContainsTwoPair(handType)) {

        mult += stats.mult ?? 10;
      } else if (k.includes('crazy') && handContainsStraight(handType)) {
        mult += stats.mult ?? 12;
      } else if (k.includes('droll') && handContainsFlush(handType)) {
        mult += stats.mult ?? 10;
      } else if (stats.mult && stats.mult > 0) {
        mult += stats.mult;
      }

      // XMult Jokers
      if (k.includes('cavendish')) {
        mult = mult * (stats.xMult ?? 3.0);
      } else if (k.includes('the_duo') && handContainsPair(handType)) {
        mult = mult * (stats.xMult ?? 2.0);
      } else if (k.includes('the_trio') && handContainsThreeOfAKind(handType)) {
        mult = mult * (stats.xMult ?? 3.0);
      } else if (k.includes('the_family') && handContainsFourOfAKind(handType)) {
        mult = mult * (stats.xMult ?? 4.0);
      } else if (k.includes('the_order') && handContainsStraight(handType)) {
        mult = mult * (stats.xMult ?? 3.0);
      } else if (k.includes('the_tribe') && handContainsFlush(handType)) {
        mult = mult * (stats.xMult ?? 2.0);
      } else if (k.includes('card_sharp') || k.includes('card sharp')) {
        if (handsPlayedThisRound > 0) mult = mult * (stats.xMult ?? 3.0);
      } else if (k.includes('blackboard')) {
        const allBlack = heldCards.every(c => {
          const s = c.value?.suit;
          const mod = getCardModifiers(c);
          return s === 'S' || s === 'C' || mod.isStone;
        });
        if (allBlack) mult = mult * (stats.xMult ?? 3.0);
      } else if (k.includes('acrobat') && remainingHands === 1) {
        mult = mult * (stats.xMult ?? 3.0);
      } else if (k.includes('stencil')) {
        const emptySlots = Math.max(0, 5 - (jokers?.length || 1));
        mult = mult * (1 + emptySlots);
      } else if (k.includes('loyalty_card') || k.includes('loyalty')) {
        mult = mult * (stats.xMult ?? 4.0);
      } else if (k.includes('seeing_double')) {
        const hasClub = scoringIndices.some(i => cards[i]?.value?.suit === 'C');
        const hasOther = scoringIndices.some(i => cards[i]?.value?.suit && cards[i].value!.suit !== 'C');
        if (hasClub && hasOther) mult = mult * 2.0;
      } else if (k.includes('flower_pot')) {
        const suits = { S: false, H: false, C: false, D: false };
        for (const i of scoringIndices) {
          const s = cards[i]?.value?.suit;
          if (s && s in suits) (suits as Record<string, boolean>)[s] = true;
        }
        if (suits.S && suits.H && suits.C && suits.D) mult = mult * 3.0;
      } else if (k.includes('baseball')) {
        const uncommonCount = (jokers || []).filter(item => getJokerDefinition(item.key || item.label)?.rarity === 2).length;
        if (uncommonCount > 0) mult = mult * Math.pow(1.5, uncommonCount);
      } else if (k.includes('drivers_license') || k.includes('driver')) {
        mult = mult * (stats.xMult ?? 3.0);
      } else if (k.includes('steel_joker')) {
        mult = mult * (stats.xMult ?? 1.2);
      } else if (k.includes('constellation') || k.includes('hologram') || k.includes('vampire') || k.includes('madness') || k.includes('campfire') || k.includes('throwback') || k.includes('ramen') || k.includes('obelisk') || k.includes('lucky_cat') || k.includes('glass') || k.includes('hit_the_road') || k.includes('caino') || k.includes('yorick')) {
        mult = mult * (stats.xMult ?? 1.0);
      } else if (stats.xMult && stats.xMult > 1.0) {
        mult = mult * stats.xMult;
      }

      // Joker Physical Edition bonus (always triggers)
      const editionStr = (r.originalEdition || '').toLowerCase();
      if (editionStr.includes('foil')) chips += 50;
      if (editionStr.includes('holo')) mult += 10;
      if (editionStr.includes('poly')) mult = mult * 1.5;
    }


    // ─────────────────────────────────────────────────────────────
    // Phase 5: Observatory Phase (Held planet cards x1.5)
    // ─────────────────────────────────────────────────────────────
    const consumables = jokerContext?.consumables;
    if (consumables && consumables.length > 0) {
      for (const c of consumables) {
        const planetHand = PLANET_HAND_MAP[c.key || ''] || PLANET_HAND_MAP[c.label || ''];
        if (planetHand === handType) {
          // Observatory voucher grants x1.5 Mult per planet in consumables
          mult = mult * 1.5;
        }
      }
    }


    // ─────────────────────────────────────────────────────────────
    // Phase 6: Deck Phase (Plasma Deck balancing & Boss zero checks)
    // ─────────────────────────────────────────────────────────────
    chips = Math.round(chips);
    mult = Math.round(mult);

    const deck = jokerContext?.deck;
    let totalScore = 0;
    if (deck && deck.toUpperCase().includes('PLASMA')) {
      const total = chips + mult;
      chips = Math.floor(total / 2);
      mult = Math.ceil(total / 2);
      totalScore = chips * mult;
    } else {
      totalScore = chips * mult;
    }

    // Boss Zero-Score Invalidation
    if (!hasChicot) {
      if (bossName === 'The Psychic' && allPlayedCards.length < 5) {
        chips = 0;
        mult = 0;
        totalScore = 0;
      }
      if (bossName === 'The Eye' && jokerContext?.eyePlayedHandTypes && jokerContext.eyePlayedHandTypes.has(handType)) {
        chips = 0;
        mult = 0;
        totalScore = 0;
      }
      if (bossName === 'The Mouth' && jokerContext?.mouthLockedHandType && handType !== jokerContext.mouthLockedHandType) {
        chips = 0;
        mult = 0;
        totalScore = 0;
      }
    }


    const cardsStr = indices
      .map(i => `${cards[i].value?.rank || '?'}${cards[i].value?.suit || '?'}`)
      .join(' ');

    const desc = `${handType} [${cardsStr}] (${chips}×${mult} = ${totalScore}分)`;

    return {
      handType,
      scoringCardIndices: scoringIndices,
      chips,
      mult,
      totalScore,
      description: desc,
    };
  }

  /**
   * Generate all practical candidate moves (top scoring hands + smart discards)
   */
  static generateCandidates(
    cards: Card[],
    remainingHands: number,
    remainingDiscards: number,
    targetScore: number,
    currentScore: number,
    handLevels?: Record<string, PokerHandInfo>,
    primaryHandType?: string,
    bossConstraint?: {
      bossName?: string;
      mouthLockedHandType?: string | null;
      eyePlayedHandTypes?: Set<string>;
    },
    jokers?: Card[],
    money?: number,
    selfCorrection?: SelfCorrectionEngine,
    deck?: string,
    consumables?: Card[],
    handsPlayedThisRound?: number,
    deckContext?: {
      jokerLimit?: number;
      deckCardCount?: number;
      enhancedCardCount?: number;
      steelCardCount?: number;
      stoneCardCount?: number;
    }
  ): HandCandidate[] {

    const n = cards.length;
    const candidates: HandCandidate[] = [];
    const scoreNeeded = Math.max(0, targetScore - currentScore);

    // 1. Evaluate possible combinations:
    // Generate all subsets of sizes 1 to 5
    const playCombos: number[][] = [];
    function backtrack(start: number, current: number[]) {
      if (current.length >= 1 && current.length <= 5) {
        playCombos.push([...current]);
      }
      if (current.length === 5) return;
      for (let i = start; i < n; i++) {
        current.push(i);
        backtrack(i + 1, current);
        current.pop();
      }
    }
    backtrack(0, []);

    // Prioritize 5-card combinations first so larger hands are evaluated before 1-card plays
    playCombos.sort((a, b) => b.length - a.length);

    // Suit groupings
    const suitGroups: Record<string, number[]> = {};
    for (let i = 0; i < n; i++) {
      const s = cards[i].value?.suit || 'S';
      if (!suitGroups[s]) suitGroups[s] = [];
      suitGroups[s].push(i);
    }

    // Identify dominant suit to protect (Flush potential: suit with >= 3 cards, or matching primaryHandType)
    let dominantSuit: string | null = null;
    let maxSuitCount = 0;
    for (const [s, idxs] of Object.entries(suitGroups)) {
      if (idxs.length >= 3 && idxs.length > maxSuitCount) {
        dominantSuit = s;
        maxSuitCount = idxs.length;
      }
    }
    const protectedFlushIndices = new Set<number>(dominantSuit ? suitGroups[dominantSuit] : []);

    const jokerContext = {
      remainingDiscards,
      remainingHands,
      money: money || 0,
      handsPlayedThisRound: handsPlayedThisRound || 0,
      bossName: bossConstraint?.bossName,
      deck,
      consumables,
      mouthLockedHandType: bossConstraint?.mouthLockedHandType,
      eyePlayedHandTypes: bossConstraint?.eyePlayedHandTypes,
      jokerLimit: deckContext?.jokerLimit ?? 5,
      deckCardCount: deckContext?.deckCardCount ?? 52,
      enhancedCardCount: deckContext?.enhancedCardCount,
      steelCardCount: deckContext?.steelCardCount,
      stoneCardCount: deckContext?.stoneCardCount,
    };


    // Evaluate all collected play combinations
    let evaluatedPlays: (EvaluatedPokerHand & { indices: number[] })[] = [];
    const seenHandFingerprints = new Set<string>();

    for (const combo of playCombos) {
      const evalResult = this.evaluateCombination(cards, combo, handLevels, jokers, jokerContext);
      // Group by handType + scoring indices fingerprint to avoid redundant plays
      const scoringKey = `${evalResult.handType}:${evalResult.scoringCardIndices.sort().join(',')}`;
      if (seenHandFingerprints.has(scoringKey)) continue;
      seenHandFingerprints.add(scoringKey);

      evaluatedPlays.push({ ...evalResult, indices: combo });
    }

    // ── BOSS CONSTRAINTS ENFORCEMENT ──────────────────────────────
    // 1. The Psychic: "Must play 5 cards" (fewer than 5 cards score 0)
    if (bossConstraint?.bossName === 'The Psychic') {
      const minCards = Math.min(5, cards.length);
      evaluatedPlays = evaluatedPlays.filter(p => p.indices.length >= minCards);
    }

    // 2. The Eye: "No repeat hand types this round" (previously played types score 0)
    if (bossConstraint?.bossName === 'The Eye' && bossConstraint.eyePlayedHandTypes && bossConstraint.eyePlayedHandTypes.size > 0) {
      evaluatedPlays = evaluatedPlays.filter(p => !bossConstraint.eyePlayedHandTypes!.has(p.handType));
    }

    // 3. The Mouth: "Play only 1 hand type this round"
    if (bossConstraint?.bossName === 'The Mouth') {
      if (bossConstraint.mouthLockedHandType) {
        // Hand type has already been locked! ONLY plays matching this exact type are allowed!
        evaluatedPlays = evaluatedPlays.filter(p => p.handType === bossConstraint.mouthLockedHandType);
      } else if (primaryHandType !== 'High Card') {
        // First hand: never lock into High Card unless High Card is the primary deck engine!
        const nonHighCard = evaluatedPlays.filter(p => p.handType !== 'High Card');
        if (nonHighCard.length > 0) {
          evaluatedPlays = nonHighCard;
        }
      }
    }

    // Sort plays by estimated total score
    evaluatedPlays.sort((a, b) => b.totalScore - a.totalScore);

    // Take top 8 distinct plays
    const topPlays = evaluatedPlays.slice(0, 8);
    for (const p of topPlays) {
      const heldIndices = cards.map((_, i) => i).filter(i => !p.indices.includes(i));
      let steelCount = 0;
      let hasBlueSealInHand = false;

      for (const h of heldIndices) {
        const mod = getCardModifiers(cards[h]);
        if (mod.isSteel) steelCount++;
        if (mod.hasBlueSeal) hasBlueSealInHand = true;
      }

      // Theoretical score is already fully computed by 6-phase evaluateCombination (including held steel)
      const theoreticalScore = p.totalScore;
      const calibrationFactor = selfCorrection ? selfCorrection.getCalibrationFactor(p.handType) : 1.0;
      const adjustedScore = Math.round(theoreticalScore * calibrationFactor);
      const canOneShot = adjustedScore >= scoreNeeded;

      let reasonText = canOneShot
        ? `【一击必胜】打出 ${p.handType} 预估 ${adjustedScore} 分 (直接通关！保留 ${remainingHands} 次出牌换取 $${remainingHands} 奖金)`
        : `打出 ${p.handType} 预估 ${adjustedScore} 分 (${p.chips}×${p.mult})`;

      if (calibrationFactor !== 1.0) {
        reasonText += ` 🎯[自纠校准: ×${calibrationFactor.toFixed(2)}]`;
      }

      if (steelCount > 0) {
        reasonText += ` 🛡️[手持${steelCount}张钢铁卡生效]`;
      }
      if (hasBlueSealInHand && canOneShot) {
        reasonText += ` 🪐[手持蓝色蜡封: 终局结算自动获取专属星球牌！]`;
      }

      let playIndices = [...p.indices];
      let paddedCount = 0;

      // Intelligent Junk Padding (以打代弃):
      // If hand cannot one-shot the blind and we have extra hands remaining, pad with non-core junk cards (up to 5)
      // to discard junk and draw fresh cards without touching protected Flush or Steel cards!
      if (!canOneShot && remainingHands > 1 && playIndices.length < 5) {
        const availableJunk = cards
          .map((c, i) => ({ c, i, mod: getCardModifiers(c) }))
          .filter(x =>
            !playIndices.includes(x.i) &&
            !protectedFlushIndices.has(x.i) &&
            !x.mod.isSteel &&
            !x.mod.hasBlueSeal
          )
          .map(x => x.i);

        const padNeeded = Math.min(5 - playIndices.length, availableJunk.length);
        if (padNeeded > 0) {
          availableJunk.sort((a, b) => {
            const rawA = cards[a].value?.rank || '2';
            const rawB = cards[b].value?.rank || '2';
            return (RANK_ORDER[rawA === 'T' ? '10' : rawA] || 0) - (RANK_ORDER[rawB === 'T' ? '10' : rawB] || 0);
          });
          const padding = availableJunk.slice(0, padNeeded);
          playIndices = [...playIndices, ...padding];
          paddedCount = padNeeded;
        }
      }

      if (paddedCount > 0) {
        reasonText += ` 🧹[垫掉${paddedCount}张杂牌加速洗牌]`;
      }

      let priority = adjustedScore;
      if (canOneShot) {
        priority += 100000 + remainingHands * 500;
        if (hasBlueSealInHand) {
          priority += 2000;
        }
        const hasGoldInHand = heldIndices.some(h => getCardModifiers(cards[h]).isGold);
        if (hasGoldInHand) {
          priority += 1500;
        }
      } else {
        if (adjustedScore >= 150 || adjustedScore >= scoreNeeded * 0.4) {
          priority += 2500;
        }
        if (primaryHandType && p.handType === primaryHandType) {
          priority += Math.min(adjustedScore * 0.25, 100);
        }
      }
      if (hasBlueSealInHand && canOneShot) {
        priority += 2000;
      }

      candidates.push({
        type: 'play',
        cardIndices: playIndices,
        cardsSummary: playIndices.map(i => `${cards[i].value?.rank || '?'}${SUIT_NAMES[cards[i].value?.suit || 'S'] || ''}`).join(' '),
        handType: p.handType,
        estimatedChips: p.chips,
        estimatedMult: p.mult,
        estimatedScore: adjustedScore,
        reason: reasonText,
        priorityScore: priority,
      });
    }

    // Dedicated Play-to-Discard (以打代弃·强力换牌) when 0 discards and best play is not lethal
    if (remainingDiscards === 0 && remainingHands > 1) {
      const topPlayScore = topPlays[0]?.totalScore || 0;
      if (topPlayScore < scoreNeeded * 0.6) {
        const junkToDiscard = cards
          .map((c, i) => ({ c, i, mod: getCardModifiers(c) }))
          .filter(x =>
            !protectedFlushIndices.has(x.i) &&
            !x.mod.isSteel &&
            !x.mod.hasBlueSeal
          )
          .map(x => x.i);

        if (junkToDiscard.length >= 2) {
          const discardFive = junkToDiscard.slice(0, 5);
          const evalJunk = this.evaluateCombination(cards, discardFive, handLevels, jokers, jokerContext);
          candidates.push({
            type: 'play',
            cardIndices: discardFive,
            cardsSummary: discardFive.map(i => `${cards[i].value?.rank || '?'}${SUIT_NAMES[cards[i].value?.suit || 'S'] || ''}`).join(' '),
            handType: evalJunk.handType,
            estimatedChips: evalJunk.chips,
            estimatedMult: evalJunk.mult,
            estimatedScore: evalJunk.totalScore,
            reason: `🧹【以打代弃·强力换牌】打出 ${discardFive.length} 张杂牌过牌换牌 (完美保留 ${protectedFlushIndices.size} 张核心${dominantSuit ? SUIT_NAMES[dominantSuit] : ''}，摸满新牌冲刺同花/大牌！)`,
            priorityScore: 3500 + discardFive.length * 200,
          });
        }
      }
    }

    // 2. Evaluate Discards (if discards remaining)
    if (remainingDiscards > 0) {
      const rankCounts: Record<string, number> = {};
      const cardMods = cards.map(c => getCardModifiers(c));

      for (const c of cards) {
        const r = c.value?.rank || '2';
        rankCounts[r] = (rankCounts[r] || 0) + 1;
      }
      const pairedRanks = new Set(Object.keys(rankCounts).filter(r => rankCounts[r] >= 2));
      const flushSuits = new Set(
        Object.entries(suitGroups)
          .filter(([_, idxs]) => idxs.length >= 4)
          .map(([s]) => s)
      );

      // Strategy 0: Purple Seal Discard Priority (Discarding generates a FREE Tarot card!)
      const purpleSealIndices = cards
        .map((_, idx) => idx)
        .filter(idx => cardMods[idx].hasPurpleSeal);

      if (purpleSealIndices.length > 0) {
        const junkIndices = cards
          .map((_, idx) => idx)
          .filter(idx => !purpleSealIndices.includes(idx) && !cardMods[idx].isSteel && !cardMods[idx].hasBlueSeal && !cardMods[idx].isGlass)
          .slice(0, 5 - purpleSealIndices.length);

        const discardCombo = [...purpleSealIndices, ...junkIndices];
        candidates.push({
          type: 'discard',
          cardIndices: discardCombo,
          cardsSummary: discardCombo.map(i => `${cards[i].value?.rank || '?'}${SUIT_NAMES[cards[i].value?.suit || 'S'] || ''}`).join(' '),
          reason: `🔮【触发紫色蜡封】弃掉紫色蜡封牌，立即免费召唤 1 张全新塔罗牌！`,
          priorityScore: 5000,
        });
      }

      // Strategy A: Discard non-flush cards if 4 cards share a suit
      for (const [suit, indices] of Object.entries(suitGroups)) {
        if (indices.length === 4 || (indices.length === 3 && remainingDiscards >= 2 && pairedRanks.size === 0)) {
          const nonFlushIndices = cards
            .map((c, idx) => ({ c, idx }))
            .filter(x => x.c.value?.suit !== suit && !pairedRanks.has(x.c.value?.rank || '') && !cardMods[x.idx].isSteel && !cardMods[x.idx].hasBlueSeal)
            .map(x => x.idx)
            .slice(0, 5);

          if (nonFlushIndices.length > 0) {
            candidates.push({
              type: 'discard',
              cardIndices: nonFlushIndices,
              cardsSummary: nonFlushIndices.map(i => `${cards[i].value?.rank || '?'}${SUIT_NAMES[cards[i].value?.suit || 'S'] || ''}`).join(' '),
              reason: `【洗同花】当前已有 ${indices.length} 张 ${SUIT_NAMES[suit]}，弃掉 ${nonFlushIndices.length} 张杂色牌冲同花`,
              priorityScore: 2200 + indices.length * 300,
            });
          }
        }
      }

      // Strategy B: Discard lowest isolated junk cards
      const junkIndices = cards
        .map((c, idx) => {
          const rawRank = c.value?.rank || '2';
          const r = rawRank === 'T' ? '10' : rawRank;
          return {
            c,
            idx,
            order: RANK_ORDER[r] || 0,
            count: rankCounts[c.value?.rank || '2'] || 1,
            mod: cardMods[idx]
          };
        })
        .filter(x =>
          x.count === 1 &&
          x.order <= 9 &&
          !x.mod.isSteel &&
          !x.mod.hasBlueSeal &&
          !x.mod.isGold &&
          !flushSuits.has(x.c.value?.suit || '')
        )
        .sort((a, b) => a.order - b.order)
        .map(x => x.idx)
        .slice(0, 5);

      if (junkIndices.length > 0) {
        candidates.push({
          type: 'discard',
          cardIndices: junkIndices,
          cardsSummary: junkIndices.map(i => `${cards[i].value?.rank || '?'}${SUIT_NAMES[cards[i].value?.suit || 'S'] || ''}`).join(' '),
          reason: `【优化牌库】弃掉 ${junkIndices.length} 张低点数孤张杂牌，抽高点数与对子`,
          priorityScore: 800,
        });
      }
    }

    // Sort all candidates
    candidates.sort((a, b) => b.priorityScore - a.priorityScore);
    return candidates.slice(0, 10);
  }
}
