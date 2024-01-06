import { describe, expect, test, beforeEach } from "@jest/globals";
import {NLHTable} from '../src/types/tables';
import {HumanPlayer} from '../src/types/players';

  let table;
  let player1;
  let player2;
  let player3;
  let player4;

  beforeEach(() => {
    table = new NLHTable("Table 1", 1000, 1, 2, 5, 10, 4, 50, 2);
    player1 = new HumanPlayer("Bebe", 0);
    player2 = new HumanPlayer("Pepe", 100);
    player3 = new HumanPlayer("Bobby", 500);
    player4 = new HumanPlayer("Jimmy", 100);
  });



// startTable tests
describe("startTable tests", () => {
  test("Table throws exceptions", () => {
    player1.joinTable(table);
    player2.joinTable(table);
    expect(() => table.startTable()).toThrow();

    player3.joinTable(table);
    player4.joinTable(table);
    table.startTable();
    expect(() => table.startTable()).toThrow();
  });
});

// startTable tests
describe("startHand tests", () => {
  test("startHand throws exceptions", () => {
    const newTable = new NLHTable("Table 1", 1000, 1, 2, 5, 10, 4, 50, 2);
    player1.joinTable(newTable);
    player2.joinTable(newTable);
    player3.joinTable(newTable);
    player4.joinTable(newTable);
  
    //throws if game has not started
    expect(() => newTable.startHand()).toThrow();
    newTable.startTable();
    newTable.startHand();

    newTable.aliveSeatingArrangement.forEach((player)=>expect(player.holeCards && player.holeCards.length === 2))

  });
});
