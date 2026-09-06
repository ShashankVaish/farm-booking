import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRoles } from '../../common/constants/roles';
import {
  ConfirmLocationDto,
  LocationSearchQueryDto,
  ReverseGeocodeDto,
} from './dto/location.dto';
import { LocationsService } from './locations.service';

@Controller('locations')
@Roles(UserRoles.OWNER)
export class LocationsController {
  constructor(private readonly locations: LocationsService) {}

  @Get('search')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  search(@Query() query: LocationSearchQueryDto) {
    return this.locations.search(query.q);
  }

  @Post('reverse')
  reverse(@Body() dto: ReverseGeocodeDto) {
    return this.locations.reverse(dto);
  }

  @Post('confirm')
  confirm(@Body() dto: ConfirmLocationDto) {
    return this.locations.confirm(dto);
  }
}
