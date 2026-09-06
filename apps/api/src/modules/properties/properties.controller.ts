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
import {
  CurrentUser,
  CurrentUserOptional,
} from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRoles } from '../../common/constants/roles';
import type { RequestUser } from '../auth/auth.types';
import {
  CreatePropertyDto,
  ListPropertiesQueryDto,
  UpdatePropertyDto,
} from './dto/property.dto';
import { PropertiesService } from './properties.service';

@Controller('properties')
export class PropertiesController {
  constructor(private readonly properties: PropertiesService) {}

  @Roles(UserRoles.OWNER)
  @Post()
  create(@CurrentUser() user: RequestUser, @Body() dto: CreatePropertyDto) {
    return this.properties.create(user, dto);
  }

  @Public()
  @Get()
  list(
    @Query() query: ListPropertiesQueryDto,
    @CurrentUserOptional() user?: RequestUser,
  ) {
    return this.properties.list(query, user);
  }

  @Public()
  @Get(':id')
  getById(@Param('id') id: string, @CurrentUserOptional() user?: RequestUser) {
    return this.properties.getById(id, user);
  }

  @Roles(UserRoles.OWNER)
  @Patch(':id')
  update(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: UpdatePropertyDto,
  ) {
    return this.properties.update(id, user, dto);
  }

  @Roles(UserRoles.OWNER)
  @Delete(':id')
  remove(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.properties.remove(id, user);
  }
}
