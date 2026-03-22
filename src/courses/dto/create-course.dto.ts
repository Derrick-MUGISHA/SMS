import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class CreateCourseDto {
  @ApiProperty({ example: 'Introduction to Algorithms' })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  courseName: string;

  @ApiProperty({ example: 'Core CS topics' })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  description: string;
}
