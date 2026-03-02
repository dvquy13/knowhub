export class KnowhubError extends Error {
  constructor(
    message: string,
    public readonly exitCode: number = 1,
    public readonly hint?: string
  ) {
    super(message);
    this.name = 'KnowhubError';
  }
}
