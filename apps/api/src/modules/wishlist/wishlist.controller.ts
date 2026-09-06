import { Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { RequestUser } from '../auth/auth.types';
import { WishlistService } from './wishlist.service';

@Controller('wishlist')
export class WishlistController {
  constructor(private readonly wishlist: WishlistService) {}

  @Get()
  list(@CurrentUser() user: RequestUser) {
    return this.wishlist.list(user.id);
  }

  @Post(':propertyId')
  add(
    @CurrentUser() user: RequestUser,
    @Param('propertyId') propertyId: string,
  ) {
    return this.wishlist.add(user.id, propertyId);
  }

  @Delete(':propertyId')
  remove(
    @CurrentUser() user: RequestUser,
    @Param('propertyId') propertyId: string,
  ) {
    return this.wishlist.remove(user.id, propertyId);
  }
}
