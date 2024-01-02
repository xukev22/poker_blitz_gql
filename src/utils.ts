import {
  BettingStage,
  Card,
  CardSuit,
  CardValue,
  IBetAction,
  IPokerTable,
} from "./types/tables";

// Returns the new calculated elo based on the current elo, finish position,
// and list of all elos (including this player) at the table
// finishPosition is from 1 to elos.length inclusive
// TODO later maybe with jarnell
export function calculateNewElo(
  elo: number,
  finishPosition: number,
  elos: number[]
): number {
  const startPlayerCount = elos.length;
  if (finishPosition < 1 || finishPosition > startPlayerCount) {
    throw new Error("Finish position is invalid");
  }

  return elo + Math.floor(Math.random() * 100) - 50;
}

// Generate a standard deck of 52 cards
export function generateDeck(): Card[] {
  const deck: Card[] = [];

  for (const suit of Object.values(CardSuit)) {
    for (const value of Object.values(CardValue)) {
      deck.push({ suit: suit as CardSuit, value: value as CardValue });
    }
  }

  return deck;
}

// Return the blind multiplier that should be in effect at the current hand number
export function calculateNewBlindMultiplier(
  handNum: number,
  blindIncreaseRatio: number,
  handsUntilBlindsIncrease: number
): number {
  const numTimesBlindsShouldIncrease = Math.floor(
    (handNum - 1) / handsUntilBlindsIncrease
  );
  return 1 * Math.pow(blindIncreaseRatio, numTimesBlindsShouldIncrease);
}

export function getCurrentBettingHistory(table: IPokerTable): IBetAction[] {
  let bettingHistory: IBetAction[];
  switch (table.bettingStage) {
    case BettingStage.PREFLOP:
      bettingHistory = this.preFlopBettingHistory;
      break;
    case BettingStage.FLOP:
      bettingHistory = this.flopBettingHistory;
      break;
    case BettingStage.TURN:
      bettingHistory = this.turnBettingHistory;
      break;
    case BettingStage.RIVER:
      bettingHistory = this.riverBettingHistory;
      break;
  }
  return bettingHistory;
}
