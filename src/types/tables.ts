import {
  calculateNewBlindMultiplier,
  generateDeck,
  getCurrentBettingHistory,
} from "../utils";
import { IPlayer } from "./players";

export interface IPokerTable {
  readonly name: string;
  readonly startingStack: number;
  readonly startingSB: number;
  readonly startingBB: number;
  readonly startingST: number;
  readonly decisionTime: number;
  readonly handsUntilBlindsIncrease?: number;
  readonly blindIncreaseRatio?: number;
  readonly maxPlayers: number;
  currentSB?: number;
  currentBB?: number;
  currentST?: number;
  tableInProgress: boolean;
  handInProgress: boolean;
  hand?: number;
  option?: IPlayer;
  flop?: Card[];
  turn?: Card;
  river?: Card;
  aliveSeatingArrangement: CircularLinkedList<IPlayer>;
  bettingStage?: BettingStage;
  preFlopBettingHistory?: IBetAction[];
  flopBettingHistory?: IBetAction[];
  turnBettingHistory?: IBetAction[];
  riverBettingHistory?: IBetAction[];
  startingElos: number[];
  startTable(): void;
  startHand(): void;
  isBettingActionDone(): boolean;
  dealUniqueFlop(): void;
  dealUniqueTurn(): void;
  dealUniqueRiver(): void;
  resetHandVars(): void;
  resetTableVars(): void;
  advanceBettingAction(): void;
  calculateTotalPot(): number;
  endHand(): void;
}

abstract class APokerTable implements IPokerTable {
  readonly name: string;
  readonly startingStack: number;
  readonly startingSB: number;
  readonly startingBB: number;
  readonly startingST: number;
  readonly decisionTime: number;
  readonly handsUntilBlindsIncrease?: number;
  readonly blindIncreaseRatio?: number;
  readonly maxPlayers: number;
  currentSB?: number;
  currentBB?: number;
  currentST?: number;
  tableInProgress: boolean;
  handInProgress: boolean;
  hand?: number;
  option?: IPlayer;
  flop?: Card[];
  turn?: Card;
  river?: Card;
  aliveSeatingArrangement: CircularLinkedList<IPlayer>;
  bettingStage?: BettingStage;
  preFlopBettingHistory?: IBetAction[];
  flopBettingHistory?: IBetAction[];
  turnBettingHistory?: IBetAction[];
  riverBettingHistory?: IBetAction[];
  startingElos: number[];

  constructor(
    name: string,
    startingStack: number,
    startingSB: number,
    startingBB: number,
    startingST: number,
    decisionTime: number,
    maxPlayers: number,
    handsUntilBlindsIncrease?: number,
    blindIncreaseRatio?: number
  ) {
    this.name = name;
    this.startingStack = startingStack;
    this.startingSB = startingSB;
    this.startingBB = startingBB;
    this.startingST = startingST;
    this.decisionTime = decisionTime;
    this.handsUntilBlindsIncrease = handsUntilBlindsIncrease;
    this.blindIncreaseRatio = blindIncreaseRatio;
    this.maxPlayers = maxPlayers;
    this.tableInProgress = false;
    this.handInProgress = false;
    this.startingElos = [];
    this.aliveSeatingArrangement = new CircularLinkedList<IPlayer>();
  }

