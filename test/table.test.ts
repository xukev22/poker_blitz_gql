import { describe, expect, test } from "@jest/globals";
import {NLHTable} from '../src/types/tables';
import {HumanPlayer} from '../src/types/players';

describe("sum module", () => {
  test("adds 1 + 2 to equal 3", () => {
    expect(1 + 2).toBe(3);
  });
});


// startTable tests
describe("startTable tests", () => {
  // Creating a new instance of MyClass
  const table = new NLHTable("Table 1", 1000, 1, 2, 5, 10, 8, 50, 2);
  const player1 = new HumanPlayer("Bebe", 0);
  const player2 = new HumanPlayer("Pepe", 100);
  player1.joinTable(table);
  player2.joinTable(table);

  
  test("start table should throw exceptions", () => {
    expect(1 + 2).toBe(3);
  });

});
