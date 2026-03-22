import { IsBoolean, IsMongoId, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class MarkAttendanceDto {
  @ApiProperty({
    example: '60d5ec49f1b2c8b1f8e4e1a1',
    description: 'MongoDB ObjectId of the student',
  })
  @IsMongoId()
  @IsNotEmpty()
  studentId: string;

  @ApiProperty({
    example: '60d5ec49f1b2c8b1f8e4e1a2',
    description: 'MongoDB ObjectId of the course',
  })
  @IsMongoId()
  @IsNotEmpty()
  courseId: string;

  @ApiProperty({
    example: true,
    description: 'True for Present, False for Absent',
  })
  @IsBoolean()
  @IsNotEmpty()
  status: boolean;
}
