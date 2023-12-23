import Table, { BetActionType, Card, Suit, Value } from "./types/tables";
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

// Returns whether or not the given player could check, given it is their turn
export function canCheck(
  playerID: number,
  seatingArrangement: PlayerTableConnection[]
): boolean {
  const myPtc = seatingArrangement.find((ptc) => ptc.playerID == playerID);
  let myPrevBet = 0;
  if (myPtc.bettingHistory.length > 0) {
    const prevPokerAction =
      myPtc.bettingHistory[myPtc.bettingHistory.length - 1];
    if (prevPokerAction.amount) {
      myPrevBet = prevPokerAction.amount;
    }
  }

  let maxBetSeen = 0;
  for (const ptc of seatingArrangement) {
    if (ptc.playerID == myPtc.playerID) {
      continue;
    }
    let betAmount = 0;
    if (ptc.bettingHistory.length > 0) {
      const prevPokerAction = ptc.bettingHistory[ptc.bettingHistory.length - 1];
      if (prevPokerAction.amount) {
        betAmount = prevPokerAction.amount;
      }
    }
    if (betAmount && betAmount > maxBetSeen) {
      maxBetSeen = betAmount;
    }
  }

  return maxBetSeen <= myPrevBet;
}

export function isBettingActionDone(table: Table): boolean {
  const alivePlayers = table.seatingArrangement.filter((ptc) => ptc.stack > 0);
  const bettingLeadID = table.bettingLead;

  const bettingLeadPlayer = table.seatingArrangement.find(
    (ptc) => ptc.playerID == bettingLeadID
  );
  const bettingLeadIndex = table.seatingArrangement.indexOf(bettingLeadPlayer);
  if (bettingLeadIndex == -1) {
    throw new Error(
      "Data corrupted somewhere: betting lead player was not found in table seating arrangement"
    );
  }
  const betCount = table.seatingArrangement.find(
    (ptc) => ptc.playerID == bettingLeadID
  ).bettingHistory.length;

  let foldCount = 0;
  for (const ptc of alivePlayers) {
    if (ptc.playerID == bettingLeadID) {
      continue;
    }
    if (
      ptc.bettingHistory.length > 0 &&
      ptc.bettingHistory[ptc.bettingHistory.length - 1].action ==
        BetActionType.FOLD
    ) {
      foldCount++;
    }
  }
  if (foldCount == alivePlayers.length - 1) {
    return true;
  }

  for (const ptc of alivePlayers) {
    if (ptc.playerID == bettingLeadID) {
      continue;
    }
    const thisPtc = table.seatingArrangement.find(
      (ptc) => ptc.playerID == bettingLeadID
    );
    if (table.seatingArrangement.indexOf(thisPtc) > bettingLeadIndex) {
      if (thisPtc.bettingHistory.length != betCount) {
        return false;
      }
      if (!thisPtc.bettingHistory[betCount - 1].amount) {
        continue;
      }
      if (
        bettingLeadPlayer.bettingHistory[betCount - 1].amount !=
        thisPtc.bettingHistory[betCount - 1].amount
      ) {
        return false;
      }
    } else {
      if (thisPtc.bettingHistory.length + 1 != betCount) {
        return false;
      }
      if (!thisPtc.bettingHistory[betCount].amount) {
        continue;
      }
      if (
        bettingLeadPlayer.bettingHistory[betCount - 1].amount !=
        thisPtc.bettingHistory[betCount].amount
      ) {
        return false;
      }
    }
  }
  return true;
}
