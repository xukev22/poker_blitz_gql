// A TableOverview is for information relevant to a table regardless of whether there is an active game (essentially these fields will rarely change once initialized)
// it has a table name, a starting stack (in BBs), a starting SB value (in BBs), a starting BB value (in SBs), a starting ST value (in BBs),
// a decision time (in seconds), rotations until blinds increase (1-N acceptable, null means blinds never increase), blindIncreaseRatio (should be anything 1 to N exclusive, null means blinds never increase),
// the poker variant, and the max amount of players that start at the table
// ALL numeric values are integers except blind increase ratio, which is a float
export interface TableOverview {
  name: String;
  startingStack: number;
  startingSB: number;
  startingBB: number;
  startingST: number;
  decisionTime: number;
  handsUntilBlindsIncrease?: number;
  blindIncreaseRatio?: number;
  variant: PokerVariants;
  maxPlayers: number;
}

// currently we plan to support No Limit Texas Hold'em and Pot Limit Omaha
export enum PokerVariants {
  NLH = "NLH",
  PLO = "PLO",
}

// A Table is for information of an active table,
// which has a table id, the table overview info (see above), a currentSB value, a currentBB value, a currentST value, all in BBs.
// a current hand number (from 0 to N, 0 means game not started, 1 to N means active game),
// an option (which stores whose turn it is by playerID, if null means that it is currently no ones turn aka that the hand has not started)
// Also has a seating arrangement, which stores all information the player and table share (i.e stores hole cards, betting history, stacks, etc.) AND the order of the list matters
// flop stores the cards dealt out, null means currently no cards dealt to flop
// corresponding behavior for turn and river
// also a list of starting elos before the table started for elo calculation
export default interface Table {
  id: number;
  tableOverview: TableOverview;
  currentSB: number;
  currentBB: number;
  currentST: number;
  tableInProgress: boolean;
  handInProgress: boolean;
  bettingStage?: BettingStage;
  pot?: Map<number, PokerAction>;
  bettingLog?: Map<number, PokerAction[]>;
  hand?: number;
  option?: number;
  bettingLead?: number;
  flop?: Card[];
  turn?: Card;
  river?: Card;
  seatingArrangement: PlayerTableConnection[];
  elos: number[];
}

export enum BettingStage {
  PREFLOP = "PREFLOP",
  FLOP = "FLOP",
  TURN = "TURN",
  RIVER = "RIVER",
  SHOWDOWN = "SHOWDOWN",
  RUNOUT = "RUNOUT",
}

// A PlayerTableConnection stores information about the player sitting at a table,
// bridging the player and table by playerID and tableID,
// stack represents the amount of BBs this player has,
// holeCards represent the cards they have, null meaning are not in the hand/hand not active
// bettingHistory represents the sequence of betting actions they took this hand, null meaning they are not in a hand yet
// ALL numeric values are integers
export interface PlayerTableConnection {
  playerID: number;
  tableID: number;
  stack: number;
  holeCards?: Card[];
}

// All numeric values are integers
// amount is optional when it is not applicable to action type
export interface PokerAction {
  action: BetActionType;
  stage: BettingStage;
  amount?: number;
}

// Possible Actions:
export enum BetActionType {
  SB = "SB",
  BB = "BB",
  ST = "ST",
  CHECK = "CHECK",
  FOLD = "FOLD",
  BET = "BET",
  RAISE = "RAISE",
  CALL = "CALL",
  ALL_IN_BET = "ALL_IN_BET",
  ALL_IN_CALL = "ALL_IN_CALL",
  ALL_IN_RAISE = "ALL_IN_RAISE",
  ALL_IN_FORCED_BLIND = "ALL_IN_FORCED_BLIND",
  SHOW = "SHOW",
  SHOWDOWN_WAITING = "SHOWDOWN_WAITING",
  MUCK = "MUCK",
}

// A Card has a value and a suit
export interface Card {
  value: Value;
  suit: Suit;
}

// Card values Ace to King
export enum Value {
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

// Four standard suits
export enum Suit {
  HEART = "HEART",
  DIAMOND = "DIAMOND",
  CLUB = "CLUB",
  SPADE = "SPADE",
}
