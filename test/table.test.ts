import { describe, expect, test, beforeEach } from "@jest/globals";
import {NLHTable} from '../src/types/tables';
import {HumanPlayer, IPlayer} from '../src/types/players';

  let table;
  let player1;
  let player2;
  let player3;
  let player4;

  //creates table, players, and players join table
  beforeEach(() => {
    //handsUntilBlindsIncrease: 3
    //blindIncreaseRatio: 2
    table = new NLHTable("Table 1", 1000, 1, 2, 5, 10, 4, 3, 2);
    player1 = new HumanPlayer("Bebe", 0);
    player2 = new HumanPlayer("Pepe", 100);
    player3 = new HumanPlayer("Bobby", 500);
    player4 = new HumanPlayer("Jimmy", 100);

    player1.joinTable(table);
    player2.joinTable(table);
    //not enough players
    expect(() => table.startTable()).toThrow();
    player3.joinTable(table);
    player4.joinTable(table);

  });



// startTable baseline tests
describe("startTable tests", () => {
  test("Table throws exceptions", () => {

    table.startTable();
    table.aliveSeatingArrangement.forEach((player)=>expect(player.holeCards).toBe(undefined));
    expect(table.tableInProgress).toBe(true);
    expect(table.hand).toBe(0);
    expect(table.option).toBe(undefined);
    
    //startTable again
    expect(() => table.startTable()).toThrow();
  });
});

// startHand baseline tests
describe("startHand tests", () => {
  test("startHand throws exceptions", () => {
    //throws if game has not started
    expect(() => table.startHand()).toThrow();
    table.startTable();
    expect(table.hand).toBe(0);
    table.startHand();
    expect(table.hand).toBe(1);
    expect(table.handInProgress).toBe(true);

    //every player gets 2 cards
    table.aliveSeatingArrangement.forEach((player)=>expect(player.holeCards && player.holeCards.length === 2))
    //check unique


    //start hand again throws
    expect(() => table.startHand()).toThrow();
  });
});


//blinds position and move (heads up or not) and increase
//NOTE: node of list could always be small blind
describe("blind tests", () => {
  test("startHand throws exceptions", () => {
    table.startTable();
    table.startHand();
    expect(table.hand).toBe(1);
    expect(table.handInProgress).toBe(true);

    let expectedSmallBlind: HumanPlayer = table.aliveSeatingArrangement[0];

    
  })
})

//blinds pushed to the list

//blinds forced all ins

//hands increase, hand progress

