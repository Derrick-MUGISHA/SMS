import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MarkAttendanceDto } from './dto/mark-attendance.dto';

@Injectable()
export class AttendanceService {
  constructor(private readonly prisma: PrismaService) {}

  async mark(supervisorId: string, dto: MarkAttendanceDto) {
    const enrollment = await this.prisma.enrollment.findUnique({
      where: {
        userId_courseId: { userId: dto.studentId, courseId: dto.courseId },
      },
    });
    if (!enrollment) {
      throw new NotFoundException('Student is not enrolled in this course');
    }

    return this.prisma.attendance.create({
      data: {
        userId: dto.studentId,
        courseId: dto.courseId,
        supervisorId,
        status: dto.status,
      },
      include: {
        course: { select: { id: true, courseName: true } },
        student: { select: { id: true, email: true } },
      },
    });
  }

  async findMine(studentId: string, courseId?: string) {
    return this.prisma.attendance.findMany({
      where: {
        userId: studentId,
        ...(courseId ? { courseId } : {}),
      },
      include: {
        course: { select: { id: true, courseName: true } },
        supervisor: { select: { id: true, email: true } },
      },
      orderBy: { date: 'desc' },
    });
  }
}