  startTable(): void {
    if (this.tableInProgress) {
      throw new Error("Table already has game in progress");
    }

    if (this.aliveSeatingArrangement.length() != this.maxPlayers) {
      throw new Error("Table is not full yet");
    }

    this.tableInProgress = true;
    this.hand = 0;
    // defensively delete
    this.resetTableVars();
  }
  startHand(): void {
    if (!this.tableInProgress) {
      throw new Error("Cannot start hand since table has not started yet");
    }
    if (this.handInProgress) {
      throw new Error(
        "Cannot start hand because there is already a hand in progress"
      );
    }
    this.hand++;
    this.handInProgress = true;
    // defensively delete
    this.resetHandVars();

    // set blinds based on hand number, increase ratio, and increase frequency
    let blindMultiplier = 1;
    if (this.blindIncreaseRatio && this.handsUntilBlindsIncrease) {
      blindMultiplier = calculateNewBlindMultiplier(
        this.hand,
        this.blindIncreaseRatio,
        this.handsUntilBlindsIncrease
      );
    }
    this.currentSB = Math.round(this.startingSB * blindMultiplier);
    this.currentBB = Math.round(this.startingBB * blindMultiplier);
    this.currentST = Math.round(this.startingST * blindMultiplier);

    const deck: Card[] = shuffleArray(generateDeck());
    this.aliveSeatingArrangement.forEach((player) => {
      if (player.stack > 0) {
        const holeCards: Card[] = [];
        holeCards.push(deck.pop());
        player.holeCards = holeCards;
      }
    });
    if (this.aliveSeatingArrangement.head == null) {
      throw new Error("Data corruption: null head");
    }
    let alivePlayerCount = 0;
    this.aliveSeatingArrangement.forEach((player) => {
      if (player.stack > 0) {
        alivePlayerCount++;
      }
    });
    if (alivePlayerCount < 2 || alivePlayerCount > 10) {
      throw new Error(
        "Data corruption: alive players should be between 2 and 10 inclusive"
      );
    }

    // get SB/(BB if heads-up) based on hand and alivePlayers
    const nextCount = (this.hand - 1) % alivePlayerCount;
    const smallBlindNode =
      this.aliveSeatingArrangement.getNthElement(nextCount);
    const smallBlindPlayer = smallBlindNode.data;

    // set option and blind bets
    if (alivePlayerCount == 2) {
      const bigBlind = new Blind();
      const bigBlindPlayer = smallBlindNode.next.data;
      if (bigBlindPlayer.stack <= this.currentBB) {
        bigBlind.allIn = true;
        bigBlind.amount = bigBlindPlayer.stack;
        bigBlind.player = bigBlindPlayer;
        bigBlindPlayer.stack = 0;
      } else {
        bigBlind.allIn = false;
        bigBlind.amount = this.currentBB;
        bigBlind.player = bigBlindPlayer;
        bigBlindPlayer.stack -= this.currentBB;
      }
      this.preFlopBettingHistory.push(bigBlind);

      const stBlind = new Blind();
      const stPlayer = smallBlindNode.next.next.data;
      if (stPlayer.stack <= this.currentST) {
        stBlind.allIn = true;
        stBlind.amount = stPlayer.stack;
        stBlind.player = stPlayer;
        stPlayer.stack = 0;
      } else {
        stBlind.allIn = false;
        stBlind.amount = this.currentST;
        stBlind.player = stPlayer;
        stPlayer.stack -= this.currentST;
      }
      this.preFlopBettingHistory.push(stBlind);

      this.option = bigBlindPlayer;
    } else {
      const smallBlind = new Blind();
      if (smallBlindPlayer.stack <= this.currentSB) {
        smallBlind.allIn = true;
        smallBlind.amount = smallBlindPlayer.stack;
        smallBlind.player = smallBlindPlayer;
        smallBlindPlayer.stack = 0;
      } else {
        smallBlind.allIn = false;
        smallBlind.amount = this.currentSB;
        smallBlind.player = smallBlindPlayer;
        smallBlindPlayer.stack -= this.currentSB;
      }
      this.preFlopBettingHistory.push(smallBlind);

      const bigBlind = new Blind();
      const bigBlindPlayer = smallBlindNode.next.data;
      if (bigBlindPlayer.stack <= this.currentBB) {
        bigBlind.allIn = true;
        bigBlind.amount = bigBlindPlayer.stack;
        bigBlind.player = bigBlindPlayer;
        bigBlindPlayer.stack = 0;
      } else {
        bigBlind.allIn = false;
        bigBlind.amount = this.currentBB;
        bigBlind.player = bigBlindPlayer;
        bigBlindPlayer.stack -= this.currentBB;
      }
      this.preFlopBettingHistory.push(bigBlind);

      const stBlind = new Blind();
      const stPlayer = smallBlindNode.next.next.data;
      if (stPlayer.stack <= this.currentST) {
        stBlind.allIn = true;
        stBlind.amount = stPlayer.stack;
        stBlind.player = stPlayer;
        stPlayer.stack = 0;
      } else {
        stBlind.allIn = false;
        stBlind.amount = this.currentST;
        stBlind.player = stPlayer;
        stPlayer.stack -= this.currentST;
      }
      this.preFlopBettingHistory.push(stBlind);

      if (alivePlayerCount > 3) {
        this.option = smallBlindNode.next.next.next.data;
      } else {
        this.option = smallBlindPlayer;
      }
    }

    // if at least everyone except one player is all in then we can go to the runout immediately
    let allIns = 0;
    this.preFlopBettingHistory.forEach((betAction) => {
      if (betAction.allIn) {
        allIns++;
      }
    });

    if (
      (allIns >= 2 && alivePlayerCount == 3) ||
      (allIns >= 1 && alivePlayerCount == 2)
    ) {
      this.dealUniqueFlop();
      this.dealUniqueTurn();
      this.dealUniqueRiver();
      this.endHand();
    }
  }
  isBettingActionDone(): boolean {
    const bettingHistory: IBetAction[] = getCurrentBettingHistory(this);
    // betting action is done once the betting lead has been matched and the rest players have folded or are allin
    // or it checks around

    let tempState: {
      bettingLead: IBetAction;
      playersThatCanAct: number;
      playersThatMatchOrFoldBettingLead: number;
      consecutiveChecks: number;
    } = {
      bettingLead: bettingHistory[0],
      playersThatCanAct: this.aliveSeatingArrangement.length(),
      playersThatMatchOrFoldBettingLead: 0,
      consecutiveChecks: 0,
    };

    for (const betAction of bettingHistory) {
      // update state

      // case: check
      // case: fold
      // case: raise/bet not all in
      // case: allin raise
      // case: allin not raise
      if (betAction instanceof Check) {
        tempState.consecutiveChecks++;
      } else if (betAction instanceof Fold) {
        tempState.playersThatCanAct--;
        tempState.playersThatMatchOrFoldBettingLead++;
        tempState.consecutiveChecks = 0;
      } else if (
        !betAction.allIn &&
        betAction.getAmount() &&
        betAction.getAmount() > tempState.bettingLead.getAmount()
      ) {
        tempState.bettingLead = betAction;
        tempState.consecutiveChecks = 0;
        tempState.playersThatMatchOrFoldBettingLead = 1;
      } else if (
        betAction.allIn &&
        betAction.getAmount() > tempState.bettingLead.getAmount()
      ) {
        tempState.bettingLead = betAction;
        tempState.consecutiveChecks = 0;
        tempState.playersThatMatchOrFoldBettingLead = 1;
        tempState.playersThatCanAct--;
      } else if (
        betAction.allIn &&
        betAction.getAmount() <= tempState.bettingLead.getAmount()
      ) {
        tempState.consecutiveChecks = 0;
        tempState.playersThatMatchOrFoldBettingLead++;
        tempState.playersThatCanAct--;
      } else {
        throw new Error("How did I get here, BAD BAD BAD");
      }

      // if state implies betting is done, return true
      if (tempState.consecutiveChecks == tempState.playersThatCanAct) {
        return true;
      }
      if (
        tempState.playersThatCanAct ==
        tempState.playersThatMatchOrFoldBettingLead
      ) {
        return true;
      }
    }
    return false;
  }
  dealUniqueFlop(): void {
    const fullDeck = generateDeck();
    let usedHoleCards: Card[] = [];
    this.aliveSeatingArrangement.forEach((player) => {
      usedHoleCards.concat(player.holeCards);
    });
    const unusedDeck: Card[] = fullDeck.filter(
      (card) =>
        !usedHoleCards.some(
          (usedCard) =>
            usedCard.suit == card.suit && usedCard.value == card.value
        )
    );

    const shuffledDeck: Card[] = shuffleArray(unusedDeck);

    const flop: Card[] = shuffledDeck.slice(0, 3);

    this.flop = flop;
  }
  dealUniqueTurn(): void {
    const fullDeck = generateDeck();
    let usedHoleCards: Card[] = [];
    this.aliveSeatingArrangement.forEach((player) => {
      usedHoleCards.concat(player.holeCards);
    });
    usedHoleCards.concat(this.flop || []);
    const unusedDeck: Card[] = fullDeck.filter(
      (card) =>
        !usedHoleCards.some(
          (usedCard) =>
            usedCard.suit == card.suit && usedCard.value == card.value
        )
    );

    const shuffledDeck: Card[] = shuffleArray(unusedDeck);

    const turn: Card = shuffledDeck[0];

    this.turn = turn;
  }
  dealUniqueRiver(): void {
    const fullDeck = generateDeck();
    let usedHoleCards: Card[] = [];
    this.aliveSeatingArrangement.forEach((player) => {
      usedHoleCards.concat(player.holeCards);
    });
    usedHoleCards.concat(this.flop || []);
    usedHoleCards.concat(this.turn ? [this.turn] : []);
    const unusedDeck: Card[] = fullDeck.filter(
      (card) =>
        !usedHoleCards.some(
          (usedCard) =>
            usedCard.suit == card.suit && usedCard.value == card.value
        )
    );

    const shuffledDeck: Card[] = shuffleArray(unusedDeck);

    const river: Card = shuffledDeck[0];

    this.river = river;
  }
  resetHandVars(): void {
    delete this.option;
    delete this.bettingStage;
    delete this.preFlopBettingHistory;
    delete this.flopBettingHistory;
    delete this.turnBettingHistory;
    delete this.riverBettingHistory;
    delete this.flop;
    delete this.turn;
    delete this.river;
    this.aliveSeatingArrangement.forEach((player) => {
      delete player.holeCards;
    });
    this.bettingStage = BettingStage.PREFLOP;
    this.preFlopBettingHistory = [];
  }
  resetTableVars(): void {
    delete this.option;
    delete this.preFlopBettingHistory;
    delete this.flopBettingHistory;
    delete this.turnBettingHistory;
    delete this.riverBettingHistory;
    delete this.flop;
    delete this.turn;
    delete this.river;
    delete this.bettingStage;

    this.currentSB = this.startingSB;
    this.currentBB = this.startingBB;
    this.currentST = this.startingST;

    this.aliveSeatingArrangement.shuffle();
    this.aliveSeatingArrangement.forEach((player) => {
      player.stack = this.startingStack;
      // defensively delete
      delete player.holeCards;
    });
  }
  advanceBettingAction(): void {
    let foldCount = 0;
    // const bettingHistory = getCurrentBettingHistory(this);
    const wholeBettingHistory = this.preFlopBettingHistory
      .concat(this.flopBettingHistory)
      .concat(this.turnBettingHistory)
      .concat(this.riverBettingHistory);
    wholeBettingHistory.forEach((betAction) => {
      if (betAction instanceof Fold) {
        foldCount++;
      }
    });

    // if everyone fold then give pot to last person standing
    if (foldCount == this.aliveSeatingArrangement.length() - 1) {
      const players = this.aliveSeatingArrangement.clone();
      wholeBettingHistory.forEach((betAction) => {
        if (betAction instanceof Fold) {
          players.remove(betAction.player);
        }
      });
      if (players.length() !== 1) {
        throw new Error(
          "Data corruption: Everyone folded except one, there should only be a single player left"
        );
      }
      const player = players.head.data;
      player.stack += this.calculateTotalPot();
      this.resetHandVars();
      return;
    }
    let allIns = 0;
    wholeBettingHistory.forEach((betAction) => {
      if (betAction.allIn) {
        allIns++;
      }
    });
    // if everyone except one all in then runout the board and end hand
    if (allIns + 1 == this.aliveSeatingArrangement.length()) {
      if (this.bettingStage === BettingStage.PREFLOP) {
        this.dealUniqueFlop();
        this.dealUniqueTurn();
        this.dealUniqueRiver();
      } else if (this.bettingStage === BettingStage.FLOP) {
        this.dealUniqueTurn();
        this.dealUniqueRiver();
      } else if (this.bettingStage === BettingStage.TURN) {
        this.dealUniqueRiver();
      }
      this.endHand();
      return;
    }

    const blindsPreflop = this.preFlopBettingHistory.filter(
      (betAction) => betAction instanceof Blind
    );
    const stPlayer = blindsPreflop[blindsPreflop.length - 1].player;
    const stNode = this.aliveSeatingArrangement.find(stPlayer);

    // set new option
    if (this.aliveSeatingArrangement.length() == 2) {
      this.option = stNode.data;
    } else {
      let newOption = stNode.next;
      let count = 0;
      while (count < this.aliveSeatingArrangement.length()) {
        if (newOption.data.stack > 0) {
          break;
        } else {
          newOption = newOption.next;
        }
      }
      this.option = newOption.data;
    }
    // we have more phase(s) to come:
    if (this.bettingStage === BettingStage.PREFLOP) {
      this.dealUniqueFlop();
    } else if (this.bettingStage === BettingStage.FLOP) {
      this.dealUniqueTurn();
    } else if (this.bettingStage === BettingStage.TURN) {
      this.dealUniqueRiver();
    } else if (this.bettingStage === BettingStage.RIVER) {
      this.endHand();
    }
  }
  calculateTotalPot(): number {
    let totalPot = 0;
    this.preFlopBettingHistory.forEach(
      (betAction) =>
        (totalPot += betAction.getAmount() ? betAction.getAmount() : 0)
    );
    this.flopBettingHistory.forEach(
      (betAction) =>
        (totalPot += betAction.getAmount() ? betAction.getAmount() : 0)
    );
    this.turnBettingHistory.forEach(
      (betAction) =>
        (totalPot += betAction.getAmount() ? betAction.getAmount() : 0)
    );
    this.riverBettingHistory.forEach(
      (betAction) =>
        (totalPot += betAction.getAmount() ? betAction.getAmount() : 0)
    );
    return totalPot;
  }
  endHand(): void {
    // determines winner(s), distributes chips accordingly, adjusts elo, resets the table/hand vars
    // const winnerOfMainPot = this.determineWinner(this.aliveSeatingArrangement);
    // TODO determineWinner(players) returns list of players
  }
}

