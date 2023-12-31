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

  // placeholder Elo calculation with a random factor between -50 and 50
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

// Get the current betting history based on the table's betting stage
export function getCurrentBettingHistory(table: IPokerTable): IBetAction[] {
  let bettingHistory: IBetAction[];
  switch (table.bettingStage) {
    case BettingStage.PREFLOP:
      bettingHistory = table.preFlopBettingHistory;
      break;
    case BettingStage.FLOP:
      bettingHistory = table.flopBettingHistory;
      break;
    case BettingStage.TURN:
      bettingHistory = table.turnBettingHistory;
      break;
    case BettingStage.RIVER:
      bettingHistory = table.riverBettingHistory;
      break;
    default:
      throw new Error("No active betting phase");
  }
  return bettingHistory;
}

// Map CardValue enum to corresponding numeric representation
export function cardValueToNumberRep(cardValue: CardValue): number {
  switch (cardValue) {
    case CardValue.ACE:
      return 14;
    case CardValue.KING:
      return 13;
    case CardValue.QUEEN:
      return 12;
    case CardValue.JACK:
      return 11;
    case CardValue.TEN:
      return 10;
    case CardValue.NINE:
      return 9;
    case CardValue.EIGHT:
      return 8;
    case CardValue.SEVEN:
      return 7;
    case CardValue.SIX:
      return 6;
    case CardValue.FIVE:
      return 5;
    case CardValue.FOUR:
      return 4;
    case CardValue.THREE:
      return 3;
    case CardValue.TWO:
      return 2;
  }
}

// Map numeric representation to corresponding CardValue enum
export function numberRepToCardValue(value: number): CardValue {
  switch (value) {
    case 14:
      return CardValue.ACE;
    case 13:
      return CardValue.KING;
    case 12:
      return CardValue.QUEEN;
    case 11:
      return CardValue.JACK;
    case 10:
      return CardValue.TEN;
    case 9:
      return CardValue.NINE;
    case 8:
      return CardValue.EIGHT;
    case 7:
      return CardValue.SEVEN;
    case 6:
      return CardValue.SIX;
    case 5:
      return CardValue.FIVE;
    case 4:
      return CardValue.FOUR;
    case 3:
      return CardValue.THREE;
    case 2:
      return CardValue.TWO;
  }
}

// Compare two arrays of CardValue enums based on their numeric representations,
// tiebreakers are broken in the order of the array indices
export function compareArrays(
  array1: CardValue[],
  array2: CardValue[]
): number {
  if (array1.length !== array2.length) {
    throw new Error("Arrays must be of the same size");
  }

  for (let index = 0; index < array1.length; index++) {
    if (
      cardValueToNumberRep(array1[index]) > cardValueToNumberRep(array2[index])
    ) {
      return 1;
    } else if (
      cardValueToNumberRep(array1[index]) < cardValueToNumberRep(array2[index])
    ) {
      return -1;
    }
  }

  return 0;
}

export function shuffleArray<T>(array: T[]): T[] {
  let currentIndex = array.length;
  let randomIndex: number;

  // While there remain elements to shuffle...
  while (currentIndex !== 0) {
    // Pick a remaining element...
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;

    // And swap it with the current element.
    [array[currentIndex], array[randomIndex]] = [
      array[randomIndex],
      array[currentIndex],
    ];
  }

  return array;
}
