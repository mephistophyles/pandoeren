import { useMemo, useState } from 'react';
import {
  type Bid,
  type Card,
  type PlayedCard,
  type Suit,
  PANDOEREN_MODES,
  SUITS,
  bidLabel,
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
  legalPlays,
  nextEligibleBidderIndex,
  rankHandForDisplay,
  roemPoints,
  roemTargetAdjustment,
  settleModeContract,
  settleStandardDeal,
  shuffleDeck,
  trickPoints,
} from './rules';
import './styles.css';

type Player = {
  id: string;
  name: string;
  balance: number;
};

type DealState = {
  dealerIndex: number;
  turnIndex: number;
  phase: 'bidding' | 'choose-contract' | 'play' | 'settled';
  hands: Record<string, Card[]>;
  currentBid: Bid;
  currentBidderId: string;
  passedNumeric: string[];
  passedDeal: string[];
  pandoerenOpened: boolean;
  trumpSuit?: Suit;
  calledCardId?: string;
  openRoem: number;
  declarerTeam: string[];
  defenders: string[];
  currentTrick: PlayedCard[];
  completedTricks: Array<{ winnerId: string; cards: PlayedCard[]; points: number; roem: number }>;
  teamScores: Record<string, number>;
  targetAdjustment: number;
  log: string[];
};

const initialPlayers: Player[] = [
  { id: 'p1', name: 'Player 1', balance: 100 },
  { id: 'p2', name: 'Player 2', balance: 100 },
  { id: 'p3', name: 'Player 3', balance: 100 },
  { id: 'p4', name: 'Player 4', balance: 100 },
];

function nextIndex(index: number): number {
  return (index + 1) % 4;
}

function createDeal(dealerIndex: number): DealState {
  const hands = dealCards(shuffleDeck(createDeck())).reduce<Record<string, Card[]>>((byPlayer, hand, index) => {
    byPlayer[initialPlayers[index].id] = hand;
    return byPlayer;
  }, {});
  const openerIndex = nextIndex(dealerIndex);
  const opener = initialPlayers[openerIndex];

  return {
    dealerIndex,
    turnIndex: nextIndex(openerIndex),
    phase: 'bidding',
    hands,
    currentBid: { kind: 'numeric', amount: 80 },
    currentBidderId: opener.id,
    passedNumeric: [],
    passedDeal: [],
    pandoerenOpened: false,
    openRoem: 0,
    declarerTeam: [opener.id],
    defenders: initialPlayers.filter((player) => player.id !== opener.id).map((player) => player.id),
    currentTrick: [],
    completedTricks: [],
    teamScores: Object.fromEntries(initialPlayers.map((player) => [player.id, 0])),
    targetAdjustment: 0,
    log: [`${opener.name} opens bidding at 80.`],
  };
}

function cardLabel(card: Card): string {
  const suitSymbol: Record<Suit, string> = { clubs: '♣', diamonds: '♦', spades: '♠', hearts: '♥' };
  return `${card.rank}${suitSymbol[card.suit]}`;
}

function playerName(playerId: string): string {
  return initialPlayers.find((player) => player.id === playerId)?.name ?? playerId;
}

function isImmediateFailureMode(bid: Bid, declarerTeam: string[], winnerId: string): boolean {
  if (bid.kind !== 'mode') return false;
  if (bid.mode === 'misere' || bid.mode === 'misere-ouvert') return declarerTeam.includes(winnerId);
  if (bid.mode === 'zwabber' || bid.mode === 'zwabber-solo' || bid.mode === 'prive') return !declarerTeam.includes(winnerId);
  return false;
}

