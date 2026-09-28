import { Card, HandCandidate, PokerHandInfo } from '../types.js';

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

const BASE_HAND_STATS: Record<string, { chips: number; mult: number }> = {
  'Straight Flush': { chips: 100, mult: 8 },
  'Four of a Kind': { chips: 60, mult: 7 },
  'Full House': { chips: 40, mult: 4 },
  'Flush': { chips: 35, mult: 4 },
  'Straight': { chips: 30, mult: 4 },
  'Three of a Kind': { chips: 30, mult: 3 },
  'Two Pair': { chips: 20, mult: 2 },
  'Pair': { chips: 10, mult: 2 },
  'High Card': { chips: 5, mult: 1 },
};

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
   * Evaluate a specific combination of cards (up to 5 cards)
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
    const suitCounts: Record<string, number> = {};
    const rankIndices: Record<string, number[]> = {};

    for (let i = 0; i < indices.length; i++) {
      const idx = indices[i];
      const card = cards[idx];
      const rank = card.value?.rank || '2';
      const suit = card.value?.suit || 'S';

      rankCounts[rank] = (rankCounts[rank] || 0) + 1;
      suitCounts[suit] = (suitCounts[suit] || 0) + 1;
      if (!rankIndices[rank]) rankIndices[rank] = [];
      rankIndices[rank].push(idx);
    }

    const isFlush = selected.length === 5 && Object.values(suitCounts).some(c => c === 5);

    // Check Straight (5 cards only)
    let isStraight = false;
    let straightRanks: number[] = [];
    if (selected.length === 5) {
      const orders = selected.map(c => RANK_ORDER[c.value?.rank || '2'] || 2).sort((a, b) => a - b);
      const uniqueOrders = Array.from(new Set(orders));
      if (uniqueOrders.length === 5) {
        if (uniqueOrders[4] - uniqueOrders[0] === 4) {
          isStraight = true;
          straightRanks = uniqueOrders;
        } else if (
          uniqueOrders[0] === 2 &&
          uniqueOrders[1] === 3 &&
          uniqueOrders[2] === 4 &&
          uniqueOrders[3] === 5 &&
          uniqueOrders[4] === 14 // Ace low A-2-3-4-5
        ) {
          isStraight = true;
          straightRanks = [1, 2, 3, 4, 5];
        }
      }
    }

    const counts = Object.entries(rankCounts).sort((a, b) => b[1] - a[1]);
    let handType = 'High Card';
    let scoringIndices: number[] = [];

    if (isFlush && isStraight) {
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
      // Pick highest rank card
      const highestCard = indices
        .map(i => ({ idx: i, val: RANK_ORDER[cards[i].value?.rank || '2'] || 0 }))
        .sort((a, b) => b.val - a.val)[0];
      scoringIndices = highestCard ? [highestCard.idx] : [];
    }

    // Base hand stats
    const base = handLevels?.[handType] || BASE_HAND_STATS[handType] || { chips: 10, mult: 1 };
    let handChips = base.chips;
    let handMult = base.mult;

    // Card chips from SCORING cards only (standard Balatro rule)
    let extraChips = 0;
    for (const idx of scoringIndices) {
      const c = cards[idx];
      const r = c.value?.rank || '2';
      extraChips += RANK_VALUES[r] || 2;
    }

    const totalChips = handChips + extraChips;
    const totalScore = totalChips * handMult;

    const cardsStr = indices
      .map(i => `${cards[i].value?.rank || '?'}${cards[i].value?.suit || '?'}`)
      .join(' ');

    return {
      handType,
      scoringCardIndices: scoringIndices,
      chips: totalChips,
      mult: handMult,
      totalScore,
      description: `${handType} [${cardsStr}] (${totalChips}×${handMult} = ${totalScore}分)`,
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
      // Calculate held Steel Cards bonus (x1.5 Mult each held in hand)
      const heldIndices = cards.map((_, i) => i).filter(i => !p.indices.includes(i));
      let steelCount = 0;
      for (const h of heldIndices) {
        const mod = JSON.stringify(cards[h].modifier || '').toUpperCase();
        if (mod.includes('STEEL')) steelCount++;
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

      let priority = adjustedScore + (canOneShot ? 100000 + remainingHands * 500 : 0);
      if (primaryHandType && p.handType === primaryHandType) {
        priority += 2500; // Bonus for specializing in the primary engine hand type
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
      for (const c of cards) {
        const r = c.value?.rank || '2';
        rankCounts[r] = (rankCounts[r] || 0) + 1;
      }
      const pairedRanks = new Set(Object.keys(rankCounts).filter(r => rankCounts[r] >= 2));

      // Strategy A: Discard non-flush cards if 4 cards share a suit
      // Or 3 cards if no strong hand and plenty of discards
      for (const [suit, indices] of Object.entries(suitGroups)) {
        if (indices.length === 4 || (indices.length === 3 && remainingDiscards >= 2 && pairedRanks.size === 0)) {
          const nonFlushIndices = cards
            .map((c, idx) => ({ c, idx }))
            .filter(x => x.c.value?.suit !== suit && !pairedRanks.has(x.c.value?.rank || ''))
            .map(x => x.idx)
            .slice(0, 5);

          if (nonFlushIndices.length > 0) {
            candidates.push({
              type: 'discard',
              cardIndices: nonFlushIndices,
              cardsSummary: nonFlushIndices.map(i => `${cards[i].value?.rank || '?'}${SUIT_NAMES[cards[i].value?.suit || 'S'] || ''}`).join(' '),
              reason: `【洗同花】当前已有 ${indices.length} 张 ${SUIT_NAMES[suit]}，弃掉 ${nonFlushIndices.length} 张杂色牌冲同花`,
              priorityScore: 3500 + indices.length * 500,
            });
          }
        }
      }

      // Strategy B: Discard lowest isolated cards (never discard pairs!)
      const junkIndices = cards
        .map((c, idx) => ({ c, idx, order: RANK_ORDER[c.value?.rank || '2'] || 0, count: rankCounts[c.value?.rank || '2'] || 1 }))
        .filter(x => x.count === 1 && x.order <= 9) // isolated low cards
        .sort((a, b) => a.order - b.order)
        .map(x => x.idx)
        .slice(0, 5);

      if (junkIndices.length > 0) {
        candidates.push({
          type: 'discard',
          cardIndices: junkIndices,
          cardsSummary: junkIndices.map(i => `${cards[i].value?.rank || '?'}${SUIT_NAMES[cards[i].value?.suit || 'S'] || ''}`).join(' '),
          reason: `【优化牌库】弃掉 ${junkIndices.length} 张低点数孤张杂牌，抽高点数与对子`,
          priorityScore: 2000,
        });
      }
    }

    // Sort all candidates
    candidates.sort((a, b) => b.priorityScore - a.priorityScore);
    return candidates.slice(0, 10);
  }
}
