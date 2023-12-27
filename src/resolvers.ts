import { getPlayerID, getTableID } from "./context";
import db from "./db";
import { BetActionType } from "./types/tables";
import {
  calculateNewElo,
  canCheck,
  initTableVars,
  initHandVars,
  verifyActionOnPlayer,
  advanceAction,
  getPlayerAndTableByPlayerID,
  notRunoutOrShowdownForCallCheckOrFold,
  canCall,
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
        tableInProgress: false,
        handInProgress: false,
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

      if (table.tableInProgress) {
        throw new Error("Table has already started");
      }

      player.table = tableID;

      table.seatingArrangement.push({
        playerID: playerID,
        tableID: tableID,
        stack: table.tableOverview.startingStack,
      });

      table.elos.push(player.elo);

      // returns whether table should be started
      return table.tableOverview.maxPlayers == table.seatingArrangement.length;
    },
    leaveTableQueue: (_, args) => {
      const playerID = args.playerID;
      const { player, table } = getPlayerAndTableByPlayerID(playerID);

      if (table.tableInProgress) {
        throw new Error(
          "Can't leave table queue since game has already started!"
        );
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

      if (!table.tableInProgress) {
        throw new Error(
          "Can't leave this table since the table hasn't started yet"
        );
      }

      if (table.handInProgress) {
        throw new Error("Can't leave table since hand is not over yet");
      }

      if (
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

      if (table.tableInProgress) {
        throw new Error("Table already has game in progress");
      }

      if (table.seatingArrangement.length != table.tableOverview.maxPlayers) {
        throw new Error("Table is not full yet");
      }

      initTableVars(table);

      return true;
    },
    forfeitTable: (_, args) => {
      const playerID = args.playerID;
      const { player, table } = getPlayerAndTableByPlayerID(playerID);

      if (!table.tableInProgress) {
        throw new Error("Cannot forfeit table since table has not started yet");
      }
      if (table.handInProgress) {
        throw new Error("Can't leave table since hand is not over yet");
      }

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

      if (!table.tableInProgress) {
        throw new Error("Cannot start a hand since table has not started yet");
      }

      if (table.handInProgress) {
        throw new Error(
          "Cannot start a hand since there is already a hand in progress"
        );
      }

      initHandVars(table);

      return true;
    },
    fold: (_, args) => {
      const playerID = args.playerID;
      const { player, table } = getPlayerAndTableByPlayerID(playerID);

      verifyActionOnPlayer(table, playerID);

      notRunoutOrShowdownForCallCheckOrFold(table);

      // fold
      table.bettingLog.get(playerID).push({
        action: BetActionType.FOLD,
        stage: table.bettingStage,
      });
      const res = table.pot.delete(playerID);
      if (!res) {
        throw new Error(
          "Data corrupted somewhere, could not fold player out of the pot"
        );
      }

      advanceAction(table, playerID);

      return true;
    },
    check: (_, args) => {
      const playerID = args.playerID;
      const { player, table } = getPlayerAndTableByPlayerID(playerID);

      verifyActionOnPlayer(table, playerID);

      notRunoutOrShowdownForCallCheckOrFold(table);

      if (canCheck(playerID, table)) {
        table.bettingLog.get(playerID).push({
          action: BetActionType.CHECK,
          stage: table.bettingStage,
        });
        const playerPot = table.pot.get(playerID);
        playerPot.action = BetActionType.CHECK;
        playerPot.stage = table.bettingStage;
      } else {
        throw new Error("You cannot check in this situation");
      }

      advanceAction(table, playerID);

      return true;
    },
    call: (_, args) => {
      const playerID = args.playerID;
      const { player, table } = getPlayerAndTableByPlayerID(playerID);

      verifyActionOnPlayer(table, playerID);

      notRunoutOrShowdownForCallCheckOrFold(table);

      if (canCall(playerID, table)) {
        const bettingLeadAmount = table.pot.get(table.bettingLead).amount;

        const playerTotalBetsAmount = table.pot.get(playerID).amount;
        const amountToCall = bettingLeadAmount - playerTotalBetsAmount;

        const playerAtTable = table.seatingArrangement.find(
          (ptc) => ptc.playerID == playerID
        );
        if (amountToCall < playerAtTable.stack) {
          playerAtTable.stack -= amountToCall;
          table.potSize += amountToCall;
          table.bettingLog.get(playerID).push({
            action: BetActionType.CALL,
            stage: table.bettingStage,
            amount: bettingLeadAmount,
          });
          const playerPot = table.pot.get(playerID);
          playerPot.action = BetActionType.CALL;
          playerPot.amount = bettingLeadAmount;
          playerPot.stage = table.bettingStage;
        } else {
          table.potSize += playerAtTable.stack;
          table.bettingLog.get(playerID).push({
            action: BetActionType.ALL_IN_CALL,
            stage: table.bettingStage,
            amount: playerAtTable.stack,
          });
          const playerPot = table.pot.get(playerID);
          playerPot.action = BetActionType.ALL_IN_CALL;
          playerPot.amount = playerAtTable.stack + playerTotalBetsAmount;
          playerPot.stage = table.bettingStage;
          playerAtTable.stack = 0;
        }
      } else {
        throw new Error("You cannot call in this situation");
      }

      advanceAction(table, playerID);

      return true;
    },
  },
  Player: {
    table: (parent, args, context, info) => {
      return db.tables.find((table) => table.id == parent.table);
    },
  },
  Table: {
    pot: (parent, args, context, info) => {
      const table = db.tables.find((table) => table.id == parent.id);
      return Array.from(table.pot).map(([key, value]) => ({
        key,
        value,
      }));
    },
    bettingLog: (parent, args, context, info) => {
      const table = db.tables.find((table) => table.id == parent.id);
      return Array.from(table.bettingLog).map(([key, value]) => ({
        key,
        value,
      }));
    },
    seatingArrangement: (parent, args, context, info) => {
      const ptc = db.tables.find(
        (table) => table.id == parent.id
      ).seatingArrangement;
      return ptc.map((ptc) => {
        return {
          player: db.players.find((player) => ptc.playerID == player.id),
          stack: ptc.stack,
          holeCards: ptc.holeCards,
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

export default resolvers;
