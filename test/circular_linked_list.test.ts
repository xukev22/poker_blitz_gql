import { describe, expect, test } from "@jest/globals";
import { CircularLinkedList } from "../src/types/circular_linked_list";
import { IPlayer, HumanPlayer } from "../src/types/players";

describe("sum module", () => {
  test("list length over time", () => {
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
    players.print();
  });
});
