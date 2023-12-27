import db from "./db";
import Table, {
  BetActionType,
  BettingStage,
  Card,
  PokerAction,
  PokerVariants,
  Suit,
  Value,
} from "./types/tables";
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
// TODO later
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

export function initHandVars(table: Table): void {
  table.hand++;
  table.handInProgress = true;
  table.bettingStage = BettingStage.PREFLOP;
  table.pot = new Map<number, PokerAction>();
  table.bettingLog = new Map<number, PokerAction[]>();

  // defensive

  // prepare for hole cards dealt and reset betting history to []
  table.seatingArrangement = table.seatingArrangement.map((ptc) => {
    return {
      ...ptc,
      holeCards: [],
      bettingHistory: [],
    };
  });

  // set blinds based on hand number, increase ratio, and increase frequency
  let blindMultiplier = 1;
  if (
    table.tableOverview.blindIncreaseRatio &&
    table.tableOverview.handsUntilBlindsIncrease
  ) {
    blindMultiplier = calculateNewBlindMultiplier(
      table.hand,
      table.tableOverview.blindIncreaseRatio,
      table.tableOverview.handsUntilBlindsIncrease
    );
  }
  table.currentSB = Math.round(
    table.tableOverview.startingSB * blindMultiplier
  );
  table.currentBB = Math.round(
    table.tableOverview.startingBB * blindMultiplier
  );
  table.currentST = Math.round(
    table.tableOverview.startingST * blindMultiplier
  );

  // initialize option, sometimes is reinitialized depending on table size:
  // NOTE THIS DOES NOT PERFECTLY WORK YET RIGHT AFTER PLAYERS ARE ELIMINATED
  table.option = calculateInitHandOption(table.hand, table.seatingArrangement);

  // deal unique hole cards to alive players depending on the variant
  // NOTE THIS CURRENTLY ONLY SUPPORTS NLH, PLO
  table.seatingArrangement = dealUniqueHoleCards(
    table.seatingArrangement,
    table.tableOverview.variant == PokerVariants.NLH ? 2 : 4
  );

  // get index of starting player
  let optionIndex = table.seatingArrangement.findIndex(
    (ptc) => ptc.playerID == table.option
  );

  if (optionIndex == -1) {
    throw new Error(
      "Data corrupted somewhere: playerID option not found in seating arrangement"
    );
  }

  // defensive check, already handled in dealUniqueHoleCards
  if (
    table.seatingArrangement.length < 2 ||
    table.seatingArrangement.length > 10
  ) {
    throw new Error("Amount of players at table is invalid");
  }

  const alivePlayerCount = table.seatingArrangement.filter(
    (ptc) => ptc.stack > 0
  ).length;

  // if only 2 players alive, no SB, use BB and ST
  if (alivePlayerCount == 2) {
    const ptcBB = table.seatingArrangement[optionIndex];
    const ptcST =
      table.seatingArrangement[
        findNthPosAfterAliveIndex(optionIndex, table.seatingArrangement, 1)
      ];
    // force BB bet
    // TODO later extract common pattern to helper in utils,
    if (ptcBB.stack <= table.currentBB) {
      table.pot.set(ptcBB.playerID, {
        action: BetActionType.ALL_IN_FORCED_BLIND,
        stage: BettingStage.PREFLOP,
        amount: ptcBB.stack,
      });
      table.bettingLog.set(ptcBB.playerID, [
        {
          action: BetActionType.ALL_IN_FORCED_BLIND,
          stage: BettingStage.PREFLOP,
          amount: ptcBB.stack,
        },
      ]);
      ptcBB.stack = 0;
    } else {
      table.pot.set(ptcBB.playerID, {
        action: BetActionType.BB,
        stage: BettingStage.PREFLOP,
        amount: table.currentBB,
      });
      table.bettingLog.set(ptcBB.playerID, [
        {
          action: BetActionType.BB,
          stage: BettingStage.PREFLOP,
          amount: table.currentBB,
        },
      ]);
      ptcBB.stack -= table.currentBB;
    }
    // force ST bet
    if (ptcST.stack <= table.currentST) {
      table.pot.set(ptcST.playerID, {
        action: BetActionType.ALL_IN_FORCED_BLIND,
        stage: BettingStage.PREFLOP,
        amount: ptcST.stack,
      });
      table.bettingLog.set(ptcST.playerID, [
        {
          action: BetActionType.ALL_IN_FORCED_BLIND,
          stage: BettingStage.PREFLOP,
          amount: ptcST.stack,
        },
      ]);
      ptcST.stack = 0;
    } else {
      table.pot.set(ptcST.playerID, {
        action: BetActionType.ST,
        stage: BettingStage.PREFLOP,
        amount: ptcST.stack,
      });
      table.bettingLog.set(ptcST.playerID, [
        {
          action: BetActionType.ST,
          stage: BettingStage.PREFLOP,
          amount: ptcST.stack,
        },
      ]);
      ptcST.stack -= table.currentST;
    }
  } else {
    // otherwise we have a hand where all the blinds are used, aka more than 2 players left
    const ptcSB = table.seatingArrangement[optionIndex];
    const ptcBB =
      table.seatingArrangement[
        findNthPosAfterAliveIndex(optionIndex, table.seatingArrangement, 1)
      ];
    const ptcST =
      table.seatingArrangement[
        findNthPosAfterAliveIndex(optionIndex, table.seatingArrangement, 2)
      ];
    // force SB bet
    if (ptcSB.stack <= table.currentSB) {
      table.pot.set(ptcSB.playerID, {
        action: BetActionType.ALL_IN_FORCED_BLIND,
        stage: BettingStage.PREFLOP,
        amount: ptcSB.stack,
      });
      table.bettingLog.set(ptcSB.playerID, [
        {
          action: BetActionType.ALL_IN_FORCED_BLIND,
          stage: BettingStage.PREFLOP,
          amount: ptcSB.stack,
        },
      ]);
      ptcSB.stack = 0;
    } else {
      table.pot.set(ptcSB.playerID, {
        action: BetActionType.SB,
        stage: BettingStage.PREFLOP,
        amount: ptcSB.stack,
      });
      table.bettingLog.set(ptcSB.playerID, [
        {
          action: BetActionType.SB,
          stage: BettingStage.PREFLOP,
          amount: ptcSB.stack,
        },
      ]);
      ptcSB.stack -= table.currentSB;
    }
    // force BB bet
    if (ptcBB.stack <= table.currentBB) {
      table.pot.set(ptcBB.playerID, {
        action: BetActionType.ALL_IN_FORCED_BLIND,
        stage: BettingStage.PREFLOP,
        amount: ptcBB.stack,
      });
      table.bettingLog.set(ptcBB.playerID, [
        {
          action: BetActionType.ALL_IN_FORCED_BLIND,
          stage: BettingStage.PREFLOP,
          amount: ptcBB.stack,
        },
      ]);
      ptcBB.stack = 0;
    } else {
      table.pot.set(ptcBB.playerID, {
        action: BetActionType.BB,
        stage: BettingStage.PREFLOP,
        amount: table.currentBB,
      });
      table.bettingLog.set(ptcBB.playerID, [
        {
          action: BetActionType.BB,
          stage: BettingStage.PREFLOP,
          amount: table.currentBB,
        },
      ]);
      ptcBB.stack -= table.currentBB;
    }
    // force ST bet
    if (ptcST.stack <= table.currentST) {
      table.pot.set(ptcST.playerID, {
        action: BetActionType.ALL_IN_FORCED_BLIND,
        stage: BettingStage.PREFLOP,
        amount: ptcST.stack,
      });
      table.bettingLog.set(ptcST.playerID, [
        {
          action: BetActionType.ALL_IN_FORCED_BLIND,
          stage: BettingStage.PREFLOP,
          amount: ptcST.stack,
        },
      ]);
      ptcST.stack = 0;
    } else {
      table.pot.set(ptcST.playerID, {
        action: BetActionType.ST,
        stage: BettingStage.PREFLOP,
        amount: ptcST.stack,
      });
      table.bettingLog.set(ptcST.playerID, [
        {
          action: BetActionType.ST,
          stage: BettingStage.PREFLOP,
          amount: ptcST.stack,
        },
      ]);
      ptcST.stack -= table.currentST;
    }

    // change option to UTG if necessary
    if (alivePlayerCount != 3) {
      table.option =
        table.seatingArrangement[
          findNthPosAfterAliveIndex(optionIndex, table.seatingArrangement, 3)
        ].playerID;
    }
  }

  let allInBlindCount = 0;
  table.pot.forEach((pokerActions) => {
    if (pokerActions[0].action == BetActionType.ALL_IN_FORCED_BLIND) {
      allInBlindCount++;
    }
  });

  // if everyone or everyone but 1 player is all in preflop due to forced blinds, we can conclude betting action
  if (alivePlayerCount <= 3 && allInBlindCount == alivePlayerCount - 1) {
    delete table.option;
    table.bettingStage = BettingStage.RUNOUT;
    console.log("runout the table function here (placeholder)");
  } else {
    // otherwise assign the betting lead
    table.bettingLead =
      table.seatingArrangement[
        findNthPosAfterAliveIndex(optionIndex, table.seatingArrangement, 2)
      ].playerID;
  }
}

