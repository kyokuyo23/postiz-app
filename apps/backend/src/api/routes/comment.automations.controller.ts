import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Organization } from '@prisma/client';
import { GetOrgFromRequest } from '@gitroom/nestjs-libraries/user/org.from.request';
import { CommentAutomationsService } from '@gitroom/nestjs-libraries/database/prisma/comments/comment.automations.service';
import {
  ActiveDto,
  CommentAutomationDto,
  CommentTemplateDto,
} from '@gitroom/nestjs-libraries/dtos/comments/comments.dto';

@ApiTags('Engagement')
@Controller('/engagement/automations')
export class CommentAutomationsController {
  constructor(private _automationsService: CommentAutomationsService) {}

  @Get('/')
  list(@GetOrgFromRequest() org: Organization) {
    return this._automationsService.list(org.id);
  }

  @Post('/')
  create(
    @GetOrgFromRequest() org: Organization,
    @Body() body: CommentAutomationDto
  ) {
    return this._automationsService.create(org.id, body);
  }

  @Get('/templates')
  templates(@GetOrgFromRequest() org: Organization) {
    return this._automationsService.listTemplates(org.id);
  }

  @Post('/templates')
  createTemplate(
    @GetOrgFromRequest() org: Organization,
    @Body() body: CommentTemplateDto
  ) {
    return this._automationsService.createTemplate(org.id, body);
  }

  @Put('/templates/:id')
  updateTemplate(
    @GetOrgFromRequest() org: Organization,
    @Param('id') id: string,
    @Body() body: CommentTemplateDto
  ) {
    return this._automationsService.updateTemplate(org.id, id, body);
  }

  @Delete('/templates/:id')
  removeTemplate(
    @GetOrgFromRequest() org: Organization,
    @Param('id') id: string
  ) {
    return this._automationsService.removeTemplate(org.id, id);
  }

  @Post('/templates/:id/use')
  useTemplate(
    @GetOrgFromRequest() org: Organization,
    @Param('id') id: string
  ) {
    return this._automationsService.useTemplate(org.id, id);
  }

  @Put('/:id')
  update(
    @GetOrgFromRequest() org: Organization,
    @Param('id') id: string,
    @Body() body: CommentAutomationDto
  ) {
    return this._automationsService.update(org.id, id, body);
  }

  @Post('/:id/active')
  setActive(
    @GetOrgFromRequest() org: Organization,
    @Param('id') id: string,
    @Body() body: ActiveDto
  ) {
    return this._automationsService.setActive(org.id, id, body.active);
  }

  @Delete('/:id')
  remove(@GetOrgFromRequest() org: Organization, @Param('id') id: string) {
    return this._automationsService.remove(org.id, id);
  }
}
