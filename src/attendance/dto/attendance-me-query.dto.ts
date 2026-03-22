import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsMongoId, IsOptional } from 'class-validator';

export class AttendanceMeQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by course ObjectId',
    example: '60d5ec49f1b2c8b1f8e4e1a2',
  })
  @IsOptional()
  @IsMongoId()
  courseId?: string;
}
