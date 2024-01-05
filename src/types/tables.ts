import {
  calculateNewBlindMultiplier,
  calculateNewElo,
  cardValueToNumberRep,
  compareArrays,
  generateDeck,
  getCurrentBettingHistory,
  numberRepToCardValue,
} from "../utils";
import { IPlayer } from "./players";

// An interface for a PokerTable
export interface IPokerTable {
  // these readonly fields will never need to change, unless updateTable calls it not during an ongoing game
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
  advanceBettingAction(): void;
}

// Common methods and fields for implementations of a poker table
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

  // common constructor for initializing a table
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
  // starts the table, resetting/initializing all relevant fields defensively
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
  // starts a new hand, resetting/initialize all relevant fields defensively
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

    this.dealUniqueHoleCards();
    if (this.aliveSeatingArrangement.head == null) {
      throw new Error("Data corruption: null head");
    }
    // NOTE assumes the list is properly pruned after a hand is over
    // get the amount of players left
    const alivePlayerCount = this.aliveSeatingArrangement.length();
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
    // case: heads up
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
      // case not heads up
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
        // case we have more than 3 players
        this.option = smallBlindNode.next.next.next.data;
      } else {
        // case: exactly 3
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
      // runout
      this.dealUniqueFlop();
      this.dealUniqueTurn();
      this.dealUniqueRiver();
      this.endHand();
    }
  }
  // NOTE does not handle all in below 2x raise, action should be halted but it allows reraises
  // checks if betting action is done, likely implying advanceBettingAction() will be called
  isBettingActionDone(): boolean {
    // betting action is done once the betting lead has been matched and the rest players have folded or are allin
    // or it checks around
    const bettingHistory: IBetAction[] = getCurrentBettingHistory(this);

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

    // LIKELY debug
    for (const betAction of bettingHistory) {
      // update state

      // case: check
      // case: fold
      // case: call
      // case: raise/bet not all in
      // case: allin raise
      // case: allin not raise
      if (betAction instanceof Check) {
        tempState.consecutiveChecks++;
      } else if (betAction instanceof Fold) {
        tempState.playersThatCanAct--;
        tempState.playersThatMatchOrFoldBettingLead++;
        tempState.consecutiveChecks = 0;
      } else if (betAction instanceof Call) {
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
    }
    // if state implies betting is done, return true
    if (tempState.consecutiveChecks == tempState.playersThatCanAct) {
      return true;
    }
    if (
      tempState.playersThatCanAct == tempState.playersThatMatchOrFoldBettingLead
    ) {
      return true;
    }
    return false;
  }
  // advance the betting action based on the current game state
  advanceBettingAction(): void {
    let foldCount = 0;
    const wholeBettingHistory = this.preFlopBettingHistory
      .concat(this.flopBettingHistory)
      .concat(this.turnBettingHistory)
      .concat(this.riverBettingHistory);
    wholeBettingHistory.forEach((betAction) => {
      if (betAction instanceof Fold) {
        foldCount++;
      }
    });

    // if everyone folds but one person then give pot to last person standing
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

    // find the straddle player
    const blindsPreflop = this.preFlopBettingHistory.filter(
      (betAction) => betAction instanceof Blind
    );
    const stPlayer = blindsPreflop[blindsPreflop.length - 1].player;
    const stNode = this.aliveSeatingArrangement.find(stPlayer);

    // set new option
    // case: heads up
    if (this.aliveSeatingArrangement.length() == 2) {
      this.option = stNode.data;
    } else {
      // case: not heads up
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
  // deal unique flop (no hole cards)
  private dealUniqueFlop(): void {
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
  // deal unique turn (no hole cards, flop)
  private dealUniqueTurn(): void {
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
  // deal unique river (no hole cards, flop, turn)
  private dealUniqueRiver(): void {
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
  // helper func to reset hand vars, does not adjust hand num that is handled in startHand()
  private resetHandVars(): void {
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
  // helper func to reset table vars
  private resetTableVars(): void {
    delete this.option;
    delete this.bettingStage;
    delete this.preFlopBettingHistory;
    delete this.flopBettingHistory;
    delete this.turnBettingHistory;
    delete this.riverBettingHistory;
    delete this.flop;
    delete this.turn;
    delete this.river;

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
  // helper func to calcualte everything put into the pot
  private calculateTotalPot(): number {
    let totalPot = 0;
    this.preFlopBettingHistory.forEach(
      (betAction) => (totalPot += betAction.getAmount())
    );
    this.flopBettingHistory.forEach(
      (betAction) => (totalPot += betAction.getAmount())
    );
    this.turnBettingHistory.forEach(
      (betAction) => (totalPot += betAction.getAmount())
    );
    this.riverBettingHistory.forEach(
      (betAction) => (totalPot += betAction.getAmount())
    );
    return totalPot;
  }
  // NOTE if everyone folded prior then that was handled in advanceAction then endHand shouldnt/doesnt need to be called
  // NOTE that double/multi KO position tiebreakers not handled yet (i.e person with bigger stack at start of hand should finish higher than other person if both KO)
  private endHand(): void {
    // determine who won what amounts and give them the chips
    let finishPosition = this.aliveSeatingArrangement.length();
    const winners = this.determineWinnersAndHowMuch();
    for (const winner of winners) {
      this.aliveSeatingArrangement.find(winner.player).data.stack +=
        winner.chips;
    }

    // for each player after chip distribution if their stack is 0 sort them by starting stack at hand start, not yet implemented
    // also remove each player with stack at 0
    const newSeatingArrangement = this.aliveSeatingArrangement.clone();
    this.aliveSeatingArrangement.forEach((player) => {
      if (player.stack == 0) {
        newSeatingArrangement.remove(player);
        player.elo = calculateNewElo(
          player.elo,
          finishPosition,
          this.startingElos
        );
        finishPosition -= 1;
      }
    });

    // assign aliveSeatingArrangement to newly calculated list
    this.aliveSeatingArrangement = newSeatingArrangement;

    // reset/initialize the relevant hand variables
    this.resetHandVars();
    this.handInProgress = false;

    // if only one player remains
    if (this.aliveSeatingArrangement.length() == 1) {
      // give them the winning elo algo calc
      calculateNewElo(
        this.aliveSeatingArrangement.head.data.elo,
        1,
        this.startingElos
      );
      // reset the table variables, break out since we are done
      delete this.currentSB;
      delete this.currentBB;
      delete this.currentST;
      delete this.hand;
      delete this.option;
      delete this.flop;
      delete this.turn;
      delete this.river;
      delete this.aliveSeatingArrangement;
      delete this.bettingStage;
      delete this.preFlopBettingHistory;
      delete this.flopBettingHistory;
      delete this.turnBettingHistory;
      delete this.riverBettingHistory;
      delete this.startingElos;
      this.tableInProgress = false;
      return;
    }
  }
  // determines the winners of all the pots (main pots, side pots, etc.) and how much chips each should win
  private determineWinnersAndHowMuch(): { player: IPlayer; chips: number }[] {
    // get whole betting history
    const wholeBettingHistory = this.preFlopBettingHistory
      .concat(this.flopBettingHistory)
      .concat(this.turnBettingHistory)
      .concat(this.riverBettingHistory);
    // get all the players at showdown
    const playersAtShowdown = this.aliveSeatingArrangement.clone();
    const playersAtShowdownInvestment: {
      player: IPlayer;
      chipsInvested: number;
      hand: IHand;
    }[] = [];
    // remove each player that doesnt make it to showdown
    wholeBettingHistory.forEach((betAction) => {
      if (betAction instanceof Fold) {
        playersAtShowdown.remove(betAction.player);
      }
    });
    // for each player that made it to showdown create a investment object[] (unfilled)
    playersAtShowdown.forEach((player) =>
      playersAtShowdownInvestment.push({
        player: player,
        chipsInvested: 0,
        hand: null,
      })
    );
    // fill the investment object[] based on each player's total chips invested, and the hand they have at showdown
    playersAtShowdownInvestment.map((player) => {
      let chipsInvested = 0;
      wholeBettingHistory.forEach((betAction) => {
        if (betAction.player === player.player) {
          chipsInvested += betAction.getAmount();
        }
      });
      return {
        player: player.player,
        chipsInvested: chipsInvested,
        // NOTE omaha calculation of best hand not supported yet, would be overridden in each table class impl
        hand: this.calculateBestPlayerHand(player.player.holeCards),
      };
    });

    // at this point playersAtShowdownInvestment is fully filled, now we sort in asc by chips invested
    playersAtShowdownInvestment.sort(
      (p1, p2) => p1.chipsInvested - p2.chipsInvested
    );
    const originalPlayersAtShowdownInvestment = [
      ...playersAtShowdownInvestment,
    ];

    // create a list of winner info
    const returnWinners: { player: IPlayer; chips: number }[] = [];

    // track the total amount of chips in all the pots combined
    let remainingPot = this.calculateTotalPot();

    const totalContributedByEachPlayerPreflop = new Map<IPlayer, number>();
    this.preFlopBettingHistory.forEach((betAction) => {
      if (totalContributedByEachPlayerPreflop.get(betAction.player)) {
        totalContributedByEachPlayerPreflop.set(
          betAction.player,
          totalContributedByEachPlayerPreflop.get(betAction.player) +
            betAction.getAmount()
        );
      } else {
        totalContributedByEachPlayerPreflop.set(
          betAction.player,
          betAction.getAmount()
        );
      }
    });
    const totalContributedByEachPlayerFlop = new Map<IPlayer, number>();
    this.flopBettingHistory.forEach((betAction) => {
      if (totalContributedByEachPlayerFlop.get(betAction.player)) {
        totalContributedByEachPlayerFlop.set(
          betAction.player,
          totalContributedByEachPlayerFlop.get(betAction.player) +
            betAction.getAmount()
        );
      } else {
        totalContributedByEachPlayerFlop.set(
          betAction.player,
          betAction.getAmount()
        );
      }
    });
    const totalContributedByEachPlayerTurn = new Map<IPlayer, number>();
    this.turnBettingHistory.forEach((betAction) => {
      if (totalContributedByEachPlayerTurn.get(betAction.player)) {
        totalContributedByEachPlayerTurn.set(
          betAction.player,
          totalContributedByEachPlayerTurn.get(betAction.player) +
            betAction.getAmount()
        );
      } else {
        totalContributedByEachPlayerTurn.set(
          betAction.player,
          betAction.getAmount()
        );
      }
    });

    const totalContributedByEachPlayerRiver = new Map<IPlayer, number>();
    this.riverBettingHistory.forEach((betAction) => {
      if (totalContributedByEachPlayerRiver.get(betAction.player)) {
        totalContributedByEachPlayerRiver.set(
          betAction.player,
          totalContributedByEachPlayerRiver.get(betAction.player) +
            betAction.getAmount()
        );
      } else {
        totalContributedByEachPlayerRiver.set(
          betAction.player,
          betAction.getAmount()
        );
      }
    });

    // we will start to chip away at the list of player showdown investments, to calculate main/side pots
    while (playersAtShowdownInvestment.length > 0) {
      // if there is only one player remaining, they overshoved, we just give back the remaining chips to that player
      if (playersAtShowdownInvestment.length == 1) {
        const targetPlayerWithOverflow = returnWinners.find(
          (winner) => winner.player === playersAtShowdownInvestment[0].player
        );
        // case: player won a pot before hand
        if (targetPlayerWithOverflow) {
          returnWinners.forEach((winner) => {
            if (winner.player === targetPlayerWithOverflow.player) {
              winner = {
                ...winner,
                chips: winner.chips + Math.floor(remainingPot),
              };
            }
          });
        } // case player did not win any pots before hand
        else {
          returnWinners.push({
            player: targetPlayerWithOverflow.player,
            chips: Math.floor(remainingPot),
          });
        }
      }

      // determine # players at risk, NOTE should be at least one
      let playersAtRisk = 0;
      let smallestChipsInvested = null;
      playersAtShowdownInvestment.forEach((player) => {
        if (player.chipsInvested) {
          if (smallestChipsInvested == player.chipsInvested) {
            playersAtRisk++;
          }
        } else {
          playersAtRisk = 1;
          smallestChipsInvested = player.chipsInvested;
        }
      });

      // determine winner(s) of pot
      const winners: {
        player: IPlayer;
        chipsInvested: number;
        hand: IHand;
      }[] = this.getWinners(playersAtShowdownInvestment);

      // most can win is preflop pot + flop pot ... : then add all bets on shoved phase that are <= shove amount
      // + n(shove amount) where n is the amount of bets > shove amount
      // NOTE for now we will round up for splits
      // distribute earned chips to each winner, adjust win amount by # players in pot
      winners.forEach((playerShowdownInfo) => {
        // in a given winner, calculate their total contributed preflop
        const targetPlayer = playerShowdownInfo.player;
        const totalContributedPreflopByTargetPlayer =
          totalContributedByEachPlayerPreflop.get(targetPlayer);
        let preFlopWinnings = totalContributedPreflopByTargetPlayer;
        // the most they can collect is the total contributed by all the other players <= their total contributed
        // PLUS (the amount of players that contributed more than their total) * (their total contributed)
        totalContributedByEachPlayerPreflop.forEach((chips) => {
          if (chips <= totalContributedPreflopByTargetPlayer) {
            preFlopWinnings += chips;
          } else {
            preFlopWinnings += totalContributedPreflopByTargetPlayer;
          }
        });
        let allInPreflop = false;
        this.preFlopBettingHistory.forEach((betAction) => {
          if (betAction.allIn && betAction.player === targetPlayer) {
            allInPreflop = true;
          }
        });

        if (allInPreflop) {
          returnWinners.push({
            player: targetPlayer,
            chips: Math.ceil(preFlopWinnings / winners.length),
          });
          remainingPot -= preFlopWinnings;
        } else {
          const targetPlayer = playerShowdownInfo.player;
          const totalContributedFlopByTargetPlayer =
            totalContributedByEachPlayerFlop.get(targetPlayer);
          let flopWinnings = totalContributedFlopByTargetPlayer;
          totalContributedByEachPlayerFlop.forEach((chips) => {
            if (chips <= totalContributedFlopByTargetPlayer) {
              flopWinnings += chips;
            } else {
              flopWinnings += totalContributedFlopByTargetPlayer;
            }
          });
          let allInFlop = false;
          this.flopBettingHistory.forEach((betAction) => {
            if (betAction.allIn && betAction.player === targetPlayer) {
              allInFlop = true;
            }
          });

          if (allInFlop) {
            returnWinners.push({
              player: targetPlayer,
              chips: Math.ceil(
                (preFlopWinnings + flopWinnings) / winners.length
              ),
            });
            remainingPot -= preFlopWinnings + flopWinnings;
          } else {
            const targetPlayer = playerShowdownInfo.player;
            const totalContributedTurnByTargetPlayer =
              totalContributedByEachPlayerTurn.get(targetPlayer);
            let turnWinnings = totalContributedTurnByTargetPlayer;
            totalContributedByEachPlayerTurn.forEach((chips) => {
              if (chips <= totalContributedTurnByTargetPlayer) {
                turnWinnings += chips;
              } else {
                turnWinnings += totalContributedTurnByTargetPlayer;
              }
            });
            let allInTurn = false;
            this.turnBettingHistory.forEach((betAction) => {
              if (betAction.allIn && betAction.player === targetPlayer) {
                allInTurn = true;
              }
            });

            if (allInTurn) {
              returnWinners.push({
                player: targetPlayer,
                chips: Math.ceil(
                  (preFlopWinnings + flopWinnings + turnWinnings) /
                    winners.length
                ),
              });
              remainingPot -= preFlopWinnings + flopWinnings + turnWinnings;
            } else {
              const targetPlayer = playerShowdownInfo.player;
              const totalContributedRiverByTargetPlayer =
                totalContributedByEachPlayerRiver.get(targetPlayer);
              let riverWinnings = totalContributedRiverByTargetPlayer;
              totalContributedByEachPlayerRiver.forEach((chips) => {
                if (chips <= totalContributedRiverByTargetPlayer) {
                  riverWinnings += chips;
                } else {
                  riverWinnings += totalContributedRiverByTargetPlayer;
                }
              });

              returnWinners.push({
                player: targetPlayer,
                chips: Math.ceil(
                  (preFlopWinnings +
                    flopWinnings +
                    turnWinnings +
                    riverWinnings) /
                    winners.length
                ),
              });

              remainingPot -=
                preFlopWinnings + flopWinnings + turnWinnings + riverWinnings;
            }
          }
        }
      });

      playersAtShowdownInvestment.splice(0, playersAtRisk);
    }

    return;
  }
  // given a list of players, determine the winning hands
  private getWinners(
    players: {
      player: IPlayer;
      chipsInvested: number;
      hand: IHand;
    }[]
  ): {
    player: IPlayer;
    chipsInvested: number;
    hand: IHand;
  }[] {
    // sort them by hand strength
    const handsInDescOrder = [...players].sort((p1, p2) =>
      p2.hand.compareHand(p1.hand)
    );
    const returnArr: {
      player: IPlayer;
      chipsInvested: number;
      hand: IHand;
    }[] = [];
    // return all ties as well
    for (const hand of handsInDescOrder) {
      if (returnArr.length == 0) {
        returnArr.push(hand);
      } else {
        const lastElement = returnArr[returnArr.length - 1];
        if (lastElement.hand.compareHand(hand.hand) == 0) {
          returnArr.push(hand);
        } else {
          return returnArr;
        }
      }
    }
  }
  // NOTE does not support PLO override yet
  protected calculateBestPlayerHand(holeCards: Card[]): IHand {
    const boardAndHoleCards = this.flop
      .concat(this.turn)
      .concat(this.river)
      .concat(holeCards);
    let spadeCount = 0;
    let clubCount = 0;
    let heartCount = 0;
    let diamondCount = 0;
    boardAndHoleCards.forEach((card) => {
      switch (card.suit) {
        case CardSuit.SPADE:
          spadeCount++;
          break;
        case CardSuit.CLUB:
          clubCount++;
          break;
        case CardSuit.HEART:
          heartCount++;
          break;
        case CardSuit.DIAMOND:
          diamondCount++;
          break;
      }
    });

    let hasFlush: false | CardSuit = false;

    if (spadeCount >= 5) {
      hasFlush = CardSuit.SPADE;
    } else if (clubCount >= 5) {
      hasFlush = CardSuit.CLUB;
    } else if (heartCount >= 5) {
      hasFlush = CardSuit.HEART;
    } else if (diamondCount >= 5) {
      hasFlush = CardSuit.DIAMOND;
    }

    let hasStraight: false | CardValue = false;
    if (
      boardAndHoleCards.some((card) => card.value === CardValue.ACE) &&
      boardAndHoleCards.some((card) => card.value === CardValue.KING) &&
      boardAndHoleCards.some((card) => card.value === CardValue.QUEEN) &&
      boardAndHoleCards.some((card) => card.value === CardValue.JACK) &&
      boardAndHoleCards.some((card) => card.value === CardValue.TEN)
    ) {
      hasStraight = CardValue.ACE;
    } else if (
      boardAndHoleCards.some((card) => card.value === CardValue.NINE) &&
      boardAndHoleCards.some((card) => card.value === CardValue.KING) &&
      boardAndHoleCards.some((card) => card.value === CardValue.QUEEN) &&
      boardAndHoleCards.some((card) => card.value === CardValue.JACK) &&
      boardAndHoleCards.some((card) => card.value === CardValue.TEN)
    ) {
      hasStraight = CardValue.KING;
    } else if (
      boardAndHoleCards.some((card) => card.value === CardValue.NINE) &&
      boardAndHoleCards.some((card) => card.value === CardValue.EIGHT) &&
      boardAndHoleCards.some((card) => card.value === CardValue.QUEEN) &&
      boardAndHoleCards.some((card) => card.value === CardValue.JACK) &&
      boardAndHoleCards.some((card) => card.value === CardValue.TEN)
    ) {
      hasStraight = CardValue.QUEEN;
    } else if (
      boardAndHoleCards.some((card) => card.value === CardValue.NINE) &&
      boardAndHoleCards.some((card) => card.value === CardValue.EIGHT) &&
      boardAndHoleCards.some((card) => card.value === CardValue.SEVEN) &&
      boardAndHoleCards.some((card) => card.value === CardValue.JACK) &&
      boardAndHoleCards.some((card) => card.value === CardValue.TEN)
    ) {
      hasStraight = CardValue.JACK;
    } else if (
      boardAndHoleCards.some((card) => card.value === CardValue.NINE) &&
      boardAndHoleCards.some((card) => card.value === CardValue.EIGHT) &&
      boardAndHoleCards.some((card) => card.value === CardValue.SEVEN) &&
      boardAndHoleCards.some((card) => card.value === CardValue.SIX) &&
      boardAndHoleCards.some((card) => card.value === CardValue.TEN)
    ) {
      hasStraight = CardValue.TEN;
    } else if (
      boardAndHoleCards.some((card) => card.value === CardValue.NINE) &&
      boardAndHoleCards.some((card) => card.value === CardValue.EIGHT) &&
      boardAndHoleCards.some((card) => card.value === CardValue.SEVEN) &&
      boardAndHoleCards.some((card) => card.value === CardValue.SIX) &&
      boardAndHoleCards.some((card) => card.value === CardValue.FIVE)
    ) {
      hasStraight = CardValue.NINE;
    } else if (
      boardAndHoleCards.some((card) => card.value === CardValue.FOUR) &&
      boardAndHoleCards.some((card) => card.value === CardValue.EIGHT) &&
      boardAndHoleCards.some((card) => card.value === CardValue.SEVEN) &&
      boardAndHoleCards.some((card) => card.value === CardValue.SIX) &&
      boardAndHoleCards.some((card) => card.value === CardValue.FIVE)
    ) {
      hasStraight = CardValue.EIGHT;
    } else if (
      boardAndHoleCards.some((card) => card.value === CardValue.FOUR) &&
      boardAndHoleCards.some((card) => card.value === CardValue.THREE) &&
      boardAndHoleCards.some((card) => card.value === CardValue.SEVEN) &&
      boardAndHoleCards.some((card) => card.value === CardValue.SIX) &&
      boardAndHoleCards.some((card) => card.value === CardValue.FIVE)
    ) {
      hasStraight = CardValue.SEVEN;
    } else if (
      boardAndHoleCards.some((card) => card.value === CardValue.FOUR) &&
      boardAndHoleCards.some((card) => card.value === CardValue.THREE) &&
      boardAndHoleCards.some((card) => card.value === CardValue.TWO) &&
      boardAndHoleCards.some((card) => card.value === CardValue.SIX) &&
      boardAndHoleCards.some((card) => card.value === CardValue.FIVE)
    ) {
      hasStraight = CardValue.SIX;
    } else if (
      boardAndHoleCards.some((card) => card.value === CardValue.FOUR) &&
      boardAndHoleCards.some((card) => card.value === CardValue.THREE) &&
      boardAndHoleCards.some((card) => card.value === CardValue.TWO) &&
      boardAndHoleCards.some((card) => card.value === CardValue.ACE) &&
      boardAndHoleCards.some((card) => card.value === CardValue.FIVE)
    ) {
      hasStraight = CardValue.FIVE;
    }

    if (hasFlush && hasStraight) {
      return new StraightFlush(hasStraight);
    }

    const cardValueMap = new Map<CardValue, number>();
    boardAndHoleCards.forEach((card) => {
      if (cardValueMap.get(card.value)) {
        cardValueMap.set(card.value, cardValueMap.get(card.value) + 1);
      } else {
        cardValueMap.set(card.value, 1);
      }
    });

    let hasQuads: false | CardValue = false;
    for (const cardValueFrequencyPair of cardValueMap.entries()) {
      if (cardValueFrequencyPair[1] == 4) {
        hasQuads = cardValueFrequencyPair[0];
      }
    }

    if (hasQuads) {
      let highestValueSeenNotQuadValue = 0;
      for (const card of boardAndHoleCards) {
        if (
          cardValueToNumberRep(card.value) > highestValueSeenNotQuadValue &&
          card.value != hasQuads
        ) {
          highestValueSeenNotQuadValue = cardValueToNumberRep(card.value);
        }
      }
      return new Quads(
        hasQuads,
        numberRepToCardValue(highestValueSeenNotQuadValue)
      );
    }

    // biggest trips
    let hasTrips: false | CardValue = false;
    for (const cardValueFrequencyPair of cardValueMap.entries()) {
      let highestTripsSeen = 0;
      if (
        cardValueFrequencyPair[1] == 3 &&
        cardValueToNumberRep(cardValueFrequencyPair[0]) > highestTripsSeen
      ) {
        hasTrips = cardValueFrequencyPair[0];
      }
    }

    // NOTE this does nothing if no full house present
    if (hasTrips) {
      let biggestPairOtherThanTheTrips = 0;
      for (const cardValueFrequencyPair of cardValueMap.entries()) {
        if (
          cardValueFrequencyPair[1] >= 2 &&
          cardValueToNumberRep(cardValueFrequencyPair[0]) >
            biggestPairOtherThanTheTrips &&
          cardValueFrequencyPair[0] != hasTrips
        ) {
          biggestPairOtherThanTheTrips = cardValueToNumberRep(
            cardValueFrequencyPair[0]
          );
        }
      }
      if (biggestPairOtherThanTheTrips != 0) {
        return new FullHouse(
          hasTrips,
          numberRepToCardValue(biggestPairOtherThanTheTrips)
        );
      }
    }

    if (hasFlush) {
      const flushCards = boardAndHoleCards
        .filter((card) => card.suit != hasFlush)
        .sort((c1, c2) => {
          const c1NumVal = cardValueToNumberRep(c1.value);
          const c2NumVal = cardValueToNumberRep(c2.value);
          return c2NumVal - c1NumVal;
        });
      if (flushCards.length < 5) {
        throw new Error(
          "Data corruption: Flush detected but less than five cards are same suit"
        );
      }
      return new Flush(
        flushCards[0].value,
        flushCards[1].value,
        flushCards[2].value,
        flushCards[3].value,
        flushCards[4].value
      );
    }

    if (hasStraight) {
      return new Straight(hasStraight);
    }

    if (hasTrips) {
      const nonTripCards = boardAndHoleCards
        .filter((card) => card.value != hasTrips)
        .sort((c1, c2) => {
          const c1NumVal = cardValueToNumberRep(c1.value);
          const c2NumVal = cardValueToNumberRep(c2.value);
          return c2NumVal - c1NumVal;
        });
      return new Trips(hasTrips, nonTripCards[0].value, nonTripCards[1].value);
    }

    // biggest pair
    let hasPair: false | CardValue = false;
    for (const cardValueFrequencyPair of cardValueMap.entries()) {
      let highestPairSeen = 0;
      if (
        cardValueFrequencyPair[1] == 2 &&
        cardValueToNumberRep(cardValueFrequencyPair[0]) > highestPairSeen
      ) {
        hasPair = cardValueFrequencyPair[0];
      }
    }
    // NOTE this also handles two pair
    if (hasPair) {
      let biggestPairOtherThanTheTopPair = 0;
      for (const cardValueFrequencyPair of cardValueMap.entries()) {
        if (
          cardValueFrequencyPair[1] == 2 &&
          cardValueToNumberRep(cardValueFrequencyPair[0]) >
            biggestPairOtherThanTheTopPair &&
          cardValueFrequencyPair[0] != hasPair
        ) {
          biggestPairOtherThanTheTopPair = cardValueToNumberRep(
            cardValueFrequencyPair[0]
          );
        }
      }
      if (biggestPairOtherThanTheTopPair != 0) {
        let highestValueSeenNotEitherPairValue = 0;
        for (const card of boardAndHoleCards) {
          if (
            cardValueToNumberRep(card.value) >
              highestValueSeenNotEitherPairValue &&
            card.value != hasPair &&
            card.value != numberRepToCardValue(biggestPairOtherThanTheTopPair)
          ) {
            highestValueSeenNotEitherPairValue = cardValueToNumberRep(
              card.value
            );
          }
        }
        return new TwoPair(
          hasPair,
          numberRepToCardValue(biggestPairOtherThanTheTopPair),
          numberRepToCardValue(highestValueSeenNotEitherPairValue)
        );
      } else {
        const nonPairCards = boardAndHoleCards
          .filter((card) => card.value != hasPair)
          .sort((c1, c2) => {
            const c1NumVal = cardValueToNumberRep(c1.value);
            const c2NumVal = cardValueToNumberRep(c2.value);
            return c2NumVal - c1NumVal;
          });
        return new Pair(
          hasPair,
          nonPairCards[0].value,
          nonPairCards[1].value,
          nonPairCards[2].value
        );
      }
    }

    // if none of them caught, then we play best 5 high cards
    const highCards = boardAndHoleCards.sort((c1, c2) => {
      const c1NumVal = cardValueToNumberRep(c1.value);
      const c2NumVal = cardValueToNumberRep(c2.value);
      return c2NumVal - c1NumVal;
    });

    return new HighCard(
      highCards[0].value,
      highCards[1].value,
      highCards[2].value,
      highCards[3].value,
      highCards[4].value
    );
  }
  // NOTE does not support PLO override yet
  protected dealUniqueHoleCards() {
    const deck: Card[] = shuffleArray(generateDeck());
    this.aliveSeatingArrangement.forEach((player) => {
      if (player.stack > 0) {
        const holeCards: Card[] = [];
        holeCards.push(deck.pop(), deck.pop());
        player.holeCards = holeCards;
      }
    });
  }
}

// An implementation of a PokerTable that is not yet supported
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

// A NLH PokerTable
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

// Represents all needed info about a bet that a player makes
export interface IBetAction {
  allIn: boolean;
  player: IPlayer;
  getAmount(): number;
}

// the interface adds an amount to the BetAction if needed
interface IBetActionWithAmount extends IBetAction {
  amount: number;
}

// Blind can be any of the three blinds
export class Blind implements IBetActionWithAmount {
  allIn: boolean;
  player: IPlayer;
  amount: number;
  getAmount() {
    return this.amount;
  }
}

// Bet requires a lead out on a new phase
export class Bet implements IBetActionWithAmount {
  allIn: boolean;
  player: IPlayer;
  amount: number;
  getAmount() {
    return this.amount;
  }
}

// Can call a blind, bet, or raise in the past
export class Call implements IBetActionWithAmount {
  allIn: boolean;
  player: IPlayer;
  amount: number;
  getAmount() {
    return this.amount;
  }
}

// Can raise a bet in the past
export class Raise implements IBetActionWithAmount {
  allIn: boolean;
  player: IPlayer;
  amount: number;
  getAmount() {
    return this.amount;
  }
}

// Can check as largest blind if limped around preflop or at the
// start of new betting phase given everyone before has checked
export class Check implements IBetAction {
  allIn: boolean;
  player: IPlayer;
  getAmount() {
    return 0;
  }
}

// Can fold to any bet, blind, or raise in the past
export class Fold implements IBetAction {
  allIn: boolean;
  player: IPlayer;
  constructor(player: IPlayer) {
    this.allIn = false;
    this.player = player;
  }
  getAmount() {
    return 0;
  }
}

// Represents a card
export class Card {
  readonly value: CardValue;
  readonly suit: CardSuit;

  constructor(value: CardValue, suit: CardSuit) {
    this.value = value;
    this.suit = suit;
  }
}

// The card values
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

// The card suits
export enum CardSuit {
  HEART = "HEART",
  DIAMOND = "DIAMOND",
  CLUB = "CLUB",
  SPADE = "SPADE",
}

// The phase of betting we are on
export enum BettingStage {
  PREFLOP = "PREFLOP",
  FLOP = "FLOP",
  TURN = "TURN",
  RIVER = "RIVER",
}

// Represents the best 5 card hand that can be made, with kickers
export interface IHand {
  // returns positive if first hand is better than the other hand, negative vise versa
  // returns 0 if both hands are the exact same strength
  compareHand(other: IHand): number;
}
// Worst class of hand
class HighCard implements IHand {
  firstKicker: CardValue;
  secondKicker: CardValue;
  thirdKicker: CardValue;
  fourthKicker: CardValue;
  fifthKicker: CardValue;
  constructor(
    firstKicker: CardValue,
    secondKicker: CardValue,
    thirdKicker: CardValue,
    fourthKicker: CardValue,
    fifthKicker: CardValue
  ) {
    this.firstKicker = firstKicker;
    this.secondKicker = secondKicker;
    this.thirdKicker = thirdKicker;
    this.fourthKicker = fourthKicker;
    this.fifthKicker = fifthKicker;
  }
  compareHand(other: IHand): number {
    if (other instanceof HighCard) {
      const kickersThis = [
        this.firstKicker,
        this.secondKicker,
        this.thirdKicker,
        this.fourthKicker,
        this.fifthKicker,
      ];
      const kickersOther = [
        other.firstKicker,
        other.secondKicker,
        other.thirdKicker,
        other.fourthKicker,
        other.fifthKicker,
      ];
      return compareArrays(kickersThis, kickersOther);
    } else {
      return -1;
    }
  }
}
// Beats high card
class Pair implements IHand {
  pair: CardValue;
  firstKicker: CardValue;
  secondKicker: CardValue;
  thirdKicker: CardValue;
  constructor(
    pair: CardValue,
    firstKicker: CardValue,
    secondKicker: CardValue,
    thirdKicker: CardValue
  ) {
    this.pair = pair;
    this.firstKicker = firstKicker;
    this.secondKicker = secondKicker;
    this.thirdKicker = thirdKicker;
  }
  compareHand(other: IHand): number {
    if (other instanceof HighCard) {
      return 1;
    } else if (other instanceof Pair) {
      const thisList = [
        this.pair,
        this.firstKicker,
        this.secondKicker,
        this.thirdKicker,
      ];
      const otherList = [
        other.pair,
        other.firstKicker,
        other.secondKicker,
        other.thirdKicker,
      ];
      return compareArrays(thisList, otherList);
    } else {
      return -1;
    }
  }
}
// Beats a pair and anything lower
class TwoPair implements IHand {
  highPair: CardValue;
  lowPair: CardValue;
  firstKicker: CardValue;
  constructor(highPair: CardValue, lowPair: CardValue, firstKicker: CardValue) {
    this.highPair = highPair;
    this.lowPair = lowPair;
    this.firstKicker = firstKicker;
  }
  compareHand(other: IHand): number {
    if (other instanceof HighCard || other instanceof Pair) {
      return 1;
    } else if (other instanceof TwoPair) {
      const thisList = [this.highPair, this.lowPair, this.firstKicker];
      const otherList = [other.highPair, other.lowPair, other.firstKicker];
      return compareArrays(thisList, otherList);
    } else {
      return -1;
    }
  }
}
// Beats two pair and anything lower
class Trips implements IHand {
  tripValue: CardValue;
  firstKicker: CardValue;
  secondKicker: CardValue;
  constructor(
    tripValue: CardValue,
    firstKicker: CardValue,
    secondKicker: CardValue
  ) {
    this.tripValue = tripValue;
    this.firstKicker = firstKicker;
    this.secondKicker = secondKicker;
  }
  compareHand(other: IHand): number {
    if (
      other instanceof HighCard ||
      other instanceof Pair ||
      other instanceof TwoPair
    ) {
      return 1;
    } else if (other instanceof Trips) {
      const thisList = [this.tripValue, this.firstKicker, this.secondKicker];
      const otherList = [
        other.tripValue,
        other.firstKicker,
        other.secondKicker,
      ];
      return compareArrays(thisList, otherList);
    } else {
      return -1;
    }
  }
}
// Beats trips and anything lower
class Straight implements IHand {
  highestCard: CardValue;
  constructor(highestCard: CardValue) {
    this.highestCard = highestCard;
  }
  compareHand(other: IHand): number {
    if (
      other instanceof HighCard ||
      other instanceof Pair ||
      other instanceof TwoPair ||
      other instanceof Trips
    ) {
      return 1;
    } else if (other instanceof Straight) {
      return compareArrays([this.highestCard], [other.highestCard]);
    } else {
      return -1;
    }
  }
}
// Beats straight and anything lower
class Flush implements IHand {
  firstKicker: CardValue;
  secondKicker: CardValue;
  thirdKicker: CardValue;
  fourthKicker: CardValue;
  fifthKicker: CardValue;
  constructor(
    firstKicker: CardValue,
    secondKicker: CardValue,
    thirdKicker: CardValue,
    fourthKicker: CardValue,
    fifthKicker: CardValue
  ) {
    this.firstKicker = firstKicker;
    this.secondKicker = secondKicker;
    this.thirdKicker = thirdKicker;
    this.fourthKicker = fourthKicker;
    this.fifthKicker = fifthKicker;
  }
  compareHand(other: IHand): number {
    if (
      other instanceof HighCard ||
      other instanceof Pair ||
      other instanceof TwoPair ||
      other instanceof Straight
    ) {
      return 1;
    } else if (other instanceof Flush) {
      const kickersThis = [
        this.firstKicker,
        this.secondKicker,
        this.thirdKicker,
        this.fourthKicker,
        this.fifthKicker,
      ];
      const kickersOther = [
        other.firstKicker,
        other.secondKicker,
        other.thirdKicker,
        other.fourthKicker,
        other.fifthKicker,
      ];
      return compareArrays(kickersThis, kickersOther);
    } else {
      return -1;
    }
  }
}
// Beats flush and anything lower
class FullHouse implements IHand {
  tripValue: CardValue;
  pairValue: CardValue;
  constructor(tripValue: CardValue, pairValue: CardValue) {
    this.tripValue = tripValue;
    this.pairValue = pairValue;
  }
  compareHand(other: IHand): number {
    if (
      other instanceof HighCard ||
      other instanceof Pair ||
      other instanceof TwoPair ||
      other instanceof Trips ||
      other instanceof Straight ||
      other instanceof Flush
    ) {
      return 1;
    } else if (other instanceof FullHouse) {
      return compareArrays(
        [this.tripValue, this.pairValue],
        [other.tripValue, other.pairValue]
      );
    } else {
      return -1;
    }
  }
}
// Beats full house and anything lower
class Quads implements IHand {
  quadValue: CardValue;
  firstKicker: CardValue;
  constructor(quadValue: CardValue, firstKicker: CardValue) {
    this.quadValue = quadValue;
    this.firstKicker = firstKicker;
  }
  compareHand(other: IHand): number {
    if (other instanceof StraightFlush) {
      return -1;
    } else if (other instanceof Quads) {
      return compareArrays(
        [this.quadValue, this.firstKicker],
        [other.quadValue, other.firstKicker]
      );
    } else {
      return 1;
    }
  }
}
// Beats everything, royal flush -> highestCard = CardValue.Ace
class StraightFlush implements IHand {
  highestCard: CardValue;
  constructor(highestCard: CardValue) {
    this.highestCard = highestCard;
  }
  compareHand(other: IHand): number {
    if (other instanceof StraightFlush) {
      return compareArrays([this.highestCard], [other.highestCard]);
    } else {
      return 1;
    }
  }
}
