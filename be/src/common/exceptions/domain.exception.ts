export type DomainExceptionCategory =
  'validation' | 'unauthorized' | 'not_found' | 'conflict';

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
