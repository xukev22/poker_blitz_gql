// A TableOverview is for information relevant to a table regardless of whether there is an active game
// it has a table name, a starting stack (in BBs), a starting SB value (in BBs), a starting BB value (in SBs), a starting ST value (in BBs),
// a decision time (in seconds), rotations until blinds increase (1-N acceptable, null means blinds never increase), blindIncreaseRatio (should be anything 1 to N exclusive, null means blinds never increase),
// the poker variant, and the max amount of players that start at the table
// all values are integers except blind increase ratio
export interface TableOverview {
  name: String;
  startingStack: number;
  startingSB: number;
  startingBB: number;
  startingST: number;
  decisionTime: number;
  rotationsUntilBlindsIncrease?: number;
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
// a current hand number (from 0 to N, 0 means game not started, 1 to N means active game), an option (which stores whose turn it is by playerID, if null means that it is currently no ones turn),
// also has a PlayerTableConnection, which stores all information the player and table share AND the ordering matters (i.e stores hole cards, betting history, stacks, etc.)
// flop stores the cards dealt out, null means currently no cards dealt to flop
// corresponding behavior for turn and river
export default interface Table {
  id: number;
  tableOverview: TableOverview;
  currentSB: number;
  currentBB: number;
  currentST: number;
  hand: number;
  option?: number;
  flop?: Card[];
  turn?: Card;
  river?: Card;
  seatingArrangement: PlayerTableConnection[];
}

// A PlayerTableConnection stores information about the player sitting at a table, bridges the playerID and tableID,
// stack represents the amount of BBs this player has, holeCards represent the cards they have, null meaning are not in a hand yet,
// bettingHistory represents the sequence of betting actions they took this hand, null meaning they are not in a hand yet
export interface PlayerTableConnection {
  playerID: number;
  tableID: number;
  stack: number;
  holeCards?: Card[];
  bettingHistory?: PokerAction[];
}

// amount is optional when it is not applicable to action type
export interface PokerAction {
  action: BetActionType;
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
