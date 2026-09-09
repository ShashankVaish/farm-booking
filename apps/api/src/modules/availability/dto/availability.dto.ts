import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsOptional,
  IsString,
} from 'class-validator';

export class AvailabilityQueryDto {
  @IsDateString()
  from!: string;

  @IsDateString()
  to!: string;
}

export class BlockDatesDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(366)
  @IsDateString({}, { each: true })
  dates!: string[];

  @IsOptional()
  @IsString()
  notes?: string;
}
