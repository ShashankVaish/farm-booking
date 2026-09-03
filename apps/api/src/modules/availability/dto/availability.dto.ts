import {
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
  @IsDateString({}, { each: true })
  dates!: string[];

  @IsOptional()
  @IsString()
  notes?: string;
}
