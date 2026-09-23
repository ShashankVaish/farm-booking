import { NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditActions } from '../../common/audit.service';
import { SubscriptionPlansService } from './subscription-plans.service';

function setup(existing: unknown = { id: 'p1' }) {
  const plan = {
    id: 'p1',
    name: 'Pro',
    monthlyPrice: new Prisma.Decimal(999),
  };
  const prisma = {
    subscriptionPlan: {
      findMany: jest.fn().mockResolvedValue([plan]),
      findUnique: jest.fn().mockResolvedValue(existing),
      create: jest.fn().mockResolvedValue(plan),
      update: jest.fn().mockResolvedValue(plan),
      delete: jest.fn().mockResolvedValue(plan),
    },
  };
  const audit = { record: jest.fn() };
  const service = new SubscriptionPlansService(prisma as never, audit as never);
  return { prisma, audit, service };
}

describe('SubscriptionPlansService', () => {
  it('lists only active plans for hosts, ordered for display', async () => {
    const { prisma, service } = setup();
    await service.listActive();
    expect(prisma.subscriptionPlan.findMany).toHaveBeenCalledWith({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { monthlyPrice: 'asc' }],
    });
  });

  it('creates a plan with defaults and audits it', async () => {
    const { prisma, audit, service } = setup();
    await service.create({ name: '  Pro ', monthlyPrice: 999 }, 'admin-1');
    expect(prisma.subscriptionPlan.create).toHaveBeenCalledWith({
      data: {
        name: 'Pro',
        description: null,
        monthlyPrice: 999,
        listingLimit: null,
        features: [],
        isActive: true,
        isFeatured: false,
        sortOrder: 0,
      },
    });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: 'admin-1',
        action: AuditActions.SUBSCRIPTION_PLAN_CREATED,
        entityId: 'p1',
      }),
    );
  });

  it('can switch a plan to unlimited listings with null', async () => {
    const { prisma, service } = setup();
    await service.update('p1', { listingLimit: null }, 'admin-1');
    expect(prisma.subscriptionPlan.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'p1' },
        data: expect.objectContaining({ listingLimit: null, name: undefined }),
      }),
    );
  });

  it('returns not found when updating or deleting a missing plan', async () => {
    const { prisma, service } = setup(null);
    await expect(
      service.update('missing', { name: 'X' }, 'admin-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.remove('missing', 'admin-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.subscriptionPlan.delete).not.toHaveBeenCalled();
  });
});
