export type Suit = 'clubs' | 'diamonds' | 'spades' | 'hearts';
export type Rank = '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A';

export type Card = {
  id: string;
  suit: Suit;
  rank: Rank;
};

export type PlayedCard = {
  playerId: string;
  card: Card;
};

export type PandoerenModeId = 'misere' | 'zwabber' | 'misere-ouvert' | 'zwabber-solo' | 'praatje' | 'prive';

export type Bid =
  | { kind: 'numeric'; amount: number }
  | { kind: 'mode'; mode: PandoerenModeId };

export const SUITS: Suit[] = ['clubs', 'diamonds', 'spades', 'hearts'];
export const RANKS: Rank[] = ['7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

const nonTrumpStrength: Record<Rank, number> = {
  '7': 0,
  '8': 1,
  '9': 2,
  '10': 3,
  J: 4,
  Q: 5,
  K: 6,
  A: 7,
};

const trumpStrength: Record<Rank, number> = {
  '7': 0,
  '8': 1,
  '10': 2,
  Q: 3,
  K: 4,
  A: 5,
  '9': 6,
  J: 7,
};

const basePoints: Record<Rank, number> = {
  '7': 0,
  '8': 0,
  '9': 0,
  J: 1,
  Q: 2,
  K: 3,
  '10': 10,
  A: 11,
};

export const PANDOEREN_MODES: Array<{ id: PandoerenModeId; label: string; centsEach: number; matchable: boolean }> = [
  { id: 'misere', label: 'misere', centsEach: 5, matchable: true },
  { id: 'zwabber', label: 'zwabber', centsEach: 10, matchable: false },
  { id: 'misere-ouvert', label: 'misere ouvert', centsEach: 15, matchable: true },
  { id: 'zwabber-solo', label: 'zwabber solo', centsEach: 20, matchable: false },
  { id: 'praatje', label: 'praatje', centsEach: 25, matchable: true },
  { id: 'prive', label: 'prive', centsEach: 30, matchable: false },
];

export function createDeck(): Card[] {
  return SUITS.flatMap((suit) => RANKS.map((rank) => ({ suit, rank, id: `${suit}-${rank}` })));
}

export function shuffleDeck(deck: Card[], random: () => number = Math.random): Card[] {
  const copy = [...deck];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

export function dealCards(deck: Card[], playerCount = 4): Card[][] {
  if (deck.length !== 32) throw new Error('Pandoeren uses exactly 32 cards');
  if (playerCount !== 4) throw new Error('Pandoeren currently supports exactly four players');

  const hands: Card[][] = Array.from({ length: playerCount }, () => []);
  deck.forEach((card, index) => hands[index % playerCount].push(card));
  return hands.map(rankHandForDisplay);
}

export function rankHandForDisplay(hand: Card[]): Card[] {
  return [...hand].sort((left, right) => {
    const suitDelta = SUITS.indexOf(left.suit) - SUITS.indexOf(right.suit);
    if (suitDelta !== 0) return suitDelta;
    return nonTrumpStrength[left.rank] - nonTrumpStrength[right.rank];
  });
}

export function cardPoints(card: Card, trumpSuit?: Suit): number {
  if (trumpSuit && card.suit === trumpSuit) {
    if (card.rank === 'J') return 20;
    if (card.rank === '9') return 16;
  }
  return basePoints[card.rank];
}

export function trickPoints(cards: Card[], trumpSuit?: Suit, isLastTrick = false): number {
  const points = cards.reduce((total, card) => total + cardPoints(card, trumpSuit), 0);
  return points + (isLastTrick ? 10 : 0);
}

function cardStrength(card: Card, ledSuit: Suit, trumpSuit?: Suit): number {
  if (trumpSuit && card.suit === trumpSuit) return 100 + trumpStrength[card.rank];
  if (card.suit === ledSuit) return 10 + nonTrumpStrength[card.rank];
  return nonTrumpStrength[card.rank];
}

export function determineTrickWinner(playedCards: PlayedCard[], trumpSuit?: Suit): string {
  if (playedCards.length === 0) throw new Error('Cannot determine winner of an empty trick');
  const ledSuit = playedCards[0].card.suit;
  return playedCards.reduce((winningPlay, currentPlay) =>
    cardStrength(currentPlay.card, ledSuit, trumpSuit) > cardStrength(winningPlay.card, ledSuit, trumpSuit)
      ? currentPlay
      : winningPlay,
  ).playerId;
}

export function isLegalPlay(card: Card, hand: Card[], currentTrick: PlayedCard[], trumpSuit?: Suit): boolean {
  if (currentTrick.length === 0) return true;
  const ledSuit = currentTrick[0].card.suit;
  const hasLedSuit = hand.some((candidate) => candidate.suit === ledSuit);
  if (hasLedSuit) return card.suit === ledSuit;

  if (!trumpSuit || card.suit !== trumpSuit) return true;

  const highestTrumpInTrick = currentTrick
    .map((play) => play.card)
    .filter((candidate) => candidate.suit === trumpSuit)
    .sort((left, right) => trumpStrength[right.rank] - trumpStrength[left.rank])[0];

  if (!highestTrumpInTrick || ledSuit === trumpSuit) return true;
  const canOvertrump = hand.some((candidate) => candidate.suit === trumpSuit && trumpStrength[candidate.rank] > trumpStrength[highestTrumpInTrick.rank]);
  if (canOvertrump) return trumpStrength[card.rank] > trumpStrength[highestTrumpInTrick.rank];

  const hasNonTrumpDiscard = hand.some((candidate) => candidate.suit !== trumpSuit);
  if (hasNonTrumpDiscard) return false;
  return true;
}

export function legalPlays(hand: Card[], currentTrick: PlayedCard[], trumpSuit?: Suit): Card[] {
  return hand.filter((card) => isLegalPlay(card, hand, currentTrick, trumpSuit));
}

function roundToPandoerenCents(rawCents: number): number {
  const magnitude = Math.abs(rawCents);
  if (magnitude < 3) return 0;
  return Math.sign(rawCents) * Math.round(magnitude / 5) * 5;
}

export function settleStandardDeal(input: { declarerTeam: string[]; defenders: string[]; score: number; target: number }): Record<string, number> {
  const cents = roundToPandoerenCents((input.score - input.target) / 10);
  const ledger = Object.fromEntries([...input.declarerTeam, ...input.defenders].map((playerId) => [playerId, 0]));

  for (const playerId of input.declarerTeam) ledger[playerId] += cents;
  for (const playerId of input.defenders) ledger[playerId] -= cents;
  return ledger;
}

export function settleMisere(input: { miserePlayers: string[]; failedPlayers: string[]; allPlayers: string[] }): Record<string, number> {
  const ledger = Object.fromEntries(input.allPlayers.map((playerId) => [playerId, 0]));
  for (const miserePlayer of input.miserePlayers) {
    const succeeded = !input.failedPlayers.includes(miserePlayer);
    for (const opponent of input.allPlayers.filter((playerId) => playerId !== miserePlayer)) {
      ledger[miserePlayer] += succeeded ? 5 : -5;
      ledger[opponent] += succeeded ? -5 : 5;
    }
  }
  return ledger;
}

export function calledCardOptions(callerHand: Card[], deck: Card[] = createDeck()): Card[] {
  const callerCardIds = new Set(callerHand.map((card) => card.id));
  return deck.filter((card) => !callerCardIds.has(card.id));
}

export function eligibleRaises(input: { current: Bid; pandoerenOpened: boolean }): Array<{ bid: Bid; label: string }> {
  if (input.current.kind === 'numeric') {
    const nextNumeric = input.current.amount + 10;
    return [
      { bid: { kind: 'numeric', amount: nextNumeric }, label: `${nextNumeric}` },
      ...PANDOEREN_MODES.map((mode) => ({ bid: { kind: 'mode' as const, mode: mode.id }, label: mode.label })),
    ];
  }

  const current = input.current as Extract<Bid, { kind: 'mode' }>;
  const currentIndex = PANDOEREN_MODES.findIndex((mode) => mode.id === current.mode);
  const currentMode = PANDOEREN_MODES[currentIndex];
  const options: Array<{ bid: Bid; label: string }> = [];
  if (currentMode.matchable) options.push({ bid: { kind: 'mode', mode: currentMode.id }, label: `match ${currentMode.label}` });
  for (const mode of PANDOEREN_MODES.slice(currentIndex + 1)) options.push({ bid: { kind: 'mode', mode: mode.id }, label: mode.label });
  return options;
}

export function bidLabel(bid: Bid): string {
  if (bid.kind === 'numeric') return `${bid.amount}`;
  return PANDOEREN_MODES.find((mode) => mode.id === bid.mode)?.label ?? bid.mode;
}
