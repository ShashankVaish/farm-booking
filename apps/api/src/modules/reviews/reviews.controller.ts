import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { normalizePagination } from '../../common/pagination';
import type { RequestUser } from '../auth/auth.types';
import { CreateReviewDto, UpdateReviewDto } from './dto/review.dto';
import { ReviewsService } from './reviews.service';

@Controller()
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Post('properties/:id/reviews')
  create(
    @CurrentUser() user: RequestUser,
    @Param('id') propertyId: string,
    @Body() dto: CreateReviewDto,
  ) {
    return this.reviews.create(propertyId, user, dto);
  }

  @Public()
  @Get('properties/:id/reviews')
  list(@Param('id') propertyId: string, @Query() query: PaginationQueryDto) {
    const { page, limit } = normalizePagination(query.page, query.limit);
    return this.reviews.list(propertyId, page, limit);
  }

  @Patch('reviews/:id')
  update(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: UpdateReviewDto,
  ) {
    return this.reviews.update(id, user, dto);
  }

  @Delete('reviews/:id')
  remove(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.reviews.remove(id, user);
  }
}
