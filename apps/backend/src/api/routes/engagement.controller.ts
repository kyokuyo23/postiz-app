import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Organization, User } from '@prisma/client';
import { GetOrgFromRequest } from '@gitroom/nestjs-libraries/user/org.from.request';
import { GetUserFromRequest } from '@gitroom/nestjs-libraries/user/user.from.request';
import { CommentsService } from '@gitroom/nestjs-libraries/database/prisma/comments/comments.service';
import {
  CommentSourceDto,
  CommentStatsQueryDto,
  CommentsListQueryDto,
  HideCommentDto,
  ReplyCommentDto,
  ResearchQueryDto,
  UpdateCommentStatusDto,
} from '@gitroom/nestjs-libraries/dtos/comments/comments.dto';

@ApiTags('Engagement')
@Controller('/engagement')
export class EngagementController {
  constructor(private _commentsService: CommentsService) {}

  @Get('/sources')
  sources(@GetOrgFromRequest() org: Organization) {
    return this._commentsService.sources(org.id);
  }

  @Put('/sources/:integrationId')
  setSource(
    @GetOrgFromRequest() org: Organization,
    @Param('integrationId') integrationId: string,
    @Body() body: CommentSourceDto
  ) {
    return this._commentsService.setSource(org.id, integrationId, body.enabled);
  }

  @Post('/sources/:integrationId/sync')
  syncNow(
    @GetOrgFromRequest() org: Organization,
    @Param('integrationId') integrationId: string
  ) {
    return this._commentsService.syncNow(org.id, integrationId);
  }

  @Get('/stats')
  stats(
    @GetOrgFromRequest() org: Organization,
    @Query() query: CommentStatsQueryDto
  ) {
    return this._commentsService.stats(org.id, query.days || 3);
  }

  @Get('/comments')
  list(
    @GetOrgFromRequest() org: Organization,
    @Query() query: CommentsListQueryDto
  ) {
    return this._commentsService.list(org.id, query);
  }

  @Put('/comments/:id/status')
  setStatus(
    @GetOrgFromRequest() org: Organization,
    @GetUserFromRequest() user: User,
    @Param('id') id: string,
    @Body() body: UpdateCommentStatusDto
  ) {
    return this._commentsService.setStatus(org.id, id, body.status, user.id);
  }

  @Post('/comments/:id/reply')
  reply(
    @GetOrgFromRequest() org: Organization,
    @GetUserFromRequest() user: User,
    @Param('id') id: string,
    @Body() body: ReplyCommentDto
  ) {
    return this._commentsService.reply(org.id, id, body.text, user.id);
  }

  @Post('/comments/:id/hide')
  hide(
    @GetOrgFromRequest() org: Organization,
    @Param('id') id: string,
    @Body() body: HideCommentDto
  ) {
    return this._commentsService.hide(org.id, id, body.hide);
  }

  @Get('/research')
  research(
    @GetOrgFromRequest() org: Organization,
    @Query() query: ResearchQueryDto
  ) {
    return this._commentsService.research(org.id, query.integrationId, query.q);
  }
}
