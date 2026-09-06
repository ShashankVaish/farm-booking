import { Prisma } from '@prisma/client';

export type Money = Prisma.Decimal;

export function money(value: Prisma.Decimal | number | string): Prisma.Decimal {
  return new Prisma.Decimal(value).toDecimalPlaces(
    2,
    Prisma.Decimal.ROUND_HALF_UP,
  );
}

export function addMoney(
  ...values: Array<Prisma.Decimal | number | string>
): Prisma.Decimal {
  return money(
    values.reduce<Prisma.Decimal>(
      (sum, value) => sum.plus(money(value)),
      new Prisma.Decimal(0),
    ),
  );
}

export function subtractMoney(
  left: Prisma.Decimal | number | string,
  right: Prisma.Decimal | number | string,
): Prisma.Decimal {
  return money(money(left).minus(money(right)));
}

export function multiplyMoney(
  value: Prisma.Decimal | number | string,
  factor: Prisma.Decimal | number | string,
): Prisma.Decimal {
  return money(money(value).times(factor));
}

export function moneyToPaise(value: Prisma.Decimal | number | string): number {
  return money(value)
    .mul(100)
    .toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP)
    .toNumber();
}

export function paiseToMoney(paise: number): Prisma.Decimal {
  return money(new Prisma.Decimal(paise).div(100));
}

export function moneyToNumber(value: Prisma.Decimal | number | string): number {
  return money(value).toNumber();
}
