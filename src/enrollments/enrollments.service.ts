import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class EnrollmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async removeEnrollment(enrollmentId: string) {
    const enrollment = await this.prisma.enrollment.findUnique({
      where: { id: enrollmentId },
    });
    if (!enrollment) {
      throw new NotFoundException('Enrollment not found');
    }

    await this.prisma.attendance.deleteMany({
      where: {
        userId: enrollment.userId,
        courseId: enrollment.courseId,
      },
    });
    await this.prisma.enrollment.delete({ where: { id: enrollmentId } });

    return { message: 'Enrollment removed' };
  }
}
