import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCookieAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CourseViewDto } from '../common/swagger/course-view.dto';
import { Role } from '../../generated/prisma/client';
import { CoursesService } from './courses.service';
import { CreateCourseDto } from './dto/create-course.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ACCESS_TOKEN_COOKIE } from '../auth/auth.constants';
import type { Request } from 'express';

type AuthedRequest = Request & {
  user: { id: string; email: string; role: Role };
};

@ApiTags('courses')
@ApiCookieAuth(ACCESS_TOKEN_COOKIE)
@ApiBearerAuth('bearer')
@Controller('courses')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CoursesController {
  constructor(private readonly courses: CoursesService) {}

  @Get()
  @ApiOperation({
    summary: 'List all courses',
    description: 'Any authenticated user (student or supervisor).',
  })
  @ApiOkResponse({ type: CourseViewDto, isArray: true })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  findAll() {
    return this.courses.findAll();
  }

  @Post()
  @Roles(Role.SUPERVISOR)
  @ApiOperation({ summary: 'Create a course (supervisor only)' })
  @ApiOkResponse({ type: CourseViewDto })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse({ description: 'Student role cannot create courses' })
  create(@Body() dto: CreateCourseDto) {
    return this.courses.create(dto);
  }

  @Post(':courseId/enroll')
  @Roles(Role.STUDENT)
  @ApiOperation({ summary: 'Join a course (student only)' })
  @ApiParam({
    name: 'courseId',
    description: 'Mongo ObjectId of the course',
    example: '674a1b2c3d4e5f6789abcdef',
  })
  @ApiOkResponse({
    description: 'Enrollment created (includes nested course)',
  })
  @ApiNotFoundResponse({ description: 'Course does not exist' })
  @ApiConflictResponse({ description: 'Already enrolled in this course' })
  @ApiForbiddenResponse({ description: 'Supervisors cannot use this route' })
  enroll(@Param('courseId') courseId: string, @Req() req: AuthedRequest) {
    return this.courses.enrollStudent(req.user.id, courseId);
  }

  @Get(':courseId/enrollments')
  @Roles(Role.SUPERVISOR)
  @ApiOperation({
    summary: 'List enrollments for a course',
    description:
      'Returns enrollment ids, createdAt, and user summary (supervisor only).',
  })
  @ApiParam({
    name: 'courseId',
    description: 'Mongo ObjectId of the course',
    example: '674a1b2c3d4e5f6789abcdef',
  })
  @ApiOkResponse({
    description: 'Array of enrollments with nested user',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          userId: { type: 'string' },
          courseId: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' },
          user: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              email: { type: 'string' },
              role: { type: 'string', enum: ['STUDENT', 'SUPERVISOR'] },
            },
          },
        },
      },
    },
  })
  @ApiNotFoundResponse({ description: 'Course not found' })
  @ApiForbiddenResponse()
  enrollments(@Param('courseId') courseId: string) {
    return this.courses.listEnrollmentsForCourse(courseId);
  }
}