class PLOTable extends APokerTable {
  constructor(
    name: string,
    startingStack: number,
    startingSB: number,
    startingBB: number,
    startingST: number,
    decisionTime: number,
    maxPlayers: number,
    handsUntilBlindsIncrease?: number,
    blindIncreaseRatio?: number
  ) {
    super(
      name,
      startingStack,
      startingSB,
      startingBB,
      startingST,
      decisionTime,
      maxPlayers,
      handsUntilBlindsIncrease,
      blindIncreaseRatio
    );
  }
}

class NLHTable extends APokerTable {
  constructor(
    name: string,
    startingStack: number,
    startingSB: number,
    startingBB: number,
    startingST: number,
    decisionTime: number,
    maxPlayers: number,
    handsUntilBlindsIncrease?: number,
    blindIncreaseRatio?: number
  ) {
    super(
      name,
      startingStack,
      startingSB,
      startingBB,
      startingST,
      decisionTime,
      maxPlayers,
      handsUntilBlindsIncrease,
      blindIncreaseRatio
    );
  }
}

export interface IBetAction {
  allIn: boolean;
  player: IPlayer;
  getAmount(): number;
}

interface IBetActionWithAmount extends IBetAction {
  amount: number;
}

export class Blind implements IBetActionWithAmount {
  allIn: boolean;
  player: IPlayer;
  amount: number;
  getAmount() {
    return this.amount;
  }
}

