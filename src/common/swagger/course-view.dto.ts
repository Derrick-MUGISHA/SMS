import { ApiProperty } from '@nestjs/swagger';

/** Shape returned for course list/detail in API responses (documentation). */
export class CourseViewDto {
  @ApiProperty({ example: '674a1b2c3d4e5f6789abcdef' })
  id: string;

  @ApiProperty({ example: 'Data Structures' })
  courseName: string;

  @ApiProperty({ example: 'Core algorithms and structures' })
  description: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
