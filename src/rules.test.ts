import { describe, expect, it } from 'vitest';
import {
  type Card,
  type PlayedCard,
  PANDOEREN_MODES,
  calledCardOptions,
  contractScoresTrickPoints,
  contractUsesCalledCard,
  contractUsesTrump,
  createDeck,
  dealCards,
  determineTrickWinner,
  eligibleRaises,
  forcedCalledCardPlay,
  isCalledCardDefeat,
  isLegalPlay,
  nextEligibleBidderIndex,
  rankHandForDisplay,
  roemPoints,
  roemTargetAdjustment,
  settleMisere,
  settleModeContract,
  settleStandardDeal,
  trickPoints,
} from './rules';

describe('Pandoeren rules foundation', () => {
  it('creates and deals a 32-card 7-through-ace deck to four players', () => {
    const hands = dealCards(createDeck(), 4);

    expect(hands).toHaveLength(4);
    expect(hands.every((hand) => hand.length === 8)).toBe(true);
    expect(new Set(hands.flat().map((card) => card.id)).size).toBe(32);
  });

  it('sorts hand display by clubs, diamonds, spades, hearts and ascending non-trump rank', () => {
    const sorted = rankHandForDisplay([
      { suit: 'hearts', rank: 'A', id: 'hearts-A' },
      { suit: 'clubs', rank: '7', id: 'clubs-7' },
      { suit: 'clubs', rank: 'A', id: 'clubs-A' },
      { suit: 'diamonds', rank: '10', id: 'diamonds-10' },
      { suit: 'spades', rank: 'K', id: 'spades-K' },
    ]).map((card) => card.id);

    expect(sorted).toEqual(['clubs-7', 'clubs-A', 'diamonds-10', 'spades-K', 'hearts-A']);
  });

  it('keeps card points separate from roem target adjustment', () => {
    expect(trickPoints([
      { suit: 'hearts', rank: 'J', id: 'hearts-J' },
      { suit: 'hearts', rank: '9', id: 'hearts-9' },
      { suit: 'clubs', rank: 'A', id: 'clubs-A' },
      { suit: 'spades', rank: '10', id: 'spades-10' },
    ], 'hearts', true)).toBe(67);

    expect(roemPoints([
      { suit: 'clubs', rank: 'K', id: 'clubs-K' },
      { suit: 'clubs', rank: 'Q', id: 'clubs-Q' },
      { suit: 'diamonds', rank: '7', id: 'diamonds-7' },
      { suit: 'spades', rank: '8', id: 'spades-8' },
    ], 'hearts')).toBe(20);
    expect(trickPoints([
      { suit: 'hearts', rank: 'K', id: 'hearts-K' },
      { suit: 'hearts', rank: 'Q', id: 'hearts-Q' },
      { suit: 'diamonds', rank: '7', id: 'diamonds-7' },
      { suit: 'spades', rank: '8', id: 'spades-8' },
    ], 'hearts')).toBe(5);
    expect(roemTargetAdjustment({ declarerTeam: ['p1', 'p3'], winnerId: 'p1', roem: 20 })).toBe(-20);
    expect(roemTargetAdjustment({ declarerTeam: ['p1', 'p3'], winnerId: 'p2', roem: 20 })).toBe(20);
  });

  it('requires following suit and overtrumping when trumping a non-trump-led trick', () => {
    const hand: Card[] = [
      { suit: 'hearts', rank: '8', id: 'hearts-8' },
      { suit: 'clubs', rank: '7', id: 'clubs-7' },
    ];
    const currentTrick: PlayedCard[] = [
      { playerId: 'p1', card: { suit: 'diamonds', rank: 'A', id: 'diamonds-A' } },
      { playerId: 'p2', card: { suit: 'hearts', rank: '9', id: 'hearts-9' } },
    ];

    expect(isLegalPlay(hand[0], hand, currentTrick, 'hearts')).toBe(false);
    expect(isLegalPlay(hand[1], hand, currentTrick, 'hearts')).toBe(true);
  });

  it('forces the called card when declarer leads before any trump was played', () => {
    const hand: Card[] = [
      { suit: 'clubs', rank: 'A', id: 'clubs-A' },
      { suit: 'spades', rank: '7', id: 'spades-7' },
    ];

    expect(forcedCalledCardPlay({
      hand,
      legalCards: hand,
      currentTrick: [{ playerId: 'p1', card: { suit: 'diamonds', rank: '7', id: 'diamonds-7' } }],
      calledCardId: 'clubs-A',
      declarerId: 'p1',
      trumpSuit: 'hearts',
      completedTricks: [],
    })?.id).toBe('clubs-A');

    expect(forcedCalledCardPlay({
      hand,
      legalCards: hand,
      currentTrick: [{ playerId: 'p2', card: { suit: 'diamonds', rank: '7', id: 'diamonds-7' } }],
      calledCardId: 'clubs-A',
      declarerId: 'p1',
      trumpSuit: 'hearts',
      completedTricks: [],
    })).toBeUndefined();
  });

  it('determines trick winner with trump over non-trump and trump rank order', () => {
    const winner = determineTrickWinner([
      { playerId: 'p1', card: { suit: 'clubs', rank: 'A', id: 'clubs-A' } },
      { playerId: 'p2', card: { suit: 'clubs', rank: 'K', id: 'clubs-K' } },
      { playerId: 'p3', card: { suit: 'hearts', rank: '9', id: 'hearts-9' } },
      { playerId: 'p4', card: { suit: 'hearts', rank: 'J', id: 'hearts-J' } },
    ], 'hearts');

    expect(winner).toBe('p4');
  });

  it('settles standard deal by loser payment and balances uneven teams', () => {
    expect(settleStandardDeal({ declarerTeam: ['p1', 'p3'], defenders: ['p2', 'p4'], score: 159, target: 110 })).toEqual({
      p1: 5,
      p3: 5,
      p2: -5,
      p4: -5,
    });
    expect(settleStandardDeal({ declarerTeam: ['p1'], defenders: ['p2', 'p3', 'p4'], score: 159, target: 110 })).toEqual({
      p1: 15,
      p2: -5,
      p3: -5,
      p4: -5,
    });
  });

  it('settles failed standard deal as net ledger adjustment', () => {
    expect(settleStandardDeal({ declarerTeam: ['p1', 'p3'], defenders: ['p2', 'p4'], score: 80, target: 120 })).toEqual({
      p1: -5,
      p3: -5,
      p2: 5,
      p4: 5,
    });
  });

  it('settles misere as 5 cents against every other player', () => {
    expect(settleMisere({ miserePlayers: ['p1'], failedPlayers: ['p1'], allPlayers: ['p1', 'p2', 'p3', 'p4'] })).toEqual({
      p1: -15,
      p2: 5,
      p3: 5,
      p4: 5,
    });
    expect(settleMisere({ miserePlayers: ['p1'], failedPlayers: [], allPlayers: ['p1', 'p2', 'p3', 'p4'] })).toEqual({
      p1: 15,
      p2: -5,
      p3: -5,
      p4: -5,
    });
  });

  it('settles prive and zwabber as one payment to or from the opposing side, not once per opponent', () => {
    expect(settleModeContract({ bid: { kind: 'mode', mode: 'prive' }, declarerTeam: ['p1'], defenders: ['p2', 'p3', 'p4'], allPlayers: ['p1', 'p2', 'p3', 'p4'], succeeded: false })).toEqual({
      p1: -30,
      p2: 10,
      p3: 10,
      p4: 10,
    });
    expect(settleModeContract({ bid: { kind: 'mode', mode: 'zwabber' }, declarerTeam: ['p1', 'p3'], defenders: ['p2', 'p4'], allPlayers: ['p1', 'p2', 'p3', 'p4'], succeeded: false })).toEqual({
      p1: -5,
      p3: -5,
      p2: 5,
      p4: 5,
    });
  });

  it('opens pandoeren escalation to all players after a pandoeren option appears, with matchable modes marked', () => {
    const options = eligibleRaises({ current: { kind: 'mode', mode: 'misere' }, pandoerenOpened: true });

    expect(options.map((option) => option.label)).toContain('match misere');
    expect(options.map((option) => option.label)).toContain('zwabber');
    expect(PANDOEREN_MODES.filter((mode) => mode.matchable).map((mode) => mode.id)).toEqual(['misere', 'misere-ouvert', 'praatje']);
  });

  it('skips passed players during numeric bidding and closes when only the winning bidder remains', () => {
    const players = ['p1', 'p2', 'p3', 'p4'];

    expect(nextEligibleBidderIndex({ currentIndex: 1, currentBidderId: 'p1', players, passedNumeric: ['p2', 'p3', 'p4'], pandoerenOpened: false })).toBeUndefined();
    expect(nextEligibleBidderIndex({ currentIndex: 1, currentBidderId: 'p1', players, passedNumeric: ['p3'], pandoerenOpened: false })).toBe(3);
    expect(nextEligibleBidderIndex({ currentIndex: 1, currentBidderId: 'p1', players, passedNumeric: ['p3'], pandoerenOpened: true })).toBe(2);
  });

  it('classifies no-trump, called-card, and pass-fail mode contracts', () => {
    expect(contractUsesTrump({ kind: 'mode', mode: 'misere' })).toBe(false);
    expect(contractUsesTrump({ kind: 'mode', mode: 'zwabber' })).toBe(false);
    expect(contractUsesTrump({ kind: 'mode', mode: 'zwabber-solo' })).toBe(false);
    expect(contractUsesTrump({ kind: 'numeric', amount: 100 })).toBe(true);

    expect(contractUsesCalledCard({ kind: 'mode', mode: 'misere' })).toBe(false);
    expect(contractUsesCalledCard({ kind: 'mode', mode: 'zwabber' })).toBe(true);
    expect(contractUsesCalledCard({ kind: 'numeric', amount: 100 })).toBe(true);

    expect(contractScoresTrickPoints({ kind: 'mode', mode: 'misere' })).toBe(false);
    expect(contractScoresTrickPoints({ kind: 'mode', mode: 'zwabber' })).toBe(false);
    expect(contractScoresTrickPoints({ kind: 'mode', mode: 'prive' })).toBe(false);
    expect(contractScoresTrickPoints({ kind: 'numeric', amount: 100 })).toBe(true);
  });

  it('limits called-card options to the highest actually callable card per suit', () => {
    const callerHand: Card[] = [
      { suit: 'clubs', rank: 'Q', id: 'clubs-Q' },
      { suit: 'hearts', rank: '7', id: 'hearts-7' },
      { suit: 'spades', rank: 'A', id: 'spades-A' },
    ];

    expect(calledCardOptions({ callerHand, trumpSuit: 'hearts' }).map((card) => card.id)).toEqual(['hearts-J', 'clubs-A']);
  });

  it('detects automatic called-card defeat when called card appears on a non-declarer-led trick', () => {
    expect(isCalledCardDefeat({
      currentTrick: [
        { playerId: 'p2', card: { suit: 'clubs', rank: '7', id: 'clubs-7' } },
        { playerId: 'p3', card: { suit: 'clubs', rank: 'A', id: 'clubs-A' } },
      ],
      calledCardId: 'clubs-A',
      declarerId: 'p1',
    })).toBe(true);
    expect(isCalledCardDefeat({
      currentTrick: [
        { playerId: 'p1', card: { suit: 'clubs', rank: '7', id: 'clubs-7' } },
        { playerId: 'p3', card: { suit: 'clubs', rank: 'A', id: 'clubs-A' } },
      ],
      calledCardId: 'clubs-A',
      declarerId: 'p1',
    })).toBe(false);
  });
});
