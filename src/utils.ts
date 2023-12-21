import { Card, Suit, Value } from "./types/tables";
import { PlayerTableConnection } from "./types/tables";

// Returns a new array that is a shuffled version of the given array
export function shuffleArray<T>(array: T[]): T[] {
  const shuffledArray = [...array]; // Create a shallow copy of the array

  for (let i = shuffledArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1)); // Random index from 0 to i

    // Swap elements at i and j
    [shuffledArray[i], shuffledArray[j]] = [shuffledArray[j], shuffledArray[i]];
  }

  return shuffledArray;
}

// Returns the new calculated elo based on the current elo, finish position,
// and list of all elos (including this player) at the table
// finishPosition is from 1 to elos.length inclusive
// TODO
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

// Returns the initial player whose initial option it is (SB/BB in heads-up) to kickoff the hand action
// given the hand number and sequence of player IDs
export function calculateInitHandOption(
  handNumber: number,
  seatingArrangement: PlayerTableConnection[]
): number {
  const alivePlayerCount = seatingArrangement.filter(
    (ptc) => ptc.stack > 0
  ).length;
  if (handNumber < 1) {
    throw new Error("Hand number is invalid");
  }
  if (alivePlayerCount < 2 || alivePlayerCount > 10) {
    throw new Error("Amount of players at table is invalid");
  }

  let index = (handNumber - 1) % alivePlayerCount;
  let count = 0;
  while (count < seatingArrangement.length) {
    if (seatingArrangement[index].stack > 0) {
      return seatingArrangement[index].playerID;
    }
    if (index == seatingArrangement.length - 1) {
      index = 0;
    } else {
      index++;
    }
  }
  throw new Error(
    "Data corrupted somewhere: Should have found an alive player before iterating over whole list"
  );
}

// Deals out N hole cards to each player that is alive
export function dealUniqueHoleCards(
  seatingArrangement: PlayerTableConnection[],
  numDeal: number
): PlayerTableConnection[] {
  if (numDeal < 1 || numDeal > 4) {
    throw new Error("Num deal must be between 1 and 4 inclusive");
  }
  const deck: Card[] = shuffleArray(generateDeck());

  if (seatingArrangement.length > 10 || seatingArrangement.length < 2) {
    throw new Error("Table cannot have more than 10 players");
  }
  return seatingArrangement.map((ptc) => {
    if (ptc.stack <= 0) {
      return ptc;
    }
    const holeCards: Card[] = [];
    for (let i = 1; i <= numDeal; i++) {
      holeCards.push(deck.pop());
    }
    return { ...ptc, holeCards: holeCards };
  });
}

// Generate a standard deck of 52 cards
function generateDeck(): Card[] {
  const deck: Card[] = [];

  for (const suit of Object.values(Suit)) {
    for (const value of Object.values(Value)) {
      deck.push({ suit: suit as Suit, value: value as Value });
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

// Return the nth position after the given index,
// i.e given (0, [alive, dead, alive, alive], 1) -> 2
export function findNthPosAfterAliveIndex(
  startIndex: number,
  seatingArrangement: PlayerTableConnection[],
  n: number
): number {
  if (seatingArrangement.length < 2 || seatingArrangement.length > 10) {
    throw new Error("Table is invalid size");
  }
  if (startIndex < 0 || startIndex > 9) {
    throw new Error("Invalid start index");
  }
  if (n < 1) {
    throw new Error("N must be positive");
  }
  let index = startIndex + 1 == seatingArrangement.length ? 0 : startIndex + 1;
  let count = 0;
  let aliveSeen = 0;
  while (count < seatingArrangement.length) {
    if (seatingArrangement[index].stack > 0) {
      aliveSeen++;
      if (aliveSeen == n) {
        return index;
      }
    }
    if (index == seatingArrangement.length - 1) {
      index = 0;
    } else {
      index++;
    }
  }
  throw new Error(
    "Data corrupted somewhere: should have found an alive player before iterating over whole list"
  );
}
