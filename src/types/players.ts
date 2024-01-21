// A player has a uniquely identifying username,
// an elo, and a tableID that they are seated at,
// null representing they are not seated at a table currently

import { calculateNewElo, getCurrentBettingHistory } from "../utils";
import {
  BettingStage,
  Blind,
  Call,
  Card,
  Check,
  Fold,
  Bet,
  IPokerTable,
  Raise,
} from "./tables";

// ALL numeric values are integers
export interface IPlayer {
  username: string;
  elo: number;
  table?: IPokerTable;
  holeCards?: Card[];
  stack?: number;
  joinTable(table: IPokerTable): void;
  leaveTableQueue(): void;
  exitTable(): void;
  fold(): void;
  check(): void;
  call(): void;
  bet(amount: number): void;
  raise(leadRaisedTo: number): void;
}

// An abstract class for common behavior between different types of players
abstract class APlayer implements IPlayer {
  username: string;
  elo: number;
  table?: IPokerTable;
  holeCards?: Card[];
  stack?: number;

  // create a player with a starting elo and username
  constructor(username: string, elo: number) {
    this.username = username;
    this.elo = elo;
  }

  // Attempt to join a poker table
  joinTable(table: IPokerTable): void {
    if (table.tableInProgress) {
      throw new Error("Can not join table since table is in progress");
    }

    if (this.table) {
      throw new Error(
        "Player already seated at table so they cannot join another table"
      );
    }

    if (table.maxPlayers === table.aliveSeatingArrangement.length()) {
      throw new Error("Table is already full");
    }

    this.table = table;
    table.aliveSeatingArrangement.append(this);
    table.startingElos.push(this.elo);
  }

  // Attempt to leave the table queue
  leaveTableQueue(): void {
    if (!this.table) {
      throw new Error("Player is not at a table queue to leave");
    }
    if (this.table.tableInProgress) {
      throw new Error(
        "Cannot leave table queue since game has already started"
      );
    }
    this.table.aliveSeatingArrangement.remove(this);
    const eloToBeRemovedIndex = this.table.startingElos.indexOf(this.elo);
    if (eloToBeRemovedIndex == -1) {
      throw new Error("Data corruption: player's elo was not found in list");
    }
    this.table.startingElos.splice(eloToBeRemovedIndex, 1);
    delete this.table;
  }

  // Attempt to exit the table (forfeit or leave)
  exitTable(): void {
    if (!this.table) {
      throw new Error("Player is not at a table to exit");
    }
    if (!this.table.tableInProgress) {
      throw new Error("Cannot exit table because table has not started");
    }
    if (this.table.handInProgress) {
      throw new Error("Cannot exit table mid-hand, wait for hand to finish");
    }

    const playersAtTableCount = this.table.aliveSeatingArrangement.length();
    if (playersAtTableCount <= 1) {
      throw new Error(
        "Cannot exit since there are less than 2 players at the table, you will be removed automatically"
      );
    }

    // forfeit case
    if (this.stack > 0) {
      this.elo = calculateNewElo(
        this.elo,
        playersAtTableCount,
        this.table.startingElos
      );
    }
    this.table.aliveSeatingArrangement.remove(this);
    delete this.table;
  }
  // Fold during a poker hand
  fold(): void {
    this.verifyOption();
    const bettingHistory = getCurrentBettingHistory(this.table);
    if (
      bettingHistory.length > 0 &&
      !(bettingHistory[bettingHistory.length - 1] instanceof Check)
    ) {
      bettingHistory.push(new Fold(this));
    } else {
      throw new Error("Cannot fold, should just check");
    }
    // this.progressTableModel();
  }
  // private progressTableModel() {
  //   if (this.table.isBettingActionDone()) {
  //     this.table.advanceBettingAction();
  //   } else {
  //     let currNode = this.table.aliveSeatingArrangement.find(this).next;
  //     for (let i = 0; i < this.table.aliveSeatingArrangement.length(); i++) {
  //       const player = currNode.data;
  //       const wholeBettingHistory = this.table.preFlopBettingHistory
  //         .concat(
  //           this.table.flopBettingHistory ? this.table.flopBettingHistory : []
  //         )
  //         .concat(
  //           this.table.turnBettingHistory ? this.table.turnBettingHistory : []
  //         )
  //         .concat(
  //           this.table.riverBettingHistory ? this.table.riverBettingHistory : []
  //         );
  //       let shouldSkip = false;
  //       wholeBettingHistory.forEach((betAction) => {
  //         if (betAction.player === player) {
  //           if (betAction.allIn || betAction instanceof Fold) {
  //             shouldSkip = true;
  //           }
  //         }
  //       });

  //       if (!shouldSkip) {
  //         this.table.option = currNode.data;
  //       } else {
  //         currNode = currNode.next;
  //       }
  //     }
  //     throw new Error(
  //       "Data corruption: could not find next player to pass turn"
  //     );
  //   }
  // }

  private verifyOption() {
    if (!this.table) {
      throw new Error("Player is not at a table to fold");
    }
    if (!this.table.tableInProgress) {
      throw new Error("Table has not started yet");
    }
    if (!this.table.handInProgress) {
      throw new Error("Table hand has not started yet");
    }
    if (this.table.option !== this) {
      throw new Error("It is not this player's turn");
    }
  }

