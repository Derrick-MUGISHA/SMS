import { Controller, Delete, Param, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCookieAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { MessageResponseDto } from '../common/swagger/message-response.dto';
import { Role } from '@prisma/client';
import { EnrollmentsService } from './enrollments.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ACCESS_TOKEN_COOKIE } from '../auth/auth.constants';

@ApiTags('enrollments')
@ApiCookieAuth(ACCESS_TOKEN_COOKIE)
@ApiBearerAuth('bearer')
@Controller('enrollments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EnrollmentsController {
  constructor(private readonly enrollments: EnrollmentsService) {}

  @Delete(':enrollmentId')
  @Roles(Role.SUPERVISOR)
  @ApiOperation({
    summary: 'Remove a student from a course',
    description:
      'Deletes the enrollment row and all attendance records for that student in that course.',
  })
  @ApiParam({
    name: 'enrollmentId',
    description:
      'Mongo ObjectId of the enrollment (from GET /courses/:id/enrollments)',
    example: '674a1b2c3d4e5f6789abcdef',
  })
  @ApiOkResponse({ type: MessageResponseDto })
  @ApiNotFoundResponse({ description: 'Enrollment not found' })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  remove(@Param('enrollmentId') enrollmentId: string) {
    return this.enrollments.removeEnrollment(enrollmentId);
  }
}
