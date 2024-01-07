// A schema is a collection of type definitions (hence "typeDefs")
// that together define the "shape" of queries that are executed against
// your data.
const typeDefs = `#graphql
  # Comments in GraphQL strings (such as this one) start with the hash (#) symbol.

  type Player {
    id: ID!
    username: String!
    elo: Int!
    table: Table
  }

  type Table {
    id: ID!
    tableOverview: TableOverview!
    currentSB: Int!
    currentBB: Int!
    currentST: Int!
    tableInProgress: Boolean!
    handInProgress: Boolean!
    pot: [PotEntryMostRecent!]
    potSize: Int
    bettingLog: [PotEntryAll!]
    hand: Int
    option: Player
    bettingLead: Player
    flop: [Card!]
    turn: Card
    river: Card
    seatingArrangement: [PlayerInfo!]!
    elos: [Int!]!
  }

  type PotEntryMostRecent {
    key: Int!
    value: PokerAction!
  }

  type PotEntryAll {
    key: Int!
    value: [PokerAction!]!
  }

  type PlayerInfo {
    player: Player!
    stack: Int!
    holeCards: [Card!]
  }

  type PokerAction {
    action: BetActionType!
    stage: BettingStage
    amount: Int
  }

  type TableOverview {
    name: String!
    startingStack: Int!
    startingSB: Int!
    startingBB: Int!
    startingST: Int!
    decisionTime: Int!
    handsUntilBlindsIncrease: Int
    blindIncreaseRatio: Float
    variant: PokerVariants!
    maxPlayers: Int!
  }

  enum BettingStage {
    PREFLOP
    FLOP
    TURN
    RIVER
    SHOWDOWN
    RUNOUT
  }

  enum PokerVariants {
    NLH
    PLO
  }

  enum BetActionType {
    SB
    BB
    ST
    CHECK
    FOLD
    BET
    RAISE
    CALL
    ALL_IN_BET
    ALL_IN_CALL
    ALL_IN_RAISE
    ALL_IN_FORCED_BLIND
    SHOW
    SHOWDOWN_WAITING
    MUCK
  }

  type Card {
    value: Value!
    suit: Suit!
  }

  enum Value {
    ACE
    TWO
    THREE
    FOUR
    FIVE
    SIX
    SEVEN
    EIGHT
    NINE
    TEN
    JACK
    QUEEN
    KING
  }

  enum Suit {
    HEART
    DIAMOND
    CLUB
    SPADE
  }

  # The "Query" type is special: it lists all of the available queries that
  # clients can execute, along with the return type for each. In this
  # case, the "books" query returns an array of zero or more Books (defined above).
  type Query {
    players: [Player]
    tables: [Table]
    getPlayer(id: ID!): Player
    getTable(id: ID!): Table
  }

  type Mutation {
    addPlayer(player: AddPlayerInput!): Player
    deletePlayer(id: ID!): [Player]
    addTable(tableOverview: AddTableInput!): Table
    deleteTable(id: ID!): [Table]
    updatePlayer(id: ID!, edits: EditPlayerInput!): Player
    updateTable(id: ID!, edits: EditTableInput!): Table
    joinTable(playerID: ID!, tableID: ID!): Boolean
    leaveTableQueue(playerID: ID!): Boolean
    leaveTable(playerID: ID!): Boolean
    startTable(tableID: ID!): Boolean
    forfeitTable(playerID: ID!): Boolean
    startHand(tableID: ID!): Boolean
    fold(playerID: ID!): Boolean
    check(playerID: ID!): Boolean
    call(playerID: ID!): Boolean
    bet(playerID: ID!, betAmount: Number): Boolean
    raise(playerID: ID!, raiseAmount: Number!): Boolean
    allIn(playerID: ID!): Boolean
  }

  input AddPlayerInput {
    username: String!
  }

  input AddTableInput {
    name: String!
    startingStack: Int!
    startingSB: Int!
    startingBB: Int!
    startingST: Int!
    decisionTime: Int!
    handsUntilBlindsIncrease: Int
    blindIncreaseRatio: Float
    variant: PokerVariants!
    maxPlayers: Int!
  }

  input EditPlayerInput {
    username: String
  }

  input EditTableInput {
    name: String
    startingStack: Int
    startingSB: Int
    startingBB: Int
    startingST: Int
    decisionTime: Int
    handsUntilBlindsIncrease: Int
    blindIncreaseRatio: Float
    variant: PokerVariants
    maxPlayers: Int
  }

`;
export default typeDefs;
