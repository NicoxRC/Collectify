import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { CreatePaymentDto } from './createPayment.dto';

// TESTING.md doesn't require DTO unit tests in general ("no logic to
// test"), but docs/phases/PHASE_12_PAYMENT_ATTACHMENTS.md explicitly lists
// "invalid imageUrl is rejected by DTO validation" as mandatory test scope
// for this phase — @IsUrl is the only actual validation logic imageUrl
// carries, so it's tested directly here rather than only indirectly
// through a service/controller test.
describe('CreatePaymentDto', () => {
  const baseInput = { amountPaid: 150000, paidAt: '2026-07-09' };

  it('is valid without imageUrl', async () => {
    const dto = plainToInstance(CreatePaymentDto, baseInput);
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('is valid with a well-formed imageUrl', async () => {
    const dto = plainToInstance(CreatePaymentDto, {
      ...baseInput,
      imageUrl: 'https://res.cloudinary.com/demo/image/upload/receipt.jpg',
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects a malformed imageUrl', async () => {
    const dto = plainToInstance(CreatePaymentDto, {
      ...baseInput,
      imageUrl: 'not-a-url',
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('imageUrl');
    expect(errors[0].constraints).toHaveProperty('isUrl');
  });
});
