import { describe, expect, test, beforeEach } from "@jest/globals";
import { IPokerTable, NLHTable } from "../src/types/tables";
import { HumanPlayer, IPlayer } from "../src/types/players";

let table: IPokerTable;
let player1: IPlayer;
let player2: IPlayer;
let player3: IPlayer;
let player4: IPlayer;
let player5: IPlayer;

let tableStarted: IPokerTable;
let player10: IPlayer;
let player20: IPlayer;
let player30: IPlayer;
let player40: IPlayer;
let player50: IPlayer;
let player60: IPlayer;

beforeEach(() => {
  table = new NLHTable("Gang On Em", 100, 1, 2, 5, 10, 4);
  player1 = new HumanPlayer("Player 1", 1100);
  player2 = new HumanPlayer("Player 2", 1200);
  player3 = new HumanPlayer("Player 3", 1200);
  player4 = new HumanPlayer("Player 4", 1400);
  player5 = new HumanPlayer("Player 5", 1500);

  tableStarted = new NLHTable("6 max table!", 100, 1, 2, 5, 10, 6, 5, 2);
});

describe("joinTable", () => {
  test("exceptions", () => {
    // table in progress
    table.tableInProgress = true;
    expect(() => player1.joinTable(table)).toThrow();
    table.tableInProgress = false;
    // already at table
    player1.table = table;
    expect(() => player1.joinTable(table)).toThrow();
    delete player1.table;
    // full table
    player1.joinTable(table);
    player2.joinTable(table);
    player3.joinTable(table);
    player4.joinTable(table);
    expect(() => player5.joinTable(table)).toThrow();
  });

  test("observe actual join behavior", () => {
    // before
    expect(player1.table).toBe(undefined);
    expect(table.aliveSeatingArrangement.length()).toBe(0);
    expect(table.startingElos).toStrictEqual([]);
    //join table
    player1.joinTable(table);
    // after
    expect(player1.table).toBe(table);
    expect(table.aliveSeatingArrangement.length()).toBe(1);
    expect(table.startingElos).toStrictEqual([1100]);
  });
});

describe("leaveTableQueue", () => {
  test("exceptions", () => {
    // not at table
    expect(() => player1.leaveTableQueue()).toThrow();
    // table already started
    table.tableInProgress = true;
    expect(() => player1.leaveTableQueue()).toThrow();
    table.tableInProgress = false;
    delete player1.table;
  });
  test("observe actual behaviors", () => {
    player1.joinTable(table);
    player2.joinTable(table);
    player3.joinTable(table);

    // before
    expect(table.aliveSeatingArrangement.length()).toBe(3);
    expect(table.startingElos).toStrictEqual([1100, 1200, 1200]);
    expect(player2.table).toBe(table);

    // p2 leaves queue
    player2.leaveTableQueue();

    // after
    expect(table.aliveSeatingArrangement.length()).toBe(2);
    expect(table.startingElos).toStrictEqual([1100, 1200]);
    expect(player2.table).toBe(undefined);

    // p1 leaves queue
    player1.leaveTableQueue();

    // after
    expect(table.aliveSeatingArrangement.length()).toBe(1);
    expect(table.startingElos).toStrictEqual([1200]);
    expect(player1.table).toBe(undefined);

    // p3 leaves queue
    player3.leaveTableQueue();

    // after
    expect(table.aliveSeatingArrangement.length()).toBe(0);
    expect(table.startingElos).toStrictEqual([]);
    expect(player3.table).toBe(undefined);
  });
});

describe("exitTable", () => {
  test("exceptions", () => {
    // player is not at a table to exit
    expect(() => player1.exitTable()).toThrow();
    player1.joinTable(table);
    // player is at table but cannot exit since it hasn't started
    expect(() => player1.exitTable()).toThrow();
    player1.leaveTableQueue();
    player1.joinTable(table);
    player2.joinTable(table);
    player3.joinTable(table);
    player4.joinTable(table);
    table.startTable();
    table.startHand();
    // hand in progress cant exit
    expect(() => player1.exitTable()).toThrow();
  });
  test("non forfeit case", () => {
    player1.joinTable(table);
    player2.joinTable(table);
    player3.joinTable(table);
    player4.joinTable(table);
    table.startTable();
    player4.stack = 0;

    // before
    expect(table.aliveSeatingArrangement.length()).toBe(4);
    expect(player4.table).toBe(table);

    // exit table
    player4.exitTable();

    // after
    expect(table.aliveSeatingArrangement.length()).toBe(3);
    expect(player4.table).toBe(undefined);
  });
  test("forfeit case", () => {
    player1.joinTable(table);
    player2.joinTable(table);
    player3.joinTable(table);
    player4.joinTable(table);
    table.startTable();

    // before
    expect(table.aliveSeatingArrangement.length()).toBe(4);
    expect(player4.table).toBe(table);

    // exit table
    player4.exitTable();

    // after
    expect(table.aliveSeatingArrangement.length()).toBe(3);
    expect(player4.table).toBe(undefined);
    expect(player4.elo != 1400);
  });
});

describe("verifyAction", () => {
  test("fold", () => {
    // not at table
    expect(() => player1.fold()).toThrow();
    player1.joinTable(table);
    player2.joinTable(table);

    // at table, but table not started
    expect(() => player1.fold()).toThrow();

    // at table and table started, but hand not started
    table.tableInProgress = true;
    expect(() => player1.fold()).toThrow();

    table.handInProgress = true;
    table.option = player2;
    // at table and hand/table started, option not p1
    expect(() => player1.fold()).toThrow();
  });
  test("check", () => {
    // not at table
    expect(() => player1.check()).toThrow();
    player1.joinTable(table);
    player2.joinTable(table);

    // at table, but table not started
    expect(() => player1.check()).toThrow();

    // at table and table started, but hand not started
    table.tableInProgress = true;
    expect(() => player1.check()).toThrow();

    table.handInProgress = true;
    table.option = player2;
    // at table and hand/table started, option not p1
    expect(() => player1.check()).toThrow();
  });
  test("bet", () => {
    // not at table
    expect(() => player1.bet(5)).toThrow();
    player1.joinTable(table);
    player2.joinTable(table);

    // at table, but table not started
    expect(() => player1.bet(5)).toThrow();

    // at table and table started, but hand not started
    table.tableInProgress = true;
    expect(() => player1.bet(5)).toThrow();

    table.handInProgress = true;
    table.option = player2;
    // at table and hand/table started, option not p1
    expect(() => player1.bet(5)).toThrow();
  });
  test("call", () => {
    // not at table
    expect(() => player1.call()).toThrow();
    player1.joinTable(table);
    player2.joinTable(table);

    // at table, but table not started
    expect(() => player1.call()).toThrow();

    // at table and table started, but hand not started
    table.tableInProgress = true;
    expect(() => player1.call()).toThrow();

    table.handInProgress = true;
    table.option = player2;
    // at table and hand/table started, option not p1
    expect(() => player1.call()).toThrow();
  });
  test("raise", () => {
    // not at table
    expect(() => player1.raise(5)).toThrow();
    player1.joinTable(table);
    player2.joinTable(table);

    // at table, but table not started
    expect(() => player1.raise(5)).toThrow();

    // at table and table started, but hand not started
    table.tableInProgress = true;
    expect(() => player1.raise(5)).toThrow();

    table.handInProgress = true;
    table.option = player2;
    // at table and hand/table started, option not p1
    expect(() => player1.raise(5)).toThrow();
  });
});

describe("fold", () => {});