export function initTableVars(table: Table): void {
  table.tableInProgress = true;

  // defensive, reset everything
  table.hand = 0;
  delete table.option;
  delete table.pot;
  delete table.bettingLog;

  delete table.flop;
  delete table.turn;
  delete table.river;

  table.currentSB = table.tableOverview.startingSB;
  table.currentBB = table.tableOverview.startingBB;
  table.currentST = table.tableOverview.startingST;

  table.seatingArrangement = shuffleArray(table.seatingArrangement);
  table.seatingArrangement = table.seatingArrangement.map((ptc) => {
    return {
      ...ptc,
      stack: table.tableOverview.startingStack,
      holeCards: null,
      bettingHistory: null,
    };
  });
}

// Returns the reference to the player and corresponding table they are sitting at,
// throwing if the player doesnt exist, or if the player is not sitting at a table,
// or in the rare case that data may be corrupted: the table does not contain the playerID
export function getPlayerAndTableByPlayerID(playerID: number) {
  const player = db.players.find((player) => player.id == playerID);

  if (!player) {
    throw new Error("Player not found");
  }

  if (!player.table) {
    throw new Error("There is no table player is sitting at");
  }

  const table = db.tables.find((table) => table.id == player.table);

  if (!table) {
    throw new Error(
      "Data corrupted somewhere: this player has a reference to a nonexistent table"
    );
  }

  return { player, table };
}

