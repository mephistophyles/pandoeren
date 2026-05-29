# Pandoeren

Hot-seat prototype for Phil's opinionated home-rules version of Pandoeren.

## Current scope

This first commit is intentionally coarse: it provides a browser UI for testing the shape of the game mechanics quickly, plus a tested rules foundation.

Implemented so far:

- Vite + React + TypeScript app.
- Four-player session ledger starting at 100 cents each.
- 32-card 7-through-A deck and 8-card deal per player.
- Default hand display order: clubs, diamonds, spades, hearts; ascending non-trump rank within suit.
- Numeric bidding from 80 plus Pandoeren mode escalation buttons.
- Hot-seat flow for bidding, contract selection, and play.
- Legal-play enforcement for follow-suit and overtrump constraints.
- Trick winner and trick-point processing, including trump point exceptions and last-trick bonus.
- Standard deal settlement by target delta rounded to nearest 5 cents.
- Misere settlement helper for multiple simultaneous miseres.

Not complete yet:

- Roem declaration UI and target adjustment.
- Called-partner automatic-loss detection.
- Pandoeren special-mode play resolution.
- Bots.
- Online lobby.

## Development

```bash
npm install
npm test
npm run build
npm run dev
```

## Terminology

- **Session**: the whole sitting until a player is out of money.
- **Deal**: one round of bidding and the subsequent playing of that hand.
- **Trick**: one cycle where each player plays one card.
