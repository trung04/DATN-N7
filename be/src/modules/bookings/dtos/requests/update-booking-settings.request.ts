import { ValidateBy } from 'class-validator';

export class UpdateBookingSettingsRequest {
  @ValidateBy({
    name: 'isBookingCommissionRate',
    validator: {
      validate: (value: unknown) => typeof value === 'number' && value >= 0 && value <= 100 &&
        Number(value.toFixed(2)) === value,
      defaultMessage: () => 'Hoa hồng phải từ 0% đến 100%, với tối đa 2 chữ số thập phân.',
    },
  })
  commissionRate: number;
}
