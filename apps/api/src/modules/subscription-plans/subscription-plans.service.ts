import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditActions, AuditService } from '../../common/audit.service';
import { ErrorCodes } from '../../common/constants/error-codes';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  CreateSubscriptionPlanDto,
  UpdateSubscriptionPlanDto,
} from './dto/subscription-plan.dto';

const PLAN_ORDER = [
  { sortOrder: 'asc' as const },
  { monthlyPrice: 'asc' as const },
];

@Injectable()
export class SubscriptionPlansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // What hosts see: live plans only, cheapest first within the same position.
  listActive() {
    return this.prisma.subscriptionPlan.findMany({
      where: { isActive: true },
      orderBy: PLAN_ORDER,
    });
  }

  listAll() {
    return this.prisma.subscriptionPlan.findMany({ orderBy: PLAN_ORDER });
  }

  async create(dto: CreateSubscriptionPlanDto, actorId: string) {
    const plan = await this.prisma.subscriptionPlan.create({
      data: {
        name: dto.name.trim(),
        description: dto.description?.trim() || null,
        monthlyPrice: dto.monthlyPrice,
        listingLimit: dto.listingLimit ?? null,
        features: dto.features ?? [],
        isActive: dto.isActive ?? true,
        isFeatured: dto.isFeatured ?? false,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
    await this.audit.record({
      actorId,
      action: AuditActions.SUBSCRIPTION_PLAN_CREATED,
      entityType: 'SubscriptionPlan',
      entityId: plan.id,
      metadata: { name: plan.name, monthlyPrice: plan.monthlyPrice.toString() },
    });
    return plan;
  }

  async update(id: string, dto: UpdateSubscriptionPlanDto, actorId: string) {
    await this.ensure(id);
    const plan = await this.prisma.subscriptionPlan.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        description:
          dto.description === undefined
            ? undefined
            : dto.description.trim() || null,
        monthlyPrice: dto.monthlyPrice,
        listingLimit: dto.listingLimit,
        features: dto.features,
        isActive: dto.isActive,
        isFeatured: dto.isFeatured,
        sortOrder: dto.sortOrder,
      },
    });
    await this.audit.record({
      actorId,
      action: AuditActions.SUBSCRIPTION_PLAN_UPDATED,
      entityType: 'SubscriptionPlan',
      entityId: id,
      metadata: { name: plan.name, monthlyPrice: plan.monthlyPrice.toString() },
    });
    return plan;
  }

  async remove(id: string, actorId: string) {
    await this.ensure(id);
    await this.prisma.subscriptionPlan.delete({ where: { id } });
    await this.audit.record({
      actorId,
      action: AuditActions.SUBSCRIPTION_PLAN_DELETED,
      entityType: 'SubscriptionPlan',
      entityId: id,
    });
    return { deleted: true };
  }

  private async ensure(id: string) {
    const plan = await this.prisma.subscriptionPlan.findUnique({
      where: { id },
    });
    if (!plan) {
      throw new NotFoundException({
        errorCode: ErrorCodes.NOT_FOUND,
        message: 'Subscription plan not found.',
      });
    }
  }
}
