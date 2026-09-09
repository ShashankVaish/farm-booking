import { Controller, Get, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../../common/decorators/public.decorator';
import { SearchQueryDto } from './dto/search-query.dto';
import { SearchService } from './search.service';

@Controller('search')
export class SearchController {
  constructor(private readonly search: SearchService) {}

  @Public()
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @Get()
  query(@Query() query: SearchQueryDto) {
    return this.search.search(query);
  }
}
