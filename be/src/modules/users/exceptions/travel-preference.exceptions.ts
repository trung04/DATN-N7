import { DomainException } from '../../../common/exceptions/domain.exception';

export class InvalidTravelPreferenceInterestException extends DomainException {
  constructor() {
    super(
      'One or more selected travel interests are not supported.',
      'INVALID_TRAVEL_PREFERENCE_INTEREST',
      'validation',
    );
  }
}
