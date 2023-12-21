// Returns a new array that is a shuffled version of the given array
export function shuffleArray<T>(array: T[]): T[] {
  const shuffledArray = [...array]; // Create a shallow copy of the array

  for (let i = shuffledArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1)); // Random index from 0 to i

    // Swap elements at i and j
    [shuffledArray[i], shuffledArray[j]] = [shuffledArray[j], shuffledArray[i]];
  }

  return shuffledArray;
}

// Returns the new calculated elo based on the current elo, finish position,
// and list of all elos (including this player) at the table
// finishPosition is from 1 to elos.length inclusive
export function calculateNewElo(
  elo: number,
  finishPosition: number,
  elos: number[]
) {
  const startPlayerCount = elos.length;
  if (finishPosition < 1 || finishPosition > startPlayerCount) {
    throw new Error("Finish position is invalid");
  }

  return elo + Math.floor(Math.random() * 100) - 50;
}