function App() {
  const [players, setPlayers] = useState<Player[]>(initialPlayers);
  const [deal, setDeal] = useState<DealState>(() => createDeal(0));
  const currentPlayer = players[deal.turnIndex];
  const declarer = players.find((player) => player.id === deal.currentBidderId) ?? players[0];
  const usesTrump = contractUsesTrump(deal.currentBid);
  const usesCalledCard = contractUsesCalledCard(deal.currentBid);
  const effectiveTrumpSuit = usesTrump ? deal.trumpSuit : undefined;
  const selectedCalledCard = deal.calledCardId ? createDeck().find((card) => card.id === deal.calledCardId) : undefined;
  const calledOptions = calledCardOptions({ callerHand: deal.hands[deal.currentBidderId] ?? [], trumpSuit: effectiveTrumpSuit });
  const basePlayableCards = useMemo(() => legalPlays(deal.hands[currentPlayer.id] ?? [], deal.currentTrick, effectiveTrumpSuit), [deal, currentPlayer.id, effectiveTrumpSuit]);
  const forcedCalledCard = forcedCalledCardPlay({
    hand: deal.hands[currentPlayer.id] ?? [],
    legalCards: basePlayableCards,
    currentTrick: deal.currentTrick,
    calledCardId: deal.calledCardId,
    declarerId: deal.currentBidderId,
    trumpSuit: effectiveTrumpSuit,
    completedTricks: deal.completedTricks,
  });
  const playableCards = forcedCalledCard ? [forcedCalledCard] : basePlayableCards;

  function appendLog(message: string): void {
    setDeal((current) => ({ ...current, log: [message, ...current.log].slice(0, 12) }));
  }

  function startNewDeal(nextDealerIndex = nextIndex(deal.dealerIndex)): void {
    setDeal(createDeal(nextDealerIndex));
  }

  function applyLedger(ledger: Record<string, number>): void {
    setPlayers((currentPlayers) => currentPlayers.map((player) => ({ ...player, balance: player.balance + (ledger[player.id] ?? 0) })));
  }

  function failedContractLedger(current: DealState): Record<string, number> {
    if (current.currentBid.kind === 'numeric') {
      return settleStandardDeal({ declarerTeam: current.declarerTeam, defenders: current.defenders, score: 0, target: current.currentBid.amount });
    }
    return settleModeContract({ bid: current.currentBid, declarerTeam: current.declarerTeam, defenders: current.defenders, allPlayers: players.map((player) => player.id), succeeded: false });
  }

  function passBid(): void {
    setDeal((current) => {
      const passedDeal = [...new Set([...current.passedDeal, currentPlayer.id])];
      const passedNumeric = current.pandoerenOpened ? current.passedNumeric : [...new Set([...current.passedNumeric, currentPlayer.id])];
      const nextBidderIndex = nextEligibleBidderIndex({ currentIndex: current.turnIndex, currentBidderId: current.currentBidderId, players: players.map((player) => player.id), passedNumeric, pandoerenOpened: current.pandoerenOpened });
      if (passedDeal.length >= 3 || nextBidderIndex === undefined) {
        return { ...current, passedDeal, passedNumeric, phase: 'choose-contract', turnIndex: players.findIndex((player) => player.id === current.currentBidderId), log: [`Bidding closes. ${playerName(current.currentBidderId)} wins ${bidLabel(current.currentBid)}.`, `${currentPlayer.name} passes.`, ...current.log] };
      }
      return {
        ...current,
        passedDeal,
        passedNumeric,
        turnIndex: nextBidderIndex,
        log: [`${currentPlayer.name} passes.`, ...current.log],
      };
    });
  }

  function raiseBid(nextBid: Bid): void {
    setDeal((current) => {
      const pandoerenOpened = current.pandoerenOpened || nextBid.kind === 'mode';
      return {
        ...current,
        currentBid: nextBid,
        currentBidderId: currentPlayer.id,
        pandoerenOpened,
        passedDeal: [],
        turnIndex: nextEligibleBidderIndex({ currentIndex: current.turnIndex, currentBidderId: currentPlayer.id, players: players.map((player) => player.id), passedNumeric: current.passedNumeric, pandoerenOpened }) ?? current.turnIndex,
        log: [`${currentPlayer.name} raises to ${bidLabel(nextBid)}.`, ...current.log],
      };
    });
  }

  function beginPlay(): void {
    const partnerId = contractUsesCalledCard(deal.currentBid) && deal.calledCardId ? Object.entries(deal.hands).find(([, hand]) => hand.some((card) => card.id === deal.calledCardId))?.[0] : undefined;
    const declarerTeam = partnerId && partnerId !== deal.currentBidderId ? [deal.currentBidderId, partnerId] : [deal.currentBidderId];
    const defenders = players.map((player) => player.id).filter((id) => !declarerTeam.includes(id));
    setDeal((current) => {
      const openRoemAdjustment = contractScoresTrickPoints(current.currentBid) ? -current.openRoem : 0;
      return {
        ...current,
        phase: 'play',
        trumpSuit: contractUsesTrump(current.currentBid) ? current.trumpSuit : undefined,
        turnIndex: players.findIndex((player) => player.id === current.currentBidderId),
        declarerTeam,
        defenders,
        targetAdjustment: openRoemAdjustment,
        log: [
          `${playerName(current.currentBidderId)} starts play${partnerId ? ` with ${playerName(partnerId)} as maat` : ''}.`,
          ...(current.openRoem ? [`Open roem declared by playing team: ${current.openRoem}; adjusts target by ${openRoemAdjustment}.`] : []),
          ...current.log,
        ],
      };
    });
  }

  function playCard(card: Card): void {
    if (!playableCards.some((candidate) => candidate.id === card.id)) return;
    setDeal((current) => {
      const currentEffectiveTrump = contractUsesTrump(current.currentBid) ? current.trumpSuit : undefined;
      const played: PlayedCard = { playerId: currentPlayer.id, card };
      const nextHands = { ...current.hands, [currentPlayer.id]: current.hands[currentPlayer.id].filter((candidate) => candidate.id !== card.id) };
      const nextTrick = [...current.currentTrick, played];

      if (isCalledCardDefeat({ currentTrick: nextTrick, calledCardId: current.calledCardId, declarerId: current.currentBidderId })) {
        const ledger = failedContractLedger(current);
        applyLedger(ledger);
        return {
          ...current,
          hands: nextHands,
          currentTrick: nextTrick,
          phase: 'settled',
          log: [`Automatic defeat: ${cardLabel(card)} was called on a trick not led by ${playerName(current.currentBidderId)}.`, ...current.log],
        };
      }

      if (nextTrick.length < 4) {
        return { ...current, hands: nextHands, currentTrick: nextTrick, turnIndex: nextIndex(current.turnIndex) };
      }

      const isLastTrick = Object.values(nextHands).every((hand) => hand.length === 0);
      const winnerId = determineTrickWinner(nextTrick, currentEffectiveTrump);
      const points = contractScoresTrickPoints(current.currentBid) ? trickPoints(nextTrick.map((play) => play.card), currentEffectiveTrump, isLastTrick) : 0;
      const roem = contractScoresTrickPoints(current.currentBid) ? roemPoints(nextTrick.map((play) => play.card), currentEffectiveTrump) : 0;
      const targetAdjustment = current.targetAdjustment + roemTargetAdjustment({ declarerTeam: current.declarerTeam, winnerId, roem });
      const nextScores = { ...current.teamScores, [winnerId]: current.teamScores[winnerId] + points };
      const completedTricks = [...current.completedTricks, { winnerId, cards: nextTrick, points, roem }];
      const winnerIndex = players.findIndex((player) => player.id === winnerId);

      if (isImmediateFailureMode(current.currentBid, current.declarerTeam, winnerId)) {
        const ledger = settleModeContract({ bid: current.currentBid, declarerTeam: current.declarerTeam, defenders: current.defenders, allPlayers: players.map((player) => player.id), succeeded: false });
        applyLedger(ledger);
        return {
          ...current,
          hands: nextHands,
          currentTrick: [],
          completedTricks,
          teamScores: nextScores,
          phase: 'settled',
          log: [`${bidLabel(current.currentBid)} failed immediately when ${playerName(winnerId)} won the trick.`, ...current.log],
        };
      }

      if (isLastTrick) {
        const declarerScore = current.declarerTeam.reduce((total, playerId) => total + nextScores[playerId], 0);
        const target = current.currentBid.kind === 'numeric' ? current.currentBid.amount + targetAdjustment : 0;
        const ledger = current.currentBid.kind === 'numeric'
          ? settleStandardDeal({ declarerTeam: current.declarerTeam, defenders: current.defenders, score: declarerScore, target })
          : settleModeContract({ bid: current.currentBid, declarerTeam: current.declarerTeam, defenders: current.defenders, allPlayers: players.map((player) => player.id), succeeded: true });
        applyLedger(ledger);
        return {
          ...current,
          hands: nextHands,
          currentTrick: [],
          completedTricks,
          teamScores: nextScores,
          targetAdjustment,
          phase: 'settled',
          log: [`Deal settled. Declarer side scored ${declarerScore} against ${target}.`, `${playerName(winnerId)} wins final trick${points ? ` for ${points} points` : ''}.`, ...(roem ? [`Roem in trick adjusts target by ${roemTargetAdjustment({ declarerTeam: current.declarerTeam, winnerId, roem })}.`] : []), ...current.log],
        };
      }

      return {
        ...current,
        hands: nextHands,
        currentTrick: [],
        completedTricks,
        teamScores: nextScores,
        targetAdjustment,
        turnIndex: winnerIndex,
        log: [`${playerName(winnerId)} wins trick ${completedTricks.length}${points ? ` for ${points} points` : ''}.`, ...(roem ? [`Roem in trick adjusts target by ${roemTargetAdjustment({ declarerTeam: current.declarerTeam, winnerId, roem })}.`] : []), ...current.log],
      };
    });
  }

  const raiseOptions = eligibleRaises({ current: deal.currentBid, pandoerenOpened: deal.pandoerenOpened });
  const sessionOver = players.some((player) => player.balance <= 0);

  return (
    <main className="app-shell">
      <header className="hero">
        <div>
          <p className="eyebrow">Opinionated home-rules prototype</p>
          <h1>Pandoeren Hot-Seat</h1>
          <p>Coarse first UI for testing bidding, deal flow, legal play, trick scoring, and end-of-deal ledger changes.</p>
        </div>
        <button onClick={() => startNewDeal()} type="button">New deal</button>
      </header>

      {sessionOver && <section className="warning">Session over: at least one player is out of money.</section>}

      <section className="grid">
        <article className="panel">
          <h2>Session ledger</h2>
          <div className="ledger">
            {players.map((player, index) => (
              <div className={index === deal.dealerIndex ? 'dealer player-row' : 'player-row'} key={player.id}>
                <span>{player.name}{index === deal.dealerIndex ? ' · dealer' : ''}</span>
                <strong>{player.balance}¢</strong>
              </div>
            ))}
          </div>
        </article>

        <article className="panel">
          <h2>Current bid</h2>
          <p><strong>{bidLabel(deal.currentBid)}</strong> by {declarer.name}</p>
          <p>Phase: {deal.phase}</p>
          <p>Trump: {usesTrump ? (deal.trumpSuit ?? 'not chosen') : 'none'}</p>
          <p>Called card: {usesCalledCard ? (selectedCalledCard ? cardLabel(selectedCalledCard) : 'not chosen') : 'none'}</p>
          <p>Open roem: {deal.openRoem}</p>
          <p>Bid adjustment: {deal.targetAdjustment}</p>
          {deal.phase === 'bidding' && (
            <div className="actions">
              <button onClick={passBid} type="button">Pass</button>
              {raiseOptions.slice(0, 8).map((option) => (
                <button key={`${option.label}-${option.bid.kind}`} onClick={() => raiseBid(option.bid)} type="button">{option.label}</button>
              ))}
            </div>
          )}
          {deal.phase === 'choose-contract' && (
            <div className="contract-form">
              {usesTrump && (
                <label>
                  Trump
                  <select value={deal.trumpSuit ?? ''} onChange={(event) => setDeal((current) => ({ ...current, trumpSuit: event.target.value as Suit }))}>
                    <option value="">Choose suit</option>
                    {SUITS.map((suit) => <option key={suit} value={suit}>{suit}</option>)}
                  </select>
                </label>
              )}
              {contractScoresTrickPoints(deal.currentBid) && (
                <label>
                  Open roem
                  <select value={deal.openRoem} onChange={(event) => setDeal((current) => ({ ...current, openRoem: Number(event.target.value) }))}>
                    <option value={0}>None</option>
                    <option value={20}>20</option>
                    <option value={40}>40</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </label>
              )}
              {usesCalledCard && (
                <label>
                  Called card
                  <select value={deal.calledCardId ?? ''} onChange={(event) => setDeal((current) => ({ ...current, calledCardId: event.target.value }))}>
                    <option value="">No called card yet</option>
                    {calledOptions.map((card) => <option key={card.id} value={card.id}>{cardLabel(card)}</option>)}
                  </select>
                </label>
              )}
              <button disabled={(usesTrump && !deal.trumpSuit) || (usesCalledCard && !deal.calledCardId)} onClick={beginPlay} type="button">Start play</button>
            </div>
          )}
          {deal.phase === 'settled' && <button onClick={() => startNewDeal()} type="button">Next deal</button>}
        </article>
      </section>

      <section className="panel table-panel">
        <h2>{currentPlayer.name} hand</h2>
        <p className="hint">Hot-seat mode: pass the device to the current player. Cards are grouped ♣ ♦ ♠ ♥ in ascending non-trump order.</p>
        <div className="card-row">
          {rankHandForDisplay(deal.hands[currentPlayer.id] ?? []).map((card) => {
            const legal = deal.phase === 'play' && playableCards.some((candidate) => candidate.id === card.id);
            return (
              <button className={`card ${card.suit} ${legal ? 'legal' : ''}`} disabled={deal.phase !== 'play' || !legal} key={card.id} onClick={() => playCard(card)} type="button">
                {cardLabel(card)}
              </button>
            );
          })}
        </div>
      </section>

      <section className="grid">
        <article className="panel">
          <h2>Current trick</h2>
          <div className="trick-row">
            {deal.currentTrick.length === 0 && <p>No cards played yet.</p>}
            {deal.currentTrick.map((play) => <span className="played-card" key={`${play.playerId}-${play.card.id}`}>{playerName(play.playerId)}: {cardLabel(play.card)}</span>)}
          </div>
        </article>

        <article className="panel">
          <h2>Event log</h2>
          <ol className="log-list">
            {deal.log.map((entry, index) => <li key={`${entry}-${index}`}>{entry}</li>)}
          </ol>
        </article>
      </section>
    </main>
  );
}

export default App;
