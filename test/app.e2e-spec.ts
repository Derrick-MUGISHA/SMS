import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import * as bcrypt from 'bcrypt';
import { Prisma, Role } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { createPrismaMock, PrismaMock } from './mocks/prisma.mock';

/* Supertest + Nest HTTP server typings are loose; keep tests readable. */
/* eslint-disable @typescript-eslint/no-unsafe-argument -- supertest app.getHttpServer() */
/* eslint-disable @typescript-eslint/no-unsafe-member-access -- response body */

describe('SMS API (e2e)', () => {
  let app: INestApplication;
  let prismaMock: PrismaMock;

  const sign = (role: Role, sub = 'user-1', email = 'user@test.dev') => {
    const jwt = app.get(JwtService);
    return jwt.sign({ sub, email, role });
  };

  beforeEach(async () => {
    prismaMock = createPrismaMock();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('AppController', () => {
    it('GET / redirects to Swagger UI at /api', () => {
      return request(app.getHttpServer())
        .get('/')
        .expect(302)
        .expect('Location', '/api');
    });

    it('GET /health returns greeting', () => {
      return request(app.getHttpServer())
        .get('/health')
        .expect(200)
        .expect('Hello World!');
    });
  });

  describe('Auth', () => {
    it('POST /auth/register creates user', async () => {
      prismaMock.user.create.mockResolvedValue({
        id: 'new-id',
        email: 'new@test.dev',
        password: 'hashed',
        role: Role.STUDENT,
        isVerified: false,
        otp: 'h',
        otpExpires: new Date(),
        hashedRefreshToken: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'new@test.dev', password: 'password12' })
        .expect(201)
        .expect((res) => {
          expect(res.body.message).toContain('Registration successful');
        });
    });

    it('POST /auth/register returns 409 on duplicate email', async () => {
      const err = new Prisma.PrismaClientKnownRequestError('dup', {
        code: 'P2002',
        clientVersion: 'test',
      });
      prismaMock.user.create.mockRejectedValue(err);

      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'dup@test.dev', password: 'password12' })
        .expect(409);
    });

    it('POST /auth/login sets cookies when credentials valid', async () => {
      const password = await bcrypt.hash('password12', 4);
      prismaMock.user.findUnique.mockResolvedValue({
        id: 'u1',
        email: 'stu@test.dev',
        password,
        role: Role.STUDENT,
        isVerified: true,
        otp: null,
        otpExpires: null,
        hashedRefreshToken: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      prismaMock.user.update.mockResolvedValue({
        id: 'u1',
        email: 'stu@test.dev',
        password,
        role: Role.STUDENT,
        isVerified: true,
        otp: null,
        otpExpires: null,
        hashedRefreshToken: 'stored-hash',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'stu@test.dev', password: 'password12' })
        .expect(201);

      expect(res.body.message).toBe('Login successful');
      const cookies = res.headers['set-cookie'] as string[] | undefined;
      expect(cookies?.some((c) => c.startsWith('access_token='))).toBe(true);
      expect(cookies?.some((c) => c.startsWith('refresh_token='))).toBe(true);
    });

    it('POST /auth/login returns 401 for bad password', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        id: 'u1',
        email: 'stu@test.dev',
        password: await bcrypt.hash('other', 4),
        role: Role.STUDENT,
        isVerified: true,
        otp: null,
        otpExpires: null,
        hashedRefreshToken: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'stu@test.dev', password: 'wrongpass' })
        .expect(401);
    });
  });

  describe('Courses & RBAC', () => {
    it('GET /courses without token returns 401', () => {
      return request(app.getHttpServer()).get('/courses').expect(401);
    });

    it('GET /courses with student JWT returns list', async () => {
      prismaMock.course.findMany.mockResolvedValue([]);

      const token = sign(Role.STUDENT);
      await request(app.getHttpServer())
        .get('/courses')
        .set('Authorization', `Bearer ${token}`)
        .expect(200)
        .expect([]);
    });

    it('POST /courses forbidden for student', async () => {
      const token = sign(Role.STUDENT);
      await request(app.getHttpServer())
        .post('/courses')
        .set('Authorization', `Bearer ${token}`)
        .send({ courseName: 'CS101', description: 'Intro' })
        .expect(403);
    });

    it('POST /courses allowed for supervisor', async () => {
      prismaMock.course.create.mockResolvedValue({
        id: 'course-1',
        courseName: 'CS101',
        description: 'Intro',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const token = sign(Role.SUPERVISOR, 'sup-1', 'sup@test.dev');
      await request(app.getHttpServer())
        .post('/courses')
        .set('Authorization', `Bearer ${token}`)
        .send({ courseName: 'CS101', description: 'Intro' })
        .expect(201);
    });
  });

  describe('Enrollments', () => {
    it('POST enroll returns 404 when course missing', async () => {
      prismaMock.course.findUnique.mockResolvedValue(null);
      const token = sign(Role.STUDENT);

      await request(app.getHttpServer())
        .post('/courses/507f1f77bcf86cd799439099/enroll')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });

    it('POST enroll creates enrollment for student', async () => {
      prismaMock.course.findUnique.mockResolvedValue({
        id: '507f1f77bcf86cd799439011',
        courseName: 'Math',
        description: 'x',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      prismaMock.enrollment.create.mockResolvedValue({
        id: '507f1f77bcf86cd799439022',
        userId: 'user-1',
        courseId: '507f1f77bcf86cd799439011',
        createdAt: new Date(),
        course: {
          id: '507f1f77bcf86cd799439011',
          courseName: 'Math',
          description: 'x',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      const token = sign(Role.STUDENT);
      await request(app.getHttpServer())
        .post('/courses/507f1f77bcf86cd799439011/enroll')
        .set('Authorization', `Bearer ${token}`)
        .expect(201);
    });
  });

  describe('Attendance', () => {
    it('GET /attendance/me forbidden for supervisor', async () => {
      const token = sign(Role.SUPERVISOR, 'sup-1', 'sup@test.dev');
      await request(app.getHttpServer())
        .get('/attendance/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    });

    it('GET /attendance/me returns rows for student', async () => {
      prismaMock.attendance.findMany.mockResolvedValue([]);
      const token = sign(Role.STUDENT);
      await request(app.getHttpServer())
        .get('/attendance/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200)
        .expect([]);
    });

    it('POST /attendance/mark returns 404 when not enrolled', async () => {
      prismaMock.enrollment.findUnique.mockResolvedValue(null);
      const token = sign(Role.SUPERVISOR, 'sup-1', 'sup@test.dev');

      await request(app.getHttpServer())
        .post('/attendance/mark')
        .set('Authorization', `Bearer ${token}`)
        .send({
          studentId: '60d5ec49f1b2c8b1f8e4e1a1',
          courseId: '60d5ec49f1b2c8b1f8e4e1a2',
          status: true,
        })
        .expect(404);
    });
  });
});
