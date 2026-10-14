import { BadRequestException, Injectable } from '@nestjs/common';
import { CommentAutomationsRepository } from '@gitroom/nestjs-libraries/database/prisma/comments/comment.automations.repository';
import {
  CommentAutomationDto,
  CommentTemplateDto,
} from '@gitroom/nestjs-libraries/dtos/comments/comments.dto';
import {
  BUILT_IN_TEMPLATES,
  CommentRule,
  MarkAs,
  MatchType,
  parseList,
} from '@gitroom/nestjs-libraries/comments/comment.rules';

const toView = <
  T extends {
    keywords: string;
    excludeKeywords: string;
    replies: string;
  }
>(
  row: T
) => ({
  ...row,
  keywords: parseList(row.keywords),
  excludeKeywords: parseList(row.excludeKeywords),
  replies: parseList(row.replies),
});

@Injectable()
export class CommentAutomationsService {
  constructor(private _repository: CommentAutomationsRepository) {}

  private validate(body: CommentTemplateDto | CommentAutomationDto) {
    if (body.matchType !== 'every' && !body.keywords.some((k) => k.trim())) {
      throw new BadRequestException('Add at least one keyword');
    }
    if (!body.hide && !body.replies.some((r) => r.trim()) && body.markAs === 'PENDING') {
      throw new BadRequestException(
        'The rule does nothing: add a reply, hide the comment or change its status'
      );
    }
  }

  async list(orgId: string) {
    return (await this._repository.list(orgId)).map((a) => ({
      ...toView(a),
      integrations: parseList(a.integrations),
    }));
  }

  create(orgId: string, body: CommentAutomationDto) {
    this.validate(body);
    return this._repository.create(orgId, body);
  }

  update(orgId: string, id: string, body: CommentAutomationDto) {
    this.validate(body);
    return this._repository.update(orgId, id, body);
  }

  setActive(orgId: string, id: string, active: boolean) {
    return this._repository.setActive(orgId, id, active);
  }

  remove(orgId: string, id: string) {
    return this._repository.remove(orgId, id);
  }

  incrementRuns(id: string) {
    return this._repository.incrementRuns(id);
  }

  async activeRules(orgId: string): Promise<CommentRule[]> {
    return (await this._repository.activeRules(orgId)).map((a) => ({
      id: a.id,
      matchType: a.matchType as MatchType,
      keywords: parseList(a.keywords),
      excludeKeywords: parseList(a.excludeKeywords),
      replies: parseList(a.replies),
      hide: a.hide,
      markAs: a.markAs as MarkAs,
      integrations: parseList(a.integrations),
    }));
  }

  async listTemplates(orgId: string) {
    const custom = (await this._repository.listTemplates(orgId)).map((t) => ({
      ...toView(t),
      builtIn: false,
    }));
    return [
      ...BUILT_IN_TEMPLATES.map((t) => ({ ...t, builtIn: true })),
      ...custom,
    ];
  }

  createTemplate(orgId: string, body: CommentTemplateDto) {
    this.validate(body);
    return this._repository.createTemplate(orgId, body);
  }

  updateTemplate(orgId: string, id: string, body: CommentTemplateDto) {
    this.validate(body);
    return this._repository.updateTemplate(orgId, id, body);
  }

  removeTemplate(orgId: string, id: string) {
    return this._repository.removeTemplate(orgId, id);
  }

  /** Creates an automation (inactive, all channels) from a template. */
  async useTemplate(orgId: string, templateId: string) {
    const preset = BUILT_IN_TEMPLATES.find((t) => t.id === templateId);
    const template = preset
      ? preset
      : await this._repository.getTemplate(orgId, templateId).then((t) =>
          t ? { ...toView(t), matchType: t.matchType as MatchType, markAs: t.markAs as MarkAs } : null
        );
    if (!template) {
      throw new BadRequestException('Template not found');
    }
    return this._repository.create(orgId, {
      name: template.name,
      active: false,
      integrations: [],
      matchType: template.matchType,
      keywords: template.keywords,
      excludeKeywords: template.excludeKeywords,
      replies: template.replies,
      hide: template.hide,
      markAs: template.markAs,
    });
  }
}
