export type GameStateName =
  | 'MENU'
  | 'BLIND_SELECT'
  | 'SELECTING_HAND'
  | 'HAND_PLAYED'
  | 'DRAW_TO_HAND'
  | 'ROUND_EVAL'
  | 'SHOP'
  | 'TAROT_PACK'
  | 'PLANET_PACK'
  | 'SPECTRAL_PACK'
  | 'BUFFOON_PACK'
  | 'STANDARD_PACK'
  | 'GAME_OVER'
  | 'UNKNOWN';

export interface CardValue {
  rank: string;
  suit: string;
  effect?: string;
}

export interface Card {
  id: number | string;
  key?: string;
  label?: string;
  set?: string;
  value?: CardValue;
  modifier?: string[];
  cost?: {
    buy?: number;
    sell?: number;
  };
  ability?: any;
}

export interface BlindInfo {
  name: string;
  type: 'SMALL' | 'BIG' | 'BOSS';
  score: number;
  status: string;
  effect: string;
  tag_name: string;
  tag_effect: string;
}

export interface PokerHandInfo {
  order: number;
  chips: number;
  mult: number;
  level: number;
  played: number;
}

export interface GameState {
  state: GameStateName;
  ante_num: number;
  round_num: number;
  money: number;
  won: boolean;
  deck: string;
  stake: string;
  round: {
    hands_left: number;
    discards_left: number;
    chips: number;
    hands_played: number;
    discards_used: number;
    reroll_cost: number;
  };
  blinds?: {
    small?: BlindInfo;
    big?: BlindInfo;
    boss?: BlindInfo;
  };
  hands?: Record<string, PokerHandInfo>;
  hand?: {
    count: number;
    limit: number;
    highlighted_limit: number;
    cards: Card[];
  };
  jokers?: {
    count: number;
    limit: number;
    cards: Card[];
  };
  consumables?: {
    count: number;
    limit: number;
    cards: Card[];
  };
  consumeables?: {
    count: number;
    limit: number;
    cards: Card[];
  };
  shop?: {
    cards?: Card[];
    vouchers?: Card[];
    packs?: Card[];
  };
}

export interface HandCandidate {
  type: 'play' | 'discard';
  cardIndices: number[];
  cardsSummary: string;
  handType?: string;
  estimatedChips?: number;
  estimatedMult?: number;
  estimatedScore?: number;
  reason: string;
  priorityScore: number;
}

export interface StrategicDirective {
  targetHandTypes: string[];
  primaryHandType?: string;
  recommendedPlayStyle: string;
  economyGoal: string;
  engineStatus?: {
    hasChips: boolean;
    hasFlatMult: boolean;
    hasXMult: boolean;
    missingPiece: string;
  };
  jokerNeeds: string[];
  bossAlert?: string;
  blindActionAdvice?: 'select' | 'skip';
  advice: string;
}

export interface ActionDecision {
  action: 'play' | 'discard' | 'select' | 'skip' | 'cash_out' | 'buy' | 'reroll' | 'next_round' | 'start' | 'wait' | 'replace_joker';
  params?: any;
  reason: string;
  confidence: number;
  source: 'deepseek_jev_synergy' | 'tactical_fast_path' | 'heuristic_engine';
}
