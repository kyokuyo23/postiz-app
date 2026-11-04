import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  OnModuleDestroy,
  OnModuleInit,
  Param,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Organization } from '@prisma/client';
import { Response } from 'express';
import { GetOrgFromRequest } from '@gitroom/nestjs-libraries/user/org.from.request';
import { LiveService } from '@gitroom/nestjs-libraries/database/prisma/live/live.service';
import {
  LiveAuthDto,
  LiveCheckQueryDto,
  LiveSessionDto,
  LiveTargetDto,
} from '@gitroom/nestjs-libraries/dtos/live/live.dto';

@ApiTags('Live')
@Controller('/live')
export class LiveController implements OnModuleInit, OnModuleDestroy {
  constructor(private _liveService: LiveService) {}

  // The relay worker runs in the API process only (not in the orchestrator).
  onModuleInit() {
    this._liveService.startWorker();
  }

  onModuleDestroy() {
    this._liveService.stopWorker();
  }

  @Get('/status')
  status() {
    return this._liveService.status();
  }

  @Get('/check')
  check(@GetOrgFromRequest() org: Organization, @Query() query: LiveCheckQueryDto) {
    return this._liveService.check(
      org.id,
      (query.integrations || '').split(',').map((x) => x.trim()).filter(Boolean)
    );
  }

  @Get('/targets')
  targets(@GetOrgFromRequest() org: Organization) {
    return this._liveService.listTargets(org.id);
  }

  @Post('/targets')
  saveTarget(@GetOrgFromRequest() org: Organization, @Body() body: LiveTargetDto) {
    return this._liveService.saveTarget(org.id, body);
  }

  @Delete('/targets/:id')
  deleteTarget(@GetOrgFromRequest() org: Organization, @Param('id') id: string) {
    return this._liveService.deleteTarget(org.id, id);
  }

  @Get('/')
  list(@GetOrgFromRequest() org: Organization) {
    return this._liveService.list(org.id);
  }

  @Post('/')
  create(@GetOrgFromRequest() org: Organization, @Body() body: LiveSessionDto) {
    return this._liveService.create(org.id, body);
  }

  @Post('/:id/stop')
  stop(@GetOrgFromRequest() org: Organization, @Param('id') id: string) {
    return this._liveService.stop(org.id, id);
  }

  @Delete('/:id')
  remove(@GetOrgFromRequest() org: Organization, @Param('id') id: string) {
    return this._liveService.remove(org.id, id);
  }
}

/** Called by MediaMTX (authHTTPAddress) for every publish/read attempt. */
@ApiTags('Live')
@Controller('/public/live')
export class LiveHookController {
  constructor(private _liveService: LiveService) {}

  @Post('/auth')
  @HttpCode(200)
  async auth(
    @Query('secret') secret: string,
    @Body() body: LiveAuthDto,
    @Res({ passthrough: true }) res: Response
  ) {
    const ok = await this._liveService.authorize(secret, body);
    if (!ok) res.status(401);
    return { ok };
  }
}
