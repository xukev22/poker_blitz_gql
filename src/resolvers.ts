import { getPlayerID, getTableID } from "./context";
import db from "./db";
import { shuffleArray } from "./utils";

// Resolvers define how to fetch the types defined in your schema.
const resolvers = {
  Query: {
    players: () => db.players,
    tables: () => db.tables,
    getPlayer: (_, { id }) => {
      return db.players.find((p) => p.id == id);
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
      if (player.table) {
        throw new Error(
          "Can't delete this player as it is connected to a table"
        );
      }
      db.players = db.players.filter((player) => player.id != id);
      return db.players;
    },
    updatePlayer: (_, args) => {
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
      db.tables = db.tables.map((table) => {
        if (table.id == args.id) {
          if (table.seatingArrangement.length > 0) {
            throw new Error(
              "Can't update this table as players are connected to it"
            );
          }
          return {
            ...table,
            ...args.edits,
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

      return true;
    },
    leaveTable: (_, args) => {
      const playerID = args.playerID;
      const player = db.players.find((player) => player.id == playerID);

      if (!player) {
        throw new Error("Player not found");
      }

      if (!player.table) {
        throw new Error("There is no table to leave");
      }

      const table = db.tables.find((table) => table.id == player.table);

      if (!table) {
        throw new Error(
          "Data corrupted somewhere: this player has a reference to a nonexistent table"
        );
      }

      if (table.hand > 0) {
        throw new Error("Can't leave table since game has already started!");
      }

      delete player.table;
      table.seatingArrangement = table.seatingArrangement.filter(
        (ptc) => ptc.playerID != playerID
      );

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

      table.option = table.seatingArrangement[0].playerID;

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
  },
};

export default resolvers;
