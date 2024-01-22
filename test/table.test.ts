import { describe, expect, test, beforeEach } from "@jest/globals";
import {IPokerTable, NLHTable} from '../src/types/tables';
import {HumanPlayer, IPlayer} from '../src/types/players';
import { Console } from "console";

  let table: IPokerTable;
  let player1: IPlayer;
  let player2: IPlayer;
  let player3: IPlayer;
  let player4: IPlayer;

  //creates table, players, and players join table
  beforeEach(() => {
    //blinds: 1, 2, 5
    //handsUntilBlindsIncrease: 2
    //blindIncreaseRatio: 2
    table = new NLHTable("Table 1", 1000, 1, 2, 5, 10, 4, 2, 2);
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
    //check blind size
    expect(table.currentSB).toBe(1);
    expect(table.currentBB).toBe(2);
    expect(table.currentST).toBe(5);
    //check betting history
    if (table.preFlopBettingHistory != undefined) {
      expect(table.preFlopBettingHistory[0].getAmount()).toBe(1);
      expect(table.preFlopBettingHistory[1].getAmount()).toBe(2);
      expect(table.preFlopBettingHistory[2].getAmount()).toBe(5);
    }
    else {
      throw new Error("undefined"); 
    }
    console.log(table.preFlopBettingHistory);


    expect(table.aliveSeatingArrangement.getNthElement(3)?.data).toBe(table.option);

    console.log(table.aliveSeatingArrangement.getNthElement(3)?.data.username + " This guy");
    table.aliveSeatingArrangement.getNthElement(3)?.data.fold();
    //console.log("after the fold" + table.preFlopBettingHistory);


    //next hand

  })
})

//blinds pushed to the list

//blinds forced all ins

//hands increase, hand progress

