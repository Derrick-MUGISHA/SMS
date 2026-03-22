import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCookieAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AttendanceViewDto } from '../common/swagger/attendance-view.dto';
import { Role } from '@prisma/client';
import { AttendanceService } from './attendance.service';
import { MarkAttendanceDto } from './dto/mark-attendance.dto';
import { AttendanceMeQueryDto } from './dto/attendance-me-query.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ACCESS_TOKEN_COOKIE } from '../auth/auth.constants';
import type { Request } from 'express';

type AuthedRequest = Request & {
  user: { id: string; email: string; role: Role };
};

@ApiTags('attendance')
@ApiCookieAuth(ACCESS_TOKEN_COOKIE)
@ApiBearerAuth('bearer')
@Controller('attendance')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AttendanceController {
  constructor(private readonly attendance: AttendanceService) {}

  @Post('mark')
  @Roles(Role.SUPERVISOR)
  @ApiOperation({
    summary: 'Record attendance for an enrolled student',
    description:
      '`supervisorId` is taken from the JWT. Student must already be enrolled in the course.',
  })
  @ApiOkResponse({ type: AttendanceViewDto })
  @ApiNotFoundResponse({
    description: 'Student is not enrolled in the given course',
  })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  mark(@Req() req: AuthedRequest, @Body() dto: MarkAttendanceDto) {
    return this.attendance.mark(req.user.id, dto);
  }

  @Get('me')
  @Roles(Role.STUDENT)
  @ApiOperation({
    summary: 'List own attendance records',
    description:
      'Optional `courseId` query filters to one course. Supervisors receive 403.',
  })
  @ApiOkResponse({ type: AttendanceViewDto, isArray: true })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  mine(@Req() req: AuthedRequest, @Query() query: AttendanceMeQueryDto) {
    return this.attendance.findMine(req.user.id, query.courseId);
  }
}
