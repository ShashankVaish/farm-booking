import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRoles } from '../../common/constants/roles';
import type { RequestUser } from '../auth/auth.types';
import { AmenitiesService } from './amenities.service';

export class CreateAmenityDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  icon?: string;
}

export class UpdateAmenityDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  icon?: string;
}

@Controller()
export class AmenitiesController {
  constructor(private readonly amenities: AmenitiesService) {}

  @Public()
  @Get('amenities')
  list() {
    return this.amenities.list();
  }

  @Roles(UserRoles.ADMIN)
  @Post('admin/amenities')
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateAmenityDto) {
    return this.amenities.create(dto, user.id);
  }

  @Roles(UserRoles.ADMIN)
  @Patch('admin/amenities/:id')
  update(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: UpdateAmenityDto,
  ) {
    return this.amenities.update(id, dto, user.id);
  }

  @Roles(UserRoles.ADMIN)
  @Delete('admin/amenities/:id')
  remove(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.amenities.remove(id, user.id);
  }
}
