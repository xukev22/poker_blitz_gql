import { describe, expect, test, beforeEach } from "@jest/globals";
import { IPokerTable, NLHTable } from "../src/types/tables";
import { HumanPlayer, IPlayer } from "../src/types/players";

let table: IPokerTable;
let player1: IPlayer;
let player2: IPlayer;
let player3: IPlayer;
let player4: IPlayer;
let player5: IPlayer;

beforeEach(() => {
  table = new NLHTable("Gang On Em", 100, 1, 2, 5, 10, 4);
  player1 = new HumanPlayer("Player 1", 1100);
  player2 = new HumanPlayer("Player 2", 1200);
  player3 = new HumanPlayer("Player 3", 1200);
  player4 = new HumanPlayer("Player 4", 1400);
  player5 = new HumanPlayer("Player 5", 1500);
});

describe("joinTable", () => {
  test("exceptions", () => {
    table.tableInProgress = true;
    expect(() => player1.joinTable(table)).toThrow();
    table.tableInProgress = false;
    player1.table = table;
    expect(() => player1.joinTable(table)).toThrow();
    delete player1.table;
    player1.joinTable(table);
    player2.joinTable(table);
    player3.joinTable(table);
    player4.joinTable(table);
    expect(() => player5.joinTable(table)).toThrow();
  });

  test("observe actual join behavior", () => {
    expect(player1.table).toBe(undefined);
    expect(table.aliveSeatingArrangement.length()).toBe(0);
    expect(table.startingElos).toStrictEqual([]);
    player1.joinTable(table);
    expect(player1.table).toBe(table);
    expect(table.aliveSeatingArrangement.length()).toBe(1);
    expect(table.startingElos).toStrictEqual([1100]);
  });
});
