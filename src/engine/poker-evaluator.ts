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
  static evaluateCombination(
    cards: Card[],
    indices: number[],
    handLevels?: Record<string, PokerHandInfo>
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

    const totalChips = handChips + extraChips;
    const totalMult = Math.round((handMult + extraMult) * xMultProduct);
    const totalScore = totalChips * totalMult;

    const cardsStr = indices
      .map(i => `${cards[i].value?.rank || '?'}${cards[i].value?.suit || '?'}`)
      .join(' ');

    return {
      handType,
      scoringCardIndices: scoringIndices,
      chips: totalChips,
      mult: totalMult,
      totalScore,
      description: `${handType} [${cardsStr}] (${totalChips}×${totalMult} = ${totalScore}分)`,
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
    primaryHandType?: string
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

    // Suit groupings
    const suitGroups: Record<string, number[]> = {};
    for (let i = 0; i < n; i++) {
      const s = cards[i].value?.suit || 'S';
      if (!suitGroups[s]) suitGroups[s] = [];
      suitGroups[s].push(i);
    }

    // Evaluate all collected play combinations
    const evaluatedPlays: (EvaluatedPokerHand & { indices: number[] })[] = [];
    const seenHandFingerprints = new Set<string>();

    for (const combo of playCombos) {
      const evalResult = this.evaluateCombination(cards, combo, handLevels);
      // Group by handType + scoring indices fingerprint to avoid redundant plays
      const scoringKey = `${evalResult.handType}:${evalResult.scoringCardIndices.sort().join(',')}`;
      if (seenHandFingerprints.has(scoringKey)) continue;
      seenHandFingerprints.add(scoringKey);

      evaluatedPlays.push({ ...evalResult, indices: combo });
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
        cardIndices: p.indices,
        cardsSummary: p.indices.map(i => `${cards[i].value?.rank || '?'}${SUIT_NAMES[cards[i].value?.suit || 'S'] || ''}`).join(' '),
        handType: p.handType,
        estimatedChips: p.chips,
        estimatedMult: Math.round(p.mult * steelMultiplier),
        estimatedScore: adjustedScore,
        reason: reasonText,
        priorityScore: priority,
      });
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
