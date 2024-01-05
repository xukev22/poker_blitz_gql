// A player has a uniquely identifying username,
// an elo, and a tableID that they are seated at,
// null representing they are not seated at a table currently

import { calculateNewElo, getCurrentBettingHistory } from "../utils";
import { Card, Check, Fold, IPokerTable } from "./tables";

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
    const bettingHistory = getCurrentBettingHistory(this.table);
    if (!(bettingHistory[bettingHistory.length - 1] instanceof Check)) {
      bettingHistory.push(new Fold(this));
    } else {
      throw new Error("Cannot fold");
    }
    if (this.table.isBettingActionDone()) {
      this.table.advanceBettingAction();
    } else {
      let currNode = this.table.aliveSeatingArrangement.find(this).next;
      this.table.aliveSeatingArrangement.forEach((player) => {
        if (currNode.data.stack > 0) {
          this.table.option = currNode.data;
          return;
        }
      });
      throw new Error(
        "Data corruption: could not find next player to pass turn"
      );
    }
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
