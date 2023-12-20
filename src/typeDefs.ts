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
    hand: Int!
    option: Player
    flop: [Card!]
    turn: Card
    river: Card
    seatingArrangement: [PlayerInfo!]!
  }

  type PlayerInfo {
    player: Player!
    stack: Int!
    holeCards: [Card!]
    bettingHistory: [PokerAction!]
  }

  type PokerAction {
    action: BetActionType!
    amount: Int
  }

  type TableOverview {
    name: String!
    startingStack: Int!
    startingSB: Int!
    startingBB: Int!
    startingST: Int!
    decisionTime: Int!
    rotationsUntilBlindsIncrease: Int
    blindIncreaseRatio: Float
    variant: PokerVariants!
    maxPlayers: Int!
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
  }

  type Mutation {
    addPlayer(player: AddPlayerInput!): Player
    deletePlayer(id: ID!): [Player]
    addTable(tableOverview: AddTableInput!): Table
    deleteTable(id: ID!): [Table]
    updatePlayer(id: ID!, edits: EditPlayerInput!): Player
    updateTable(id: ID!, edits: EditTableInput!): Table
    joinTable(playerID: ID!, tableID: ID!): Boolean
    leaveTable(playerID: ID!): Boolean
    startTable(tableID: ID!): Boolean
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
    rotationsUntilBlindsIncrease: Int
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
    rotationsUntilBlindsIncrease: Int
    blindIncreaseRatio: Float
    variant: PokerVariants
    maxPlayers: Int
  }

`;
export default typeDefs;
