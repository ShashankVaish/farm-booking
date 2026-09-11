import { Reflector } from '@nestjs/core';
import { BookingsController } from './bookings.controller';
import { ROLES_KEY } from '../../common/decorators/roles.decorator';
import { UserRoles } from '../../common/constants/roles';

/*
  The service already refuses a host booking their own property, but the roles
  guard runs first and never reaches it. A CUSTOMER-only guard here made
  "become a host" a one-way door — listing a property took away the ability to
  book one — and no service test could have caught it. This asserts the guard
  metadata directly.
*/
describe('BookingsController role metadata', () => {
  const reflector = new Reflector();

  it('lets both guests and hosts create a booking', () => {
    const roles = reflector.get<string[]>(
      ROLES_KEY,
      BookingsController.prototype.create,
    );
    expect(roles).toEqual(
      expect.arrayContaining([UserRoles.CUSTOMER, UserRoles.OWNER]),
    );
  });
});
