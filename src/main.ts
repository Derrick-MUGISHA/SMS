import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { ACCESS_TOKEN_COOKIE } from './auth/auth.constants';
import { MessageResponseDto } from './common/swagger/message-response.dto';
import { CourseViewDto } from './common/swagger/course-view.dto';
import { AttendanceViewDto } from './common/swagger/attendance-view.dto';
import { agentLog } from './debug-agent-log';

async function bootstrap() {
  // #region agent log
  agentLog({
    runId: 'post-fix',
    hypothesisId: 'H2',
    location: 'main.ts:bootstrap',
    message: 'bootstrap_start',
    data: { nodeEnv: process.env.NODE_ENV ?? 'undefined' },
  });
  // #endregion
  try {
    const app = await NestFactory.create(AppModule);
    const config = app.get(ConfigService);

    app.use(cookieParser());

    const frontendUrl =
      config.get<string>('FRONTEND_URL') ?? 'http://localhost:5173';
    app.enableCors({
      origin: frontendUrl,
      credentials: true,
    });

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    const swaggerConfig = new DocumentBuilder()
      .setTitle('School Management API')
      .setDescription(
        [
          'Student / supervisor SMS API with JWT access + refresh tokens.',
          '',
          "**Cookies (browser):** `POST /auth/login` sets httpOnly `access_token` (path `/`) and `refresh_token` (path `/auth`). Send credentials with requests (`credentials: 'include'` from SPAs).",
          '',
          '**Swagger UI:** Tokens are only sent as **httpOnly cookies** (not in JSON). After **Try it out** on `POST /auth/login`, open browser devtools → Network → the login response → **Response headers** and copy the `access_token` value from `Set-Cookie`, then **Authorize → bearer (JWT)** and paste it. Or use **cookie** auth and paste that same value as the cookie body.',
          '',
          '`POST /auth/refresh` expects the `refresh_token` cookie (narrow path `/auth`).',
        ].join('\n'),
      )
      .setVersion('1.0')
      .addTag(
        'app',
        'Public health-style endpoint (no authentication required).',
      )
      .addTag(
        'auth',
        'Registration, OTP verification, login, token refresh, logout, password reset.',
      )
      .addTag(
        'courses',
        'List and create courses; students enroll via nested route; supervisors list enrollments.',
      )
      .addTag(
        'enrollments',
        'Supervisor-only removal of a student from a course (and related attendance).',
      )
      .addTag(
        'attendance',
        'Supervisors mark attendance; students read their own records.',
      )
      .addCookieAuth(ACCESS_TOKEN_COOKIE, {
        type: 'apiKey',
        in: 'cookie',
        name: ACCESS_TOKEN_COOKIE,
      })
      .addBearerAuth(
        { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        'bearer',
      )
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig, {
      extraModels: [MessageResponseDto, CourseViewDto, AttendanceViewDto],
    });
    SwaggerModule.setup('api', app, document, {
      swaggerOptions: {
        persistAuthorization: true,
      },
    });

    await app.listen(3000);
    // #region agent log
    agentLog({
      runId: 'post-fix',
      hypothesisId: 'H1',
      location: 'main.ts:listen',
      message: 'listen_ok',
      data: {
        rootRedirectsTo: '/api',
        swaggerUrl: 'http://127.0.0.1:3000/api',
        healthUrl: 'http://127.0.0.1:3000/health',
      },
    });
    // #endregion
  } catch (err) {
    // #region agent log
    agentLog({
      runId: 'post-fix',
      hypothesisId: 'H2',
      location: 'main.ts:bootstrap_catch',
      message: 'bootstrap_failed',
      data: {
        name: err instanceof Error ? err.name : 'non-Error',
        message: err instanceof Error ? err.message : String(err),
      },
    });
    // #endregion
    throw err;
  }
}
void bootstrap();
