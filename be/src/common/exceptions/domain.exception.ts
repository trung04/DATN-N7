export type DomainExceptionCategory =
  | 'validation'
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'conflict'
  | 'bad_gateway'
  | 'rate_limited'
  | 'service_unavailable';

export abstract class DomainException extends Error {
  protected constructor(
    message: string,
    readonly code: string,
    readonly category: DomainExceptionCategory,
  ) {
    super(message);
    this.name = new.target.name;
  }
}
