import { getPlayerID, getTableID } from "./context";
import db from "./db";
import {
  BetActionType,
  PlayerTableConnection,
  PokerVariants,
} from "./types/tables";
import {
  calculateNewElo,
  shuffleArray,
  calculateInitHandOption,
  dealUniqueHoleCards,
  calculateNewBlindMultiplier,
  findNthPosAfterAliveIndex,
  canCheck,
  isBettingActionDone,
} from "./utils";

// Resolvers define how to fetch the types defined in your schema.
const resolvers = {
  Query: {
    players: () => db.players,
    tables: () => db.tables,
    getPlayer: (_, { id }) => {
      return db.players.find((p) => p.id == id);
    },
    getTable: (_, { id }) => {
      return db.tables.find((t) => t.id == id);
    },
  },
  Mutation: {
    addPlayer: (_, args) => {
      let player = {
        ...args.player,
        id: getPlayerID(),
        elo: 1500,
      };
      db.players.push(player);
      return player;
    },
    // should be restricted to admin client
    deletePlayer: (_, { id }) => {
      const player = db.players.find((p) => p.id == id);
      if (!player) {
        return db.players;
      }
      if (player.table) {
        throw new Error(
          "Can't delete this player as it is connected to a table"
        );
      }
      db.players = db.players.filter((player) => player.id != id);
      return db.players;
    },
    updatePlayer: (_, args) => {
      if (!db.players.find((p) => p.id == args.id)) {
        throw new Error("Player not found");
      }
      db.players = db.players.map((player) => {
        if (player.id == args.id) {
          if (player.table) {
            throw new Error(
              "Can't update this player as it is connected to a table"
            );
          }
          return {
            ...player,
            ...args.edits,
          };
        }

        return player;
      });

      return db.players.find((p) => p.id == args.id);
    },
    // might be restricted to admin client
    addTable: (_, args) => {
      let table = {
        id: getTableID(),
        tableOverview: { ...args.tableOverview },
        currentSB: args.tableOverview.startingSB,
        currentBB: args.tableOverview.startingBB,
        currentST: args.tableOverview.startingST,
        hand: 0,
        seatingArrangement: [],
        elos: [],
      };
      db.tables.push(table);
      return table;
    },
    // should be restricted to admin client
    deleteTable: (_, { id }) => {
      const targetTable = db.tables.find((table) => table.id == id);
      if (!targetTable) {
        return db.tables;
      }
      if (targetTable.seatingArrangement.length > 0) {
        throw new Error(
          "Can't delete this table as players are connected to it"
        );
      }

      db.tables = db.tables.filter((table) => table.id != id);
      return db.tables;
    },
    // should be restricted to admin client
    updateTable: (_, args) => {
      if (!db.tables.find((t) => t.id == args.id)) {
        throw new Error("Table not found");
      }

      db.tables = db.tables.map((table) => {
        if (table.id == args.id) {
          if (table.seatingArrangement.length > 0) {
            throw new Error(
              "Can't update this table as players are connected to it"
            );
          }
          return {
            ...table,
            tableOverview: { ...table.tableOverview, ...args.edits },
          };
        }

        return table;
      });

      return db.tables.find((t) => t.id == args.id);
    },
    joinTable: (_, args) => {
      const playerID = args.playerID;
      const tableID = args.tableID;

      const player = db.players.find((p) => p.id == playerID);
      const table = db.tables.find((t) => t.id == tableID);

      if (!player || !table) {
        throw new Error("Player or table not present");
      }

      if (player.table) {
        throw new Error("Player already seated at a table");
      }

      if (table.seatingArrangement.length >= table.tableOverview.maxPlayers) {
        throw new Error("Table is full");
      }

      player.table = tableID;

      table.seatingArrangement.push({
        playerID: playerID,
        tableID: tableID,
        stack: table.tableOverview.startingStack,
      });

      table.elos.push(player.elo);

      return true;
    },
    leaveTableQueue: (_, args) => {
      const playerID = args.playerID;
      const { player, table } = getPlayerAndTableByPlayerID(playerID);

      if (table.hand > 0) {
        throw new Error("Can't leave table since game has already started!");
      }

      delete player.table;
      table.seatingArrangement = table.seatingArrangement.filter(
        (ptc) => ptc.playerID != playerID
      );

      const index = table.elos.indexOf(player.elo);
      if (index == -1) {
        throw new Error(
          "Data corrupted somewhere: elos list is not parallel to players' starting-elos"
        );
      }

      table.elos.splice(index, 1);

      return true;
    },
    leaveTable: (_, args) => {
      const playerID = args.playerID;
      const { player, table } = getPlayerAndTableByPlayerID(playerID);

      if (
        table.hand > 0 &&
        table.seatingArrangement.find((ptc) => ptc.playerID == playerID).stack >
          0
      ) {
        throw new Error(
          "Can't leave table since your stack is more than zero, however you can forfeit at anytime"
        );
      }

      delete player.table;
      table.seatingArrangement = table.seatingArrangement.filter(
        (ptc) => ptc.playerID != playerID
      );

      // NOTE when you leave your elo has already been updated, so you dont do so here

      return true;
    },
    startTable: (_, args) => {
      const tableID = args.tableID;
      const table = db.tables.find((t) => t.id == tableID);

      if (!table) {
        throw new Error("Table not present");
      }

      if (table.hand > 0) {
        throw new Error("Table already has game in progress");
      }

      if (table.seatingArrangement.length != table.tableOverview.maxPlayers) {
        throw new Error("Table is not full yet");
      }

      table.hand = 1;
      table.currentSB = table.tableOverview.startingSB;
      table.currentBB = table.tableOverview.startingBB;
      table.currentST = table.tableOverview.startingST;

      // defensive, not necessary
      delete table.flop;
      delete table.turn;
      delete table.river;
      table.seatingArrangement = shuffleArray(table.seatingArrangement);
      table.seatingArrangement = table.seatingArrangement.map((ptc) => {
        return {
          ...ptc,
          stack: table.tableOverview.startingStack,
          holeCards: null,
          bettingHistory: null,
        };
      });

      delete table.option;

      return true;
    },
    forfeitTable: (_, args) => {
      const playerID = args.playerID;
      const { player, table } = getPlayerAndTableByPlayerID(playerID);

      if (
        table.seatingArrangement.find((ptc) => ptc.playerID == playerID)
          .stack <= 0
      ) {
        throw new Error(
          "Cannot forfeit since player has already been eliminated, player can leave instead if they do not choose to watch"
        );
      }

      const zeroStackPlayerCount = table.seatingArrangement.filter(
        (ptc) => ptc.stack <= 0
      ).length;

      const playersAtTableCount = table.seatingArrangement.length;

      if (playersAtTableCount - zeroStackPlayerCount <= 1) {
        throw new Error(
          "Cannot forfeit since there are less than 2 players at the table"
        );
      }

      player.elo = calculateNewElo(
        player.elo,
        playersAtTableCount - zeroStackPlayerCount,
        table.elos
      );

      delete player.table;
      table.seatingArrangement = table.seatingArrangement.filter(
        (ptc) => ptc.playerID != playerID
      );

      return true;
    },
    startHand: (_, args) => {
      // get table by ID
      const tableID = args.tableID;
      const table = db.tables.find((t) => t.id == tableID);

      if (!table) {
        throw new Error("This table does not exist");
      }

      if (table.hand == 0) {
        throw new Error("Cannot start a hand since table has not started yet");
      }

      if (table.option) {
        throw new Error(
          "Cannot start a hand since there is a hand in progress"
        );
      }

      // defensive, not necessary
      // reset hole cards and betting history
      table.seatingArrangement = table.seatingArrangement.map((ptc) => {
        return {
          ...ptc,
          holeCards: [],
          bettingHistory: [],
        };
      });

      // modify blinds
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
      table.option = calculateInitHandOption(
        table.hand,
        table.seatingArrangement
      );

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
        // TODO extract common pattern to helper in utils,
        // especially once you figure out how call/raise/allins should work
        if (ptcBB.stack <= table.currentBB) {
          ptcBB.bettingHistory.push({
            action: BetActionType.ALL_IN_FORCED_BLIND,
            amount: ptcBB.stack,
          });
          ptcBB.stack = 0;
        } else {
          ptcBB.bettingHistory.push({
            action: BetActionType.BB,
            amount: table.currentBB,
          });
          ptcBB.stack -= table.currentBB;
        }
        // force ST bet
        if (ptcST.stack <= table.currentST) {
          ptcST.bettingHistory.push({
            action: BetActionType.ALL_IN_FORCED_BLIND,
            amount: ptcST.stack,
          });
          ptcST.stack = 0;
        } else {
          ptcST.bettingHistory.push({
            action: BetActionType.ST,
            amount: table.currentST,
          });
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
          ptcSB.bettingHistory.push({
            action: BetActionType.ALL_IN_FORCED_BLIND,
            amount: ptcSB.stack,
          });
          ptcSB.stack = 0;
        } else {
          ptcSB.bettingHistory.push({
            action: BetActionType.SB,
            amount: table.currentSB,
          });
          ptcSB.stack -= table.currentSB;
        }
        // force BB bet
        if (ptcBB.stack <= table.currentBB) {
          ptcBB.bettingHistory.push({
            action: BetActionType.ALL_IN_FORCED_BLIND,
            amount: ptcBB.stack,
          });
          ptcBB.stack = 0;
        } else {
          ptcBB.bettingHistory.push({
            action: BetActionType.BB,
            amount: table.currentBB,
          });
          ptcBB.stack -= table.currentBB;
        }
        // force ST bet
        if (ptcST.stack <= table.currentST) {
          ptcST.bettingHistory.push({
            action: BetActionType.ALL_IN_FORCED_BLIND,
            amount: ptcST.stack,
          });
          ptcST.stack = 0;
        } else {
          ptcST.bettingHistory.push({
            action: BetActionType.ST,
            amount: table.currentST,
          });
          ptcST.stack -= table.currentST;
        }

        // change option to UTG if necessary
        if (alivePlayerCount != 3) {
          table.option =
            table.seatingArrangement[
              findNthPosAfterAliveIndex(
                optionIndex,
                table.seatingArrangement,
                3
              )
            ].playerID;
        }
      }

      if (
        table.seatingArrangement.filter((ptc) => {
          ptc.bettingHistory.filter(
            (pokerAction) =>
              pokerAction.action == BetActionType.ALL_IN_FORCED_BLIND
          ).length > 0;
        }).length == alivePlayerCount
      ) {
        table.option == null;
      } else {
        let maxBetSeen = 0;
        let bettingLeadID = null;
        for (const ptc of table.seatingArrangement) {
          if (
            ptc.bettingHistory.length > 0 &&
            ptc.bettingHistory[0].amount > maxBetSeen
          ) {
            maxBetSeen = ptc.bettingHistory[0].amount;
            bettingLeadID = ptc.playerID;
          }
        }
        table.bettingLead = bettingLeadID;
      }
      return true;
    },
    fold: (_, args) => {
      const playerID = args.playerID;
      const { player, table } = getPlayerAndTableByPlayerID(playerID);

      if (table.option != playerID) {
        throw new Error("It is not this player's turn");
      }

      table.seatingArrangement
        .find((ptc) => ptc.playerID == playerID)
        .bettingHistory.push({ action: BetActionType.FOLD });

      if (isBettingActionDone(table)) {
        table.option = null;
      } else {
        table.option =
          table.seatingArrangement[
            findNthPosAfterAliveIndex(
              table.seatingArrangement.findIndex(
                (ptc) => ptc.playerID == table.option
              ),
              table.seatingArrangement,
              1
            )
          ].playerID;
      }
      return true;
    },
    check: (_, args) => {
      const playerID = args.playerID;
      const { player, table } = getPlayerAndTableByPlayerID(playerID);

      if (table.option != playerID) {
        throw new Error("It is not this player's turn");
      }

      if (canCheck(playerID, table.seatingArrangement)) {
        table.seatingArrangement
          .find((ptc) => ptc.playerID == playerID)
          .bettingHistory.push({ action: BetActionType.CHECK });
      } else {
        throw new Error(
          "You cannot check as you are facing a bet bigger than your current bet"
        );
      }

      if (isBettingActionDone(table)) {
        table.option = null;
      } else {
        table.seatingArrangement[
          findNthPosAfterAliveIndex(
            table.seatingArrangement.findIndex(
              (ptc) => ptc.playerID == table.option
            ),
            table.seatingArrangement,
            1
          )
        ].playerID;
      }

      return true;
    },
  },
  Player: {
    table: (parent, args, context, info) => {
      return db.tables.find((table) => table.id == parent.table);
    },
  },
  Table: {
    seatingArrangement: (parent, args, context, info) => {
      const ptc = db.tables.find(
        (table) => table.id == parent.id
      ).seatingArrangement;
      return ptc.map((ptc) => {
        return {
          player: db.players.find((player) => ptc.playerID == player.id),
          stack: ptc.stack,
          holeCards: ptc.holeCards,
          bettingHistory: ptc.bettingHistory,
        };
      });
    },
    option: (parent, args, context, info) => {
      return db.players.find((p) => p.id == parent.option);
    },
    bettingLead: (parent, args, context, info) => {
      return db.players.find((p) => p.id == parent.bettingLead);
    },
  },
};

// Returns the reference to the player and corresponding table they are sitting at,
// throwing if the player doesnt exist, or if the player is not sitting at a table,
// or in the rare case that data may be corrupted: the table does not contain the playerID
function getPlayerAndTableByPlayerID(playerID: number) {
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

export default resolvers;
