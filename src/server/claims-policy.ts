export const MAX_CLAIMS_PER_SESSION = 25;

export class ClaimLimitError extends Error {
  constructor(readonly limit = MAX_CLAIMS_PER_SESSION) {
    super(`A session can own at most ${limit} claims.`);
    this.name = "ClaimLimitError";
  }
}
