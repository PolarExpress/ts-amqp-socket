/*
 * This program has been developed by students from the bachelor
 * Computer Science at Utrecht University within the Software Project course.
 *
 * © Copyright Utrecht University
 * (Department of Information and Computing Sciences)
 */

export class PanicError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PanicError";
  }
}

/**
 * Throws a `PanicError` with the given message.
 *
 * @param message - The message to include in the error.
 */
export const panic = (message: string): never => {
  throw new PanicError(message);
};
