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
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRoles } from '../../common/constants/roles';
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
  create(@Body() dto: CreateAmenityDto) {
    return this.amenities.create(dto);
  }

  @Roles(UserRoles.ADMIN)
  @Patch('admin/amenities/:id')
  update(@Param('id') id: string, @Body() dto: UpdateAmenityDto) {
    return this.amenities.update(id, dto);
  }

  @Roles(UserRoles.ADMIN)
  @Delete('admin/amenities/:id')
  remove(@Param('id') id: string) {
    return this.amenities.remove(id);
  }
}
