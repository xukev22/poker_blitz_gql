import { describe, expect, test } from "@jest/globals";
import {
  calculateNewBlindMultiplier,
  calculateNewElo,
  generateDeck,
  getCurrentBettingHistory,
  cardValueToNumberRep,
  numberRepToCardValue,
  shuffleArray,
} from "../src/utils";
import {
  Bet,
  BettingStage,
  Blind,
  CardValue,
  NLHTable,
} from "../src/types/tables";

describe("calculate elo", () => {
  test("placeholder", () => {
    expect(calculateNewElo(100, 1, [1, 2, 3])).toBeGreaterThanOrEqual(50);
  });
});

describe("calculate new blind multiplier", () => {
  test("first round", () => {
    expect(calculateNewBlindMultiplier(1, 2, 10)).toBe(1);
    expect(calculateNewBlindMultiplier(5, 2, 10)).toBe(1);
    expect(calculateNewBlindMultiplier(10, 2, 10)).toBe(1);
  });
  test("second round", () => {
    expect(calculateNewBlindMultiplier(11, 1, 10)).toBe(1);
    expect(calculateNewBlindMultiplier(15, 1, 10)).toBe(1);
    expect(calculateNewBlindMultiplier(20, 1, 10)).toBe(1);
    expect(calculateNewBlindMultiplier(11, 2, 10)).toBe(2);
    expect(calculateNewBlindMultiplier(15, 2, 10)).toBe(2);
    expect(calculateNewBlindMultiplier(20, 2, 10)).toBe(2);
  });
  test("fifth round", () => {
    expect(calculateNewBlindMultiplier(41, 1.5, 10)).toBe(
      1.5 * 1.5 * 1.5 * 1.5
    );
    expect(calculateNewBlindMultiplier(45, 1.5, 10)).toBe(
      1.5 * 1.5 * 1.5 * 1.5
    );
    expect(calculateNewBlindMultiplier(50, 1.5, 10)).toBe(
      1.5 * 1.5 * 1.5 * 1.5
    );
  });
});

describe("generate deck", () => {
  test("test length", () => {
    expect(generateDeck().length).toBe(52);
  });
  test("test shuffle", () => {
    const deck = generateDeck();
    shuffleArray(deck);
    expect(generateDeck().length).toBe(52);
    // console.log(deck);
  });
  //   test("see cards", () => {
  //     console.log(generateDeck());
  //   });
});

describe("get current betting history phase", () => {
  test("edge cases", () => {
    const table = new NLHTable("hello", 100, 1, 2, 5, 10, 8);
    expect(() => getCurrentBettingHistory(table)).toThrow();
  });
  test("actual cases", () => {
    const table = new NLHTable("hello", 100, 1, 2, 5, 10, 8);
    table.bettingStage = BettingStage.PREFLOP;
    table.preFlopBettingHistory = [new Blind()];
    expect(getCurrentBettingHistory(table)).toStrictEqual([new Blind()]);

    table.bettingStage = BettingStage.FLOP;
    table.flopBettingHistory = [new Blind(), new Blind()];
    expect(getCurrentBettingHistory(table)).toStrictEqual([
      new Blind(),
      new Blind(),
    ]);

    table.bettingStage = BettingStage.TURN;
    table.turnBettingHistory = [new Blind(), new Blind(), new Blind()];
    expect(getCurrentBettingHistory(table)).toStrictEqual([
      new Blind(),
      new Blind(),
      new Blind(),
    ]);

    table.bettingStage = BettingStage.RIVER;
    table.riverBettingHistory = [
      new Blind(),
      new Blind(),
      new Blind(),
      new Blind(),
    ];
    expect(getCurrentBettingHistory(table)).toStrictEqual([
      new Blind(),
      new Blind(),
      new Blind(),
      new Blind(),
    ]);
  });
});

describe("card value to number rep and vise versa", () => {
  test("card value to number rep", () => {
    expect(cardValueToNumberRep(CardValue.ACE)).toBe(14);
    expect(cardValueToNumberRep(CardValue.KING)).toBe(13);
    expect(cardValueToNumberRep(CardValue.QUEEN)).toBe(12);
    expect(cardValueToNumberRep(CardValue.JACK)).toBe(11);
    expect(cardValueToNumberRep(CardValue.TEN)).toBe(10);
    expect(cardValueToNumberRep(CardValue.NINE)).toBe(9);
    expect(cardValueToNumberRep(CardValue.EIGHT)).toBe(8);
    expect(cardValueToNumberRep(CardValue.SEVEN)).toBe(7);
    expect(cardValueToNumberRep(CardValue.SIX)).toBe(6);
    expect(cardValueToNumberRep(CardValue.FIVE)).toBe(5);
    expect(cardValueToNumberRep(CardValue.FOUR)).toBe(4);
    expect(cardValueToNumberRep(CardValue.THREE)).toBe(3);
    expect(cardValueToNumberRep(CardValue.TWO)).toBe(2);
  });
  test("number rep to card value", () => {
    expect(numberRepToCardValue(14)).toBe(CardValue.ACE);
    expect(numberRepToCardValue(13)).toBe(CardValue.KING);
    expect(numberRepToCardValue(12)).toBe(CardValue.QUEEN);
    expect(numberRepToCardValue(11)).toBe(CardValue.JACK);
    expect(numberRepToCardValue(10)).toBe(CardValue.TEN);
    expect(numberRepToCardValue(9)).toBe(CardValue.NINE);
    expect(numberRepToCardValue(8)).toBe(CardValue.EIGHT);
    expect(numberRepToCardValue(7)).toBe(CardValue.SEVEN);
    expect(numberRepToCardValue(6)).toBe(CardValue.SIX);
    expect(numberRepToCardValue(5)).toBe(CardValue.FIVE);
    expect(numberRepToCardValue(4)).toBe(CardValue.FOUR);
    expect(numberRepToCardValue(3)).toBe(CardValue.THREE);
    expect(numberRepToCardValue(2)).toBe(CardValue.TWO);
  });
});