// Returns whether or not the given player could check, given it is their turn
// TODO now rewrite this is wrong
export function canCheck(playerID: number, table: Table): boolean {
  // const myPtc = seatingArrangement.find((ptc) => ptc.playerID == playerID);
  // let myPrevBet = 0;
  // if (myPtc.bettingHistory.length > 0) {
  //   const prevPokerAction =
  //     myPtc.bettingHistory[myPtc.bettingHistory.length - 1];
  //   if (prevPokerAction.amount) {
  //     myPrevBet = prevPokerAction.amount;
  //   }
  // }
  // let maxBetSeen = 0;
  // for (const ptc of seatingArrangement) {
  //   if (ptc.playerID == myPtc.playerID) {
  //     continue;
  //   }
  //   let betAmount = 0;
  //   if (ptc.bettingHistory.length > 0) {
  //     const prevPokerAction = ptc.bettingHistory[ptc.bettingHistory.length - 1];
  //     if (prevPokerAction.amount) {
  //       betAmount = prevPokerAction.amount;
  //     }
  //   }
  //   if (betAmount && betAmount > maxBetSeen) {
  //     maxBetSeen = betAmount;
  //   }
  // }
  // return maxBetSeen <= myPrevBet;
}

// TODO now
export function canCall(playerID: number, table: Table): boolean {}

