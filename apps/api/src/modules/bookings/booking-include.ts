/**
 * The shape every endpoint that returns a booking to the customer must use.
 *
 * It lives in its own file so both BookingsService and PaymentsService can
 * import it without the two service files importing each other. Returning a
 * thinner booking from one endpoint breaks clients that replace their state
 * with the response — the checkout page crashed on `booking.property.title`
 * after a reconcile poll returned a booking with no property.
 */
export const bookingDetailInclude = {
  property: {
    select: {
      id: true,
      title: true,
      ownerId: true,
      city: true,
      state: true,
      location: true,
      address: true,
      cancellationPolicy: true,
      guestCapacity: true,
      images: { take: 1, orderBy: { sortOrder: 'asc' as const } },
    },
  },
  payments: { orderBy: { createdAt: 'desc' as const } },
  coupon: { select: { code: true } },
  review: { select: { id: true, rating: true } },
} as const;
