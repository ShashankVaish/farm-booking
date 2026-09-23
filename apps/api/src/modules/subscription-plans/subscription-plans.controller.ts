import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRoles } from '../../common/constants/roles';
import type { RequestUser } from '../auth/auth.types';
import {
  CreateSubscriptionPlanDto,
  UpdateSubscriptionPlanDto,
} from './dto/subscription-plan.dto';
import { SubscriptionPlansService } from './subscription-plans.service';

@Controller()
export class SubscriptionPlansController {
  constructor(private readonly plans: SubscriptionPlansService) {}

  // Public: plan prices are not secret, and a would-be host can read them
  // before signing in.
  @Public()
  @Get('subscription-plans')
  listActive() {
    return this.plans.listActive();
  }

  @Roles(UserRoles.ADMIN)
  @Get('admin/subscription-plans')
  listAll() {
    return this.plans.listAll();
  }

  @Roles(UserRoles.ADMIN)
  @Post('admin/subscription-plans')
  create(
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateSubscriptionPlanDto,
  ) {
    return this.plans.create(dto, user.id);
  }

  @Roles(UserRoles.ADMIN)
  @Patch('admin/subscription-plans/:id')
  update(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: UpdateSubscriptionPlanDto,
  ) {
    return this.plans.update(id, dto, user.id);
  }

  @Roles(UserRoles.ADMIN)
  @Delete('admin/subscription-plans/:id')
  remove(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.plans.remove(id, user.id);
  }
}