// TODO now this is wrong
export function isBettingActionDone(table: Table): boolean {
  // const bettingLeadIndex = table.seatingArrangement.indexOf(bettingLeadPlayer);
  // if (bettingLeadIndex == -1) {
  //   throw new Error(
  //     "Data corrupted somewhere: betting lead player was not found in table seating arrangement"
  //   );
  // }
  // const betCount = table.seatingArrangement.find(
  //   (ptc) => ptc.playerID == table.bettingLead
  // ).bettingHistory.length;
  // let foldCount = 0;
  // for (const ptc of alivePlayers) {
  //   if (ptc.playerID == bettingLeadID) {
  //     continue;
  //   }
  //   if (
  //     ptc.bettingHistory.length > 0 &&
  //     ptc.bettingHistory[ptc.bettingHistory.length - 1].action ==
  //       BetActionType.FOLD
  //   ) {
  //     foldCount++;
  //   }
  // }
  // if (foldCount == alivePlayers.length - 1) {
  //   return true;
  // }
  // for (const ptc of alivePlayers) {
  //   if (ptc.playerID == bettingLeadID) {
  //     continue;
  //   }
  //   const thisPtc = table.seatingArrangement.find(
  //     (ptc) => ptc.playerID == bettingLeadID
  //   );
  //   if (table.seatingArrangement.indexOf(thisPtc) > bettingLeadIndex) {
  //     if (thisPtc.bettingHistory.length != betCount) {
  //       return false;
  //     }
  //     if (!thisPtc.bettingHistory[betCount - 1].amount) {
  //       continue;
  //     }
  //     if (
  //       bettingLeadPlayer.bettingHistory[betCount - 1].amount !=
  //       thisPtc.bettingHistory[betCount - 1].amount
  //     ) {
  //       return false;
  //     }
  //   } else {
  //     if (thisPtc.bettingHistory.length + 1 != betCount) {
  //       return false;
  //     }
  //     if (!thisPtc.bettingHistory[betCount].amount) {
  //       continue;
  //     }
  //     if (
  //       bettingLeadPlayer.bettingHistory[betCount - 1].amount !=
  //       thisPtc.bettingHistory[betCount].amount
  //     ) {
  //       return false;
  //     }
  //   }
  // }
  // return true;
}

export function verifyActionOnPlayer(table: Table, playerID: number): void {
  if (!table.tableInProgress) {
    throw new Error("Cannot fold since table has not started yet");
  }

  if (!table.handInProgress) {
    throw new Error("Cannot fold since hand has not started yet");
  }

  if (table.option != playerID) {
    throw new Error("It is not this player's turn");
  }
}

export function notRunoutOrShowdownForCallCheckOrFold(table: Table) {
  if (
    table.bettingStage == BettingStage.RUNOUT ||
    table.bettingStage == BettingStage.SHOWDOWN
  ) {
    throw new Error(
      "Cannot fold since table is not at a valid betting stage to do so"
    );
  }
}

