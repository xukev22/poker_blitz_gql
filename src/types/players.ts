// A player has a uniquely identifying username,
// an elo, and a tableID that they are seated at,
// null representing they are not seated at a table currently
// all values are integers
export default interface Player {
  id: number;
  username: String;
  elo: number;
  table?: number;
}