export class Bet implements IBetActionWithAmount {
  allIn: boolean;
  player: IPlayer;
  amount: number;
  getAmount() {
    return this.amount;
  }
}

export class Call implements IBetActionWithAmount {
  allIn: boolean;
  player: IPlayer;
  amount: number;
  getAmount() {
    return this.amount;
  }
}

export class Raise implements IBetActionWithAmount {
  allIn: boolean;
  player: IPlayer;
  amount: number;
  getAmount() {
    return this.amount;
  }
}

export class Check implements IBetAction {
  allIn: boolean;
  player: IPlayer;
  getAmount() {
    return null;
  }
}

export class Fold implements IBetAction {
  allIn: boolean;
  player: IPlayer;
  constructor(player: IPlayer) {
    this.allIn = false;
    this.player = player;
  }
  getAmount() {
    return null;
  }
}

enum PokerVariantType {
  NLH = "NLH",
  PLO = "PLO",
}

export class Card {
  readonly value: CardValue;
  readonly suit: CardSuit;

  constructor(value: CardValue, suit: CardSuit) {
    this.value = value;
    this.suit = suit;
  }
}

export enum CardValue {
  ACE = "ACE",
  TWO = "TWO",
  THREE = "THREE",
  FOUR = "FOUR",
  FIVE = "FIVE",
  SIX = "SIX",
  SEVEN = "SEVEN",
  EIGHT = "EIGHT",
  NINE = "NINE",
  TEN = "TEN",
  JACK = "JACK",
  QUEEN = "QUEEN",
  KING = "KING",
}

export enum CardSuit {
  HEART = "HEART",
  DIAMOND = "DIAMOND",
  CLUB = "CLUB",
  SPADE = "SPADE",
}

export enum BettingStage {
  PREFLOP = "PREFLOP",
  FLOP = "FLOP",
  TURN = "TURN",
  RIVER = "RIVER",
}