  check(): void {
    this.verifyOption();
    const bettingHistory = getCurrentBettingHistory(this.table);
    if (bettingHistory.length == 0) {
      bettingHistory.push(new Check(this));
    } else {
      const prevBet = bettingHistory[bettingHistory.length - 1];
      if (prevBet instanceof Check) {
        bettingHistory.push(new Check(this));
      } else if (prevBet instanceof Call) {
        if (BettingStage.PREFLOP) {
          // find the straddle player
          const blindsPreflop = this.table.preFlopBettingHistory.filter(
            (betAction) => betAction instanceof Blind
          );
          const stPlayerAmount =
            blindsPreflop[blindsPreflop.length - 1].getAmount();
          if (prevBet.amount <= stPlayerAmount) {
            bettingHistory.push(new Check(this));
          } else {
            throw new Error(
              "Cannot check since the previous bet was a call greater than your straddle blind amount preflop"
            );
          }
        } else {
          throw new Error(
            "Cannot check since the previous bet was a call and we are no longer preflop"
          );
        }
      } else {
        throw new Error(
          "Cannot check since you can only possibly check after a Call, empty betting history, or Check"
        );
      }
    }
    // this.progressTableModel();
  }
  call(): void {
    this.verifyOption();
    const bettingHistory = getCurrentBettingHistory(this.table);
    if (bettingHistory.length == 0) {
      throw new Error("Cannot call, should just check");
    } else {
      const playerInvestments = new Map<IPlayer, number>();
      bettingHistory.forEach((betAction) => {
        if (playerInvestments.get(betAction.player)) {
          playerInvestments.set(
            betAction.player,
            playerInvestments.get(betAction.player) + betAction.getAmount()
          );
        } else {
          playerInvestments.set(betAction.player, betAction.getAmount());
        }
      });
      let bettingLeadInChips = 0;
      // find betting lead
      playerInvestments.forEach((chips) => {
        if (chips > bettingLeadInChips) {
          bettingLeadInChips = chips;
        }
      });
      let chipsInvestedAlready = 0;
      // find chips invested before calling
      bettingHistory.forEach((betAction) => {
        if (betAction.player === this) {
          chipsInvestedAlready += betAction.getAmount();
        }
      });

      const amountToCall = bettingLeadInChips - chipsInvestedAlready;
      if (amountToCall <= 0) {
        throw new Error("Data corruption, amount to call should be positive");
      }

      bettingHistory.push(
        new Call(this, amountToCall, amountToCall >= this.stack)
      );

      this.stack -= amountToCall;
      if (this.stack < 0) {
        this.stack = 0;
      }
    }
    // this.progressTableModel();
  }
  bet(amount: number): void {
    this.verifyOption();
    if (amount <= 0) {
      throw new Error("Amount must be positive");
    }
    if (amount < this.table.currentST) {
      throw new Error("Amount must be at least the straddle blind amount");
    }
    if (amount > this.stack) {
      throw new Error("You do not have this many chips to bet out");
    }
    const bettingHistory = getCurrentBettingHistory(this.table);
    if (bettingHistory.length == 0) {
      bettingHistory.push(new Bet(this, amount, amount == this.stack));
      this.stack -= amount;
    } else {
      let existingBetInstance = false;
      bettingHistory.forEach((betAction) => {
        if (betAction instanceof Bet) {
          existingBetInstance = true;
        }
      });
      if (existingBetInstance) {
        throw new Error(
          "Cannot bet out since there is already a bet, should raise, call, or fold instead"
        );
      } else {
        bettingHistory.push(new Bet(this, amount, amount == this.stack));
        this.stack -= amount;
      }
    }
    // this.progressTableModel();
  }
  raise(leadRaisedTo: number): void {
    this.verifyOption();
    const bettingHistory = getCurrentBettingHistory(this.table);
    const playerInvestments = new Map<IPlayer, number>();
    let bettingLeadInChips = 0;
    // find betting lead
    playerInvestments.forEach((chips) => {
      if (chips > bettingLeadInChips) {
        bettingLeadInChips = chips;
      }
    });
    let chipsInvestedAlready = 0;
    // find chips invested before calling
    bettingHistory.forEach((betAction) => {
      if (betAction.player === this) {
        chipsInvestedAlready += betAction.getAmount();
      }
    });
    if (leadRaisedTo <= bettingLeadInChips) {
      throw new Error("New betting lead must surpass the current betting lead");
    }
    const amountToAdd = leadRaisedTo - chipsInvestedAlready;
    if (amountToAdd > this.stack) {
      throw new Error("You do not have this many chips to raise");
    }

    let existingBetOrBlindInstance = false;
    bettingHistory.forEach((betAction) => {
      if (betAction instanceof Bet || betAction instanceof Blind) {
        existingBetOrBlindInstance = true;
      }
    });

    if (existingBetOrBlindInstance) {
      bettingHistory.push(
        new Raise(this, amountToAdd, amountToAdd == this.stack)
      );
      this.stack -= amountToAdd;
    } else {
      throw new Error("Nothing to raise since there is no initial bet out");
    }

    // this.progressTableModel();
  }
}

// A HumanPlayer implementation
export class HumanPlayer extends APlayer {
  constructor(username: string, elo: number) {
    super(username, elo);
  }
}

// An AIPlayer implementation
class AIPlayer extends APlayer {
  playstyle: AIPlaystyleType;

  constructor(username: string, elo: number, playstyle: AIPlaystyleType) {
    super(username, elo);
    this.playstyle = playstyle;
  }
}

// TODO later with string conversion for GQL
enum AIPlaystyleType {}
