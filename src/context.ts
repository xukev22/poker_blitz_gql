// STARTING ID VALUES
let playerIDGen = 51;
let tableIDGen = 6;

// generate a playerID and update the counter
export function getPlayerID() {
  return playerIDGen++;
}

// generate a tableID and update the counter
export function getTableID() {
  return tableIDGen++;
}
