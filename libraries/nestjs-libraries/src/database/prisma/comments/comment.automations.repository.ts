import { Injectable } from '@nestjs/common';
import { PrismaRepository } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';
import {
  CommentAutomationDto,
  CommentTemplateDto,
} from '@gitroom/nestjs-libraries/dtos/comments/comments.dto';

const ruleFields = (body: CommentTemplateDto | CommentAutomationDto) => ({
  matchType: body.matchType,
  keywords: JSON.stringify(body.keywords),
  excludeKeywords: JSON.stringify(body.excludeKeywords),
  replies: JSON.stringify(body.replies),
  hide: body.hide,
  markAs: body.markAs,
});

@Injectable()
export class CommentAutomationsRepository {
  constructor(
    private _automation: PrismaRepository<'commentAutomation'>,
    private _template: PrismaRepository<'commentAutomationTemplate'>
  ) {}

  list(orgId: string) {
    return this._automation.model.commentAutomation.findMany({
      where: { organizationId: orgId, deletedAt: null },
      orderBy: { createdAt: 'asc' },
    });
  }

  activeRules(orgId: string) {
    return this._automation.model.commentAutomation.findMany({
      where: { organizationId: orgId, deletedAt: null, active: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  create(orgId: string, body: CommentAutomationDto) {
    return this._automation.model.commentAutomation.create({
      data: {
        organizationId: orgId,
        name: body.name,
        active: body.active ?? true,
        integrations: JSON.stringify(body.integrations),
        ...ruleFields(body),
      },
    });
  }

  update(orgId: string, id: string, body: CommentAutomationDto) {
    return this._automation.model.commentAutomation.update({
      where: { id, organizationId: orgId, deletedAt: null },
      data: {
        name: body.name,
        ...(body.active === undefined ? {} : { active: body.active }),
        integrations: JSON.stringify(body.integrations),
        ...ruleFields(body),
      },
    });
  }

  setActive(orgId: string, id: string, active: boolean) {
    return this._automation.model.commentAutomation.update({
      where: { id, organizationId: orgId, deletedAt: null },
      data: { active },
    });
  }

  remove(orgId: string, id: string) {
    return this._automation.model.commentAutomation.update({
      where: { id, organizationId: orgId },
      data: { deletedAt: new Date(), active: false },
    });
  }

  incrementRuns(id: string) {
    return this._automation.model.commentAutomation.update({
      where: { id },
      data: { runs: { increment: 1 } },
    });
  }

  listTemplates(orgId: string) {
    return this._template.model.commentAutomationTemplate.findMany({
      where: { organizationId: orgId, deletedAt: null },
      orderBy: { createdAt: 'asc' },
    });
  }

  getTemplate(orgId: string, id: string) {
    return this._template.model.commentAutomationTemplate.findFirst({
      where: { id, organizationId: orgId, deletedAt: null },
    });
  }

  createTemplate(orgId: string, body: CommentTemplateDto) {
    return this._template.model.commentAutomationTemplate.create({
      data: {
        organizationId: orgId,
        name: body.name,
        description: body.description,
        ...ruleFields(body),
      },
    });
  }

  updateTemplate(orgId: string, id: string, body: CommentTemplateDto) {
    return this._template.model.commentAutomationTemplate.update({
      where: { id, organizationId: orgId, deletedAt: null },
      data: {
        name: body.name,
        description: body.description,
        ...ruleFields(body),
      },
    });
  }

  removeTemplate(orgId: string, id: string) {
    return this._template.model.commentAutomationTemplate.update({
      where: { id, organizationId: orgId },
      data: { deletedAt: new Date() },
    });
  }
}
