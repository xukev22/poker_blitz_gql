import { describe, expect, test, beforeEach } from "@jest/globals";
import { CircularLinkedList } from "../src/types/circular_linked_list";
import { IPlayer, HumanPlayer } from "../src/types/players";

let bigList: CircularLinkedList<IPlayer>;
let player1;
let player2;
let player3;
let player4;
let player5;
let player6;

beforeEach(() => {
  bigList = new CircularLinkedList<IPlayer>();
  player1 = new HumanPlayer("kevuhh", 1500);
  player2 = new HumanPlayer("bigjosher", 1500);
  player3 = new HumanPlayer("BigPhil", 2500);
  player4 = new HumanPlayer("dnegs", 2650);
  player5 = new HumanPlayer("PhilIvey", 4000);
  player6 = new HumanPlayer("bigfish", 1);
  bigList.append(player1);
  bigList.append(player2);
  bigList.append(player3);
  bigList.append(player4);
  bigList.append(player5);
  bigList.append(player6);
});

describe("circular linked list module", () => {
  test("append", () => {
    const myList = new CircularLinkedList<number>();
    expect(myList.length()).toBe(0);
    myList.append(1);
    expect(myList.length()).toBe(1);
    myList.append(2);
    expect(myList.length()).toBe(2);
    myList.append(3);
    expect(myList.length()).toBe(3);
  });
  test("forEach", () => {
    const players = new CircularLinkedList<IPlayer>();
    players.append(new HumanPlayer("kevuhh", 0));
    players.append(new HumanPlayer("josh", 0));
    players.forEach((player) => (player.elo += 5));
  });
  test("remove", () => {
    const players = new CircularLinkedList<IPlayer>();
    const player1 = new HumanPlayer("kevuhh", 0);
    const player2 = new HumanPlayer("josh", 0);
    expect(() => players.remove(player1)).toThrow();
    players.append(player1);
    players.append(player2);
    players.remove(player2);
    expect(players.length()).toBe(1);
    players.remove(player1);
    expect(players.length()).toBe(0);
  });
  // test("shuffle", () => {
  //   const players = new CircularLinkedList<number>();
  //   players.append(1);
  //   players.append(2);
  //   players.append(3);
  //   players.append(4);
  //   players.append(5);
  //   players.print();
  //   players.shuffle();
  //   players.print();
  // });
  test("clone", () => {
    const newList = bigList.clone();
    expect(newList.length()).toBe(6);
    // newList.print();
  });
  test("find", () => {
    const list = new CircularLinkedList<number>();
    list.append(2);
    list.append(3);
    list.append(4);
    expect(() => new CircularLinkedList<number>().find(1)).toThrow();
    expect(() => list.find(1)).toThrow();
    expect(bigList.find(player2)?.data).toBe(player2);
  });
  test("getNthElement", () => {
    expect(() => new CircularLinkedList<number>().getNthElement(1)).toThrow();
    expect(() => bigList.getNthElement(6)).toThrow();
    expect(() => bigList.getNthElement(-1)).toThrow();
    expect(bigList.getNthElement(0)?.data).toBe(player1);
    expect(bigList.getNthElement(1)?.data).toBe(player2);
    expect(bigList.getNthElement(2)?.data).toBe(player3);
    expect(bigList.getNthElement(3)?.data).toBe(player4);
    expect(bigList.getNthElement(4)?.data).toBe(player5);
    expect(bigList.getNthElement(5)?.data).toBe(player6);
  });
});
