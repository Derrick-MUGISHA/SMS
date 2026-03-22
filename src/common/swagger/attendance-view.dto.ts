import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class CourseRefDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  courseName: string;
}

class UserRefDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  email: string;
}

/** Attendance row as returned from the API (documentation). */
export class AttendanceViewDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  userId: string;

  @ApiProperty()
  courseId: string;

  @ApiProperty()
  supervisorId: string;

  @ApiProperty()
  date: Date;

  @ApiProperty({ description: 'true = present, false = absent' })
  status: boolean;

  @ApiPropertyOptional({ type: CourseRefDto })
  course?: CourseRefDto;

  @ApiPropertyOptional({ type: UserRefDto })
  student?: UserRefDto;

  @ApiPropertyOptional({ type: UserRefDto })
  supervisor?: UserRefDto;
}
