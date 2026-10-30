/** Domain errors carry the required prefix without depending on terminal IO. */
export class ModelError extends Error {
  constructor(message: string) {
    super(`error: ${message.replace(/[\r\n]+/g, " ")}`);
    this.name = "ModelError";
  }
}
