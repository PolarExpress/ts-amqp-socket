export class PanicError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PanicError";
  }
}

/**
 * Throws a `PanicError` with the given message.
 * @param message - The message to include in the error.
 */
export const panic = (message: string): never => {
  throw new PanicError(message);
};