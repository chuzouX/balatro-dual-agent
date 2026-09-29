import { Card, HandCandidate, PokerHandInfo } from '../types.js';
import { BASE_HAND_STATS } from './rules.js';

export const RANK_VALUES: Record<string, number> = {
  '2': 2,
  '3': 3,
  '4': 4,
  '5': 5,
  '6': 6,
  '7': 7,
  '8': 8,
  '9': 9,
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
   * Evaluate a specific combination of cards (up to 5 cards) based on Balatro 1.0.1o rules
   */
  /**
   * Calculate Joker bonuses (Chips, Flat Mult, XMult) for the given hand
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
    }
  ): { flatChips: number; flatMult: number; xMult: number } {
    let flatChips = 0;
    let flatMult = 0;
    let xMult = 1.0;

    if (!jokers || jokers.length === 0) {
      return { flatChips, flatMult, xMult };
    }

    // Resolve Blueprint & Brainstorm: copy target joker abilities
    const effectiveJokers: Card[] = [...jokers];
    for (let i = 0; i < effectiveJokers.length; i++) {
      const j = effectiveJokers[i];
      const key = (j.key || '').toLowerCase();
      const label = (j.label || '').toLowerCase();

      if (key.includes('blueprint') || label.includes('blueprint')) {
        if (i + 1 < jokers.length) {
          effectiveJokers[i] = { ...jokers[i + 1], id: j.id };
        }
      } else if (key.includes('brainstorm') || label.includes('brainstorm')) {
        if (jokers.length > 0 && jokers[0] !== j) {
          effectiveJokers[i] = { ...jokers[0], id: j.id };
        }
      }
    }

    // 1. Scoring Cards Trigger Jokers
    for (const card of context.scoringCards) {
      const rank = card.value?.rank || '2';
      const suit = card.value?.suit || 'S';
      const isFace = rank === 'J' || rank === 'Q' || rank === 'K';
      const isAce = rank === 'A';
      const isOdd = ['A', '9', '7', '5', '3'].includes(rank);
      const isEven = ['2', '4', '6', '8', '10'].includes(rank);
      const isFibonacci = ['A', '2', '3', '5', '8'].includes(rank);

      for (const j of effectiveJokers) {
        const key = (j.key || '').toLowerCase();
        const label = (j.label || '').toLowerCase();

        if (isFace) {
          if (key.includes('scary_face') || label.includes('scary face')) flatChips += 30;
          if (key.includes('smiley_face') || label.includes('smiley face')) flatMult += 5;
          if (key.includes('photograph') || label.includes('photograph')) xMult *= 2.0;
        }

        if (isAce && (key.includes('scholar') || label.includes('scholar'))) {
          flatChips += 20;
          flatMult += 4;
        }

        if ((rank === '10' || rank === '4') && (key.includes('walkie_talkie') || label.includes('walkie talkie'))) {
          flatChips += 10;
          flatMult += 4;
        }

        if (isFibonacci && (key.includes('fibonacci') || label.includes('fibonacci'))) {
          flatMult += 8;
        }

        if (isEven && (key.includes('even_steven') || label.includes('even steven'))) {
          flatMult += 4;
        }

        if (isOdd && (key.includes('odd_todd') || label.includes('odd todd'))) {
          flatChips += 31;
        }

        // Suit triggers
        if (suit === 'H') {
          if (key.includes('lusty') || label.includes('lusty')) flatMult += 3;
          if (key.includes('bloodstone') || label.includes('bloodstone')) xMult *= 1.5;
        } else if (suit === 'S') {
          if (key.includes('wrathful') || label.includes('wrathful')) flatMult += 3;
          if (key.includes('arrowhead') || label.includes('arrowhead')) flatChips += 50;
        } else if (suit === 'C') {
          if (key.includes('gluttonous') || label.includes('gluttonous')) flatMult += 3;
          if (key.includes('onyx') || label.includes('onyx')) flatMult += 7;
        } else if (suit === 'D') {
          if (key.includes('dapper') || label.includes('dapper')) flatMult += 3;
        }
      }
    }

    // Hanging Chad: retriggers first scoring card 2 times
    const hasHangingChad = effectiveJokers.some(j => (j.key || '').includes('hanging_chad') || (j.label || '').includes('hanging chad'));
    if (hasHangingChad && context.scoringCards.length > 0) {
      const firstCard = context.scoringCards[0];
      const rank = firstCard.value?.rank || '2';
      const rankVal = RANK_VALUES[rank] || 2;
      flatChips += rankVal * 2;
    }

    // 2. In-Hand Held Cards Jokers
    for (const card of context.heldCards) {
      const rank = card.value?.rank || '2';
      for (const j of effectiveJokers) {
        const key = (j.key || '').toLowerCase();
        const label = (j.label || '').toLowerCase();
        if (rank === 'K' && (key.includes('baron') || label.includes('baron'))) {
          xMult *= 1.5;
        }
        if (rank === 'Q' && (key.includes('shoot_the_moon') || label.includes('shoot the moon'))) {
          flatMult += 13;
        }
      }
    }

    // 3. Global Independent Jokers
    for (const j of effectiveJokers) {
      const key = (j.key || '').toLowerCase();
      const label = (j.label || '').toLowerCase();
      const ability = j.ability || {};

      // Edition bonuses on Joker itself
      const edition = (j.modifier as any)?.edition?.toLowerCase() ||
        (Array.isArray(j.modifier) ? j.modifier.join(' ').toLowerCase() : '');
      if (edition.includes('foil')) flatChips += 50;
      if (edition.includes('holo')) flatMult += 10;
      if (edition.includes('poly')) xMult *= 1.5;

      // Chip Jokers
      if (key.includes('ice_cream') || label.includes('ice cream')) {
        flatChips += ability.chips || ability.extra || 100;
      } else if (key.includes('blue_joker') || label.includes('blue joker')) {
        flatChips += 50;
      } else if (key.includes('banner') || label.includes('banner')) {
        flatChips += 30 * context.remainingDiscards;
      } else if (key.includes('bull') || label.includes('bull')) {
        flatChips += 2 * context.money;
      } else if (key.includes('castle') || label.includes('castle')) {
        flatChips += ability.chips || ability.extra || 30;
      } else if (key.includes('sly') && context.handType.includes('Pair')) {
        flatChips += 50;
      } else if (key.includes('wily') && context.handType.includes('Three of a Kind')) {
        flatChips += 100;
      } else if (key.includes('clever') && context.handType === 'Two Pair') {
        flatChips += 80;
      } else if (key.includes('devious') && context.handType === 'Straight') {
        flatChips += 100;
      } else if (key.includes('crafty') && context.handType === 'Flush') {
        flatChips += 80;
      }

      // Flat Mult Jokers
      if (key.includes('gros_michel') || label.includes('gros michel')) {
        flatMult += 15;
      } else if (key.includes('popcorn') || label.includes('popcorn')) {
        flatMult += ability.mult || ability.extra || 20;
      } else if (key.includes('half') || label.includes('half')) {
        if (context.allPlayedCards.length <= 3) flatMult += 20;
      } else if (key.includes('mystic_summit') || label.includes('mystic summit')) {
        if (context.remainingDiscards === 0) flatMult += 15;
      } else if (key.includes('misprint') || label.includes('misprint')) {
        flatMult += 11;
      } else if (key.includes('swashbuckler') || label.includes('swashbuckler')) {
        flatMult += 10;
      } else if (key.includes('supernova') || label.includes('supernova')) {
        flatMult += ability.mult || 6;
      } else if (key.includes('fortune_teller') || label.includes('fortune teller')) {
        flatMult += ability.mult || 8;
      } else if (key.includes('green_joker') || label.includes('green joker')) {
        flatMult += ability.mult || 10;
      } else if (key.includes('jolly') && context.handType.includes('Pair')) {
        flatMult += 8;
      } else if (key.includes('zany') && context.handType.includes('Three of a Kind')) {
        flatMult += 12;
      } else if (key.includes('mad') && context.handType === 'Two Pair') {
        flatMult += 10;
      } else if (key.includes('crazy') && context.handType === 'Straight') {
        flatMult += 12;
      } else if (key.includes('droll') && context.handType === 'Flush') {
        flatMult += 10;
      } else if (ability.mult) {
        flatMult += ability.mult;
      }

      // XMult Jokers
      if (key.includes('cavendish') || label.includes('cavendish')) {
        xMult *= 3.0;
      } else if (key.includes('the_duo') && context.handType.includes('Pair')) {
        xMult *= 2.0;
      } else if (key.includes('the_trio') && context.handType.includes('Three of a Kind')) {
        xMult *= 3.0;
      } else if (key.includes('the_family') && context.handType.includes('Four of a Kind')) {
        xMult *= 4.0;
      } else if (key.includes('the_order') && context.handType === 'Straight') {
        xMult *= 3.0;
      } else if (key.includes('the_tribe') && context.handType === 'Flush') {
        xMult *= 2.0;
      } else if (key.includes('card_sharp') || label.includes('card sharp')) {
        xMult *= 3.0;
      } else if (key.includes('blackboard') || label.includes('blackboard')) {
        const allSpadesOrClubs = context.heldCards.every(c => c.value?.suit === 'S' || c.value?.suit === 'C');
        if (allSpadesOrClubs) xMult *= 3.0;
      } else if (key.includes('acrobat') && context.remainingHands === 1) {
        xMult *= 3.0;
      } else if (ability.x_mult) {
        xMult *= ability.x_mult;
      } else if (key.includes('constellation') || key.includes('vampire') || key.includes('hologram') || key.includes('obelisk') || key.includes('campfire') || key.includes('lucky_cat') || key.includes('steel_joker')) {
        xMult *= ability.extra_x_mult || ability.extra || 1.5;
      }
    }

    return { flatChips, flatMult, xMult };
  }

  /**
   * Evaluate a specific combination of cards (up to 5 cards) based on Balatro 1.0.1o rules
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
    }
  ): EvaluatedPokerHand {
    const selected = indices.map(idx => cards[idx]);
    if (selected.length === 0 || selected.length > 5) {
      return { handType: 'High Card', scoringCardIndices: [], chips: 0, mult: 0, totalScore: 0, description: 'None' };
    }

    const rankCounts: Record<string, number> = {};
    const rankIndices: Record<string, number[]> = {};
    const suitCounts: Record<string, number> = { S: 0, H: 0, C: 0, D: 0 };
    let wildCount = 0;

    for (let i = 0; i < indices.length; i++) {
      const idx = indices[i];
      const card = cards[idx];
      const mod = getCardModifiers(card);
      const rank = mod.isStone ? 'STONE' : (card.value?.rank || '2');
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

    // Flush check (any suit count + wildCount >= 5)
    let isFlush = false;
    if (selected.length === 5) {
      for (const s of ['S', 'H', 'C', 'D']) {
        if ((suitCounts[s] + wildCount) >= 5) {
          isFlush = true;
          break;
        }
      }
    }

    // Straight check (5 cards only, ignoring stone cards)
    let isStraight = false;
    const nonStoneCards = selected.filter(c => !getCardModifiers(c).isStone);
    if (nonStoneCards.length === 5) {
      const orders = nonStoneCards.map(c => RANK_ORDER[c.value?.rank || '2'] || 2).sort((a, b) => a - b);
      const uniqueOrders = Array.from(new Set(orders));
      if (uniqueOrders.length === 5) {
        if (uniqueOrders[4] - uniqueOrders[0] === 4) {
          isStraight = true;
        } else if (
          uniqueOrders[0] === 2 &&
          uniqueOrders[1] === 3 &&
          uniqueOrders[2] === 4 &&
          uniqueOrders[3] === 5 &&
          uniqueOrders[4] === 14 // Ace low A-2-3-4-5
        ) {
          isStraight = true;
        }
      }
    }

    const counts = Object.entries(rankCounts)
      .filter(([r]) => r !== 'STONE')
      .sort((a, b) => b[1] - a[1]);

    let handType = 'High Card';
    let scoringIndices: number[] = [];

    // Balatro 1.0.1o Hand Hierarchy (Special Hands included)
    if (selected.length === 5 && counts[0] && counts[0][1] === 5 && isFlush) {
      handType = 'Flush Five';
      scoringIndices = [...indices];
    } else if (selected.length === 5 && counts[0] && counts[0][1] === 3 && counts[1] && counts[1][1] === 2 && isFlush) {
      handType = 'Flush House';
      scoringIndices = [...indices];
    } else if (counts[0] && counts[0][1] >= 5) {
      handType = 'Five of a Kind';
      scoringIndices = rankIndices[counts[0][0]].slice(0, 5);
    } else if (isFlush && isStraight) {
      handType = 'Straight Flush';
      scoringIndices = [...indices];
    } else if (counts[0] && counts[0][1] >= 4) {
      handType = 'Four of a Kind';
      scoringIndices = rankIndices[counts[0][0]];
    } else if (counts[0] && counts[0][1] === 3 && counts[1] && counts[1][1] >= 2) {
      handType = 'Full House';
      scoringIndices = [...rankIndices[counts[0][0]], ...rankIndices[counts[1][0]].slice(0, 2)];
    } else if (isFlush) {
      handType = 'Flush';
      scoringIndices = [...indices];
    } else if (isStraight) {
      handType = 'Straight';
      scoringIndices = [...indices];
    } else if (counts[0] && counts[0][1] === 3) {
      handType = 'Three of a Kind';
      scoringIndices = rankIndices[counts[0][0]];
    } else if (counts[0] && counts[0][1] === 2 && counts[1] && counts[1][1] === 2) {
      handType = 'Two Pair';
      scoringIndices = [...rankIndices[counts[0][0]], ...rankIndices[counts[1][0]]];
    } else if (counts[0] && counts[0][1] === 2) {
      handType = 'Pair';
      scoringIndices = rankIndices[counts[0][0]];
    } else {
      handType = 'High Card';
      // Pick highest rank non-stone card or first card
      const highestCard = indices
        .map(i => ({ idx: i, val: RANK_ORDER[cards[i].value?.rank || '2'] || 0 }))
        .sort((a, b) => b.val - a.val)[0];
      scoringIndices = highestCard ? [highestCard.idx] : [];
    }

    // Base hand stats from game state or default rulebook
    const base = handLevels?.[handType] || (BASE_HAND_STATS as any)[handType] || { chips: 10, mult: 1 };
    let handChips = base.chips;
    let handMult = base.mult;

    // Evaluate scoring cards with Enhancements, Seals, and Editions
    let extraChips = 0;
    let extraMult = 0;
    let xMultProduct = 1.0;

    for (const idx of scoringIndices) {
      const c = cards[idx];
      const mod = getCardModifiers(c);
      const r = c.value?.rank || '2';

      // Triggers count: 1 base trigger + 1 extra trigger if Red Seal
      const triggers = mod.hasRedSeal ? 2 : 1;

      for (let t = 0; t < triggers; t++) {
        // Base rank or Stone card chips
        if (mod.isStone) {
          extraChips += 50;
        } else {
          extraChips += RANK_VALUES[r] || 2;
        }

        // Card Enhancements
        if (mod.isBonus) extraChips += 30;
        if (mod.isMult) extraMult += 4;
        if (mod.isLucky) extraMult += 4; // Expected average contribution (20 * 0.2)
        if (mod.isGlass) xMultProduct *= 2.0;

        // Card Editions
        if (mod.isFoil) extraChips += 50;
        if (mod.isHolo) extraMult += 10;
        if (mod.isPoly) xMultProduct *= 1.5;
      }
    }

    // Evaluate Joker contribution
    const scoringCards = scoringIndices.map(i => cards[i]);
    const allPlayedCards = indices.map(i => cards[i]);
    const heldCards = cards.filter((_, i) => !indices.includes(i));

    const jokerBonus = this.evaluateJokers(jokers || [], {
      handType,
      scoringCards,
      allPlayedCards,
      heldCards,
      remainingDiscards: jokerContext?.remainingDiscards ?? 0,
      remainingHands: jokerContext?.remainingHands ?? 1,
      money: jokerContext?.money ?? 0,
    });

    const totalChips = handChips + extraChips + jokerBonus.flatChips;
    const totalMult = Math.round(((handMult + extraMult + jokerBonus.flatMult) * xMultProduct) * jokerBonus.xMult);
    const totalScore = totalChips * totalMult;

    const cardsStr = indices
      .map(i => `${cards[i].value?.rank || '?'}${cards[i].value?.suit || '?'}`)
      .join(' ');

    let desc = `${handType} [${cardsStr}] (${totalChips}×${totalMult} = ${totalScore}分)`;
    if (jokerBonus.flatMult > 0 || jokerBonus.xMult > 1 || jokerBonus.flatChips > 0) {
      desc += ` 🤡[+${jokerBonus.flatChips}筹码 +${jokerBonus.flatMult}Mult x${jokerBonus.xMult.toFixed(1)}]`;
    }

    return {
      handType,
      scoringCardIndices: scoringIndices,
      chips: totalChips,
      mult: totalMult,
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
    money?: number
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
    };

    // Evaluate all collected play combinations with Joker bonuses
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
      // Calculate held cards bonus (Steel Cards in-hand x1.5 Mult each)
      const heldIndices = cards.map((_, i) => i).filter(i => !p.indices.includes(i));
      let steelCount = 0;
      let hasBlueSealInHand = false;

      for (const h of heldIndices) {
        const mod = getCardModifiers(cards[h]);
        if (mod.isSteel) steelCount++;
        if (mod.hasBlueSeal) hasBlueSealInHand = true;
      }

      const steelMultiplier = Math.pow(1.5, steelCount);
      const adjustedScore = Math.round(p.totalScore * steelMultiplier);
      const canOneShot = adjustedScore >= scoreNeeded;

      let reasonText = canOneShot
        ? `【一击必胜】打出 ${p.handType} 预估 ${adjustedScore} 分 (直接通关！保留 ${remainingHands} 次出牌换取 $${remainingHands} 奖金)`
        : `打出 ${p.handType} 预估 ${adjustedScore} 分 (${p.chips}×${p.mult})`;

      if (steelCount > 0) {
        reasonText += ` 🛡️[手持${steelCount}张钢铁卡x${steelMultiplier.toFixed(1)}]`;
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
          availableJunk.sort((a, b) => (RANK_ORDER[cards[a].value?.rank || '2'] || 0) - (RANK_ORDER[cards[b].value?.rank || '2'] || 0));
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
      } else {
        // High impact play bonus: hands scoring substantial chunks of the blind (>= 150 or >= 40% of scoreNeeded)
        if (adjustedScore >= 150 || adjustedScore >= scoreNeeded * 0.4) {
          priority += 2500;
        }
        // Small primaryHandType bonus (tie-breaker only, max +100 so it NEVER overrides a hand that scores 2x higher)
        if (primaryHandType && p.handType === primaryHandType) {
          priority += Math.min(adjustedScore * 0.25, 100);
        }
      }
      if (hasBlueSealInHand && canOneShot) {
        priority += 2000; // Bonus for saving Blue Seal card
      }

      candidates.push({
        type: 'play',
        cardIndices: playIndices,
        cardsSummary: playIndices.map(i => `${cards[i].value?.rank || '?'}${SUIT_NAMES[cards[i].value?.suit || 'S'] || ''}`).join(' '),
        handType: p.handType,
        estimatedChips: p.chips,
        estimatedMult: Math.round(p.mult * steelMultiplier),
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
      // Identify suits that have flush potential (>= 4 cards) so we NEVER discard cards of those suits
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
        // Find other safe junk cards to discard together (up to 5 total)
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

      // Strategy A: Discard non-flush cards if 4 cards share a suit (only when 4 cards, NOT if already 5!)
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

      // Strategy B: Discard lowest isolated junk cards (protecting flush cards, pairs, steel cards, and blue seals!)
      const junkIndices = cards
        .map((c, idx) => ({ c, idx, order: RANK_ORDER[c.value?.rank || '2'] || 0, count: rankCounts[c.value?.rank || '2'] || 1, mod: cardMods[idx] }))
        .filter(x =>
          x.count === 1 &&
          x.order <= 9 &&
          !x.mod.isSteel &&
          !x.mod.hasBlueSeal &&
          !x.mod.isGold &&
          !flushSuits.has(x.c.value?.suit || '') // Protect potential/complete Flush cards!
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
