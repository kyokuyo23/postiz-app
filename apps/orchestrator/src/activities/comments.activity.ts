import { Injectable } from '@nestjs/common';
import { Activity, ActivityMethod } from 'nestjs-temporal-core';
import { CommentsService } from '@gitroom/nestjs-libraries/database/prisma/comments/comments.service';

@Injectable()
@Activity()
export class CommentsActivity {
  constructor(private _commentsService: CommentsService) {}

  @ActivityMethod()
  async syncComments(integrationId: string) {
    return this._commentsService.syncIntegration(integrationId);
  }
}
