import { Controller, Get, Redirect } from '@nestjs/common';
import {
  ApiExcludeEndpoint,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { AppService } from './app.service';
import { Public } from './auth/decorators/public.decorator';
import { agentLog } from './debug-agent-log';

@ApiTags('app')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  /** Root URL opens Swagger so local dev is not an empty-looking plain-text page. */
  @Public()
  @Get()
  @Redirect('/api', 302)
  @ApiExcludeEndpoint()
  redirectToSwagger(): void {
    // #region agent log
    agentLog({
      runId: 'post-fix',
      hypothesisId: 'H1',
      location: 'app.controller.ts:redirectToSwagger',
      message: 'root_redirect_to_swagger',
      data: { target: '/api' },
    });
    // #endregion
  }

  @Public()
  @Get('health')
  @ApiOperation({
    summary: 'Liveness probe',
    description: 'Plain text OK for load balancers; API docs live at /api.',
  })
  @ApiOkResponse({
    description: 'Plain text',
    schema: { type: 'string', example: 'Hello World!' },
  })
  getHello(): string {
    // #region agent log
    agentLog({
      runId: 'post-fix',
      hypothesisId: 'H1',
      location: 'app.controller.ts:getHello',
      message: 'health_route_hit',
      data: {},
    });
    // #endregion
    return this.appService.getHello();
  }
}