export function advanceAction(table: Table, playerID: number): void {
  // if (
  //   table.bettingStage == BettingStage.SHOWDOWN ||
  //   table.bettingStage == BettingStage.RUNOUT
  // ) {
  //   throw new Error(
  //     "Action cannot be advanced for these, these are handled on their own"
  //   );
  // }
  // // advance betting stage or pass the turn
  // if (isBettingActionDone(table)) {
  //   const alivePlayerCount = table.seatingArrangement.filter(
  //     (ptc) => ptc.stack > 0
  //   ).length;
  //   delete table.option;
  //   // if everyone fold then give pot to remaining player
  //   // TODO later
  //   console.log("give all pot to remaining player");
  //   // if everyone is all in make it runout
  //   if (
  //     table.seatingArrangement.filter((ptc) => {
  //       ptc.bettingHistory.filter(
  //         (pokerAction) =>
  //           pokerAction.action == BetActionType.ALL_IN_FORCED_BLIND
  //       ).length > 0;
  //     }).length >=
  //     alivePlayerCount - 1
  //   ) {
  //     table.bettingStage = BettingStage.RUNOUT;
  //     // TODO later
  //     console.log("runout the table function here (placeholder)");
  //     return;
  //   }
  //   // if preflop stage then make it flop stage and deal flop and set new option
  //   // if flop stage then make it turn stage and deal turn and set new option
  //   // if turn stage then make it river stage and deal river and set new option
  //   // if river stage then make it showdown stage and set new option
  //   if (table.bettingStage == BettingStage.PREFLOP) {
  //     table.bettingStage = BettingStage.FLOP;
  //     // TODO later
  //     console.log("dealUniqueFlop(table)");
  //     table.option =
  //       alivePlayerCount < 3 ? getOptionST(table) : getOptionAtOrAfterSB(table);
  //   } else if (table.bettingStage == BettingStage.FLOP) {
  //     table.bettingStage = BettingStage.TURN;
  //     // TODO later
  //     console.log("dealUniqueTurn(table)");
  //     table.option =
  //       alivePlayerCount < 3 ? getOptionST(table) : getOptionAtOrAfterSB(table);
  //   } else if (table.bettingStage == BettingStage.TURN) {
  //     table.bettingStage = BettingStage.RIVER;
  //     // TODO later
  //     console.log("dealUniqueRiver(table)");
  //     table.option =
  //       alivePlayerCount < 3 ? getOptionST(table) : getOptionAtOrAfterSB(table);
  //   } else if (table.bettingStage == BettingStage.RIVER) {
  //     table.bettingStage = BettingStage.SHOWDOWN;
  //     table.option = table.bettingLead;
  //   }
  // } else {
  //   table.option =
  //     table.seatingArrangement[
  //       findNthPosAfterAliveIndex(
  //         table.seatingArrangement.findIndex(
  //           (ptc) => ptc.playerID == table.option
  //         ),
  //         table.seatingArrangement,
  //         1
  //       )
  //     ].playerID;
  // }
}

// export function getOptionST(table: Table): number {
//   const st = table.seatingArrangement.find((ptc) =>
//     ptc.bettingHistory.find((bet) => bet.action == BetActionType.ST)
//   );
//   if (st) {
//     return st.playerID;
//   } else {
//     throw new Error("Data corrupted somewhere: straddle not found");
//   }
// }

// export function getOptionAtOrAfterSB(table: Table): number {
//   const sb = table.seatingArrangement.find((ptc) =>
//     ptc.bettingHistory.find((bet) => bet.action == BetActionType.SB)
//   );

//   if (sb) {
//     let count = 0;
//     let index = table.seatingArrangement.indexOf(sb);
//     while (count < table.seatingArrangement.length) {
//       if (
//         !table.seatingArrangement[index].bettingHistory.find(
//           (bet) =>
//             bet.action == BetActionType.FOLD ||
//             bet.action == BetActionType.ALL_IN_BET ||
//             bet.action == BetActionType.ALL_IN_CALL ||
//             bet.action == BetActionType.ALL_IN_FORCED_BLIND ||
//             bet.action == BetActionType.ALL_IN_RAISE
//         )
//       ) {
//         return table.seatingArrangement[index].playerID;
//       }

//       count++;
//       if (index == table.seatingArrangement.length - 1) {
//         index = 0;
//       } else {
//         index++;
//       }
//     }
//     throw new Error(
//       "Data corrupted somewhere: loop should have found a person at or after the small blind"
//     );
//   } else {
//     throw new Error("Data corrupted somewhere: small blind not found");
//   }
// }
