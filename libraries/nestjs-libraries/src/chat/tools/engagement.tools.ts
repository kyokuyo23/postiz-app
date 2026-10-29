import { AgentToolInterface } from '@gitroom/nestjs-libraries/chat/agent.tool.interface';
import { createTool } from '@mastra/core/tools';
import { Injectable } from '@nestjs/common';
import z from 'zod';
import { checkAuth } from '@gitroom/nestjs-libraries/chat/auth.context';
import { CommentsService } from '@gitroom/nestjs-libraries/database/prisma/comments/comments.service';
import { CommentAutomationsService } from '@gitroom/nestjs-libraries/database/prisma/comments/comment.automations.service';
import { COMMENT_STATUSES } from '@gitroom/nestjs-libraries/dtos/comments/comments.dto';

/**
 * Engagement (comment inbox + automation rules) exposed as MCP tools, so
 * external agents can read and answer comments on connected channels.
 */

const orgIdFrom = (inputData: unknown, context: any): string => {
  checkAuth(inputData, context);
  return JSON.parse(
    (context?.requestContext as any)?.get('organization') as string
  ).id;
};

/** Replies made through MCP are recorded with this actor. */
const MCP_ACTOR = 'mcp';

const anyOutput = z.object({ output: z.any() });

const readOnly = (title: string) => ({
  annotations: {
    title,
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  },
});

const writes = (title: string, idempotent: boolean) => ({
  annotations: {
    title,
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: idempotent,
    openWorldHint: true,
  },
});

@Injectable()
export class EngagementChannelsTool implements AgentToolInterface {
  constructor(private _comments: CommentsService) {}
  name = 'engagementChannels';

  run() {
    return createTool({
      id: 'engagementChannels',
      description: `Lists the connected channels that support the comment inbox (YouTube, Threads), whether comment syncing is enabled for each, the last sync time and error, and whether replying/hiding is supported. Use the channel id with commentsList and commentsSyncNow.`,
      inputSchema: z.object({}),
      mcp: readOnly('List Engagement Channels'),
      outputSchema: anyOutput,
      execute: async (inputData, context) => {
        const orgId = orgIdFrom(inputData, context);
        return { output: await this._comments.sources(orgId) };
      },
    });
  }
}

@Injectable()
export class CommentsListTool implements AgentToolInterface {
  constructor(private _comments: CommentsService) {}
  name = 'commentsList';

  run() {
    return createTool({
      id: 'commentsList',
      description: `Lists comments from the inbox, newest first, 20 per page. Filter by status (PENDING = not handled yet, RESOLVED, IGNORED), channel id, or text/author search. Returns total, pages and comments with their id, author, text, post and channel.`,
      inputSchema: z.object({
        status: z
          .enum(COMMENT_STATUSES)
          .optional()
          .describe('PENDING, RESOLVED or IGNORED. Omit for all.'),
        integrationId: z
          .string()
          .optional()
          .describe('Channel id from engagementChannels'),
        search: z
          .string()
          .max(100)
          .optional()
          .describe('Text or author name to search for'),
        page: z.number().int().min(0).optional().describe('Page, starting at 0'),
      }),
      mcp: readOnly('List Comments'),
      outputSchema: anyOutput,
      execute: async (inputData, context) => {
        const orgId = orgIdFrom(inputData, context);
        const result = await this._comments.list(orgId, inputData);
        return {
          output: {
            total: result.total,
            pages: result.pages,
            comments: result.comments.map((c) => ({
              id: c.id,
              status: c.status,
              hidden: c.hidden,
              author: c.authorName,
              text: c.text,
              publishedAt: c.publishedAt,
              postUrl: c.postUrl,
              postText: c.postText,
              repliedText: c.repliedText,
              repliedAt: c.repliedAt,
              channel: {
                id: c.integration.id,
                name: c.integration.name,
                platform: c.integration.providerIdentifier,
              },
            })),
          },
        };
      },
    });
  }
}

@Injectable()
export class CommentReplyTool implements AgentToolInterface {
  constructor(private _comments: CommentsService) {}
  name = 'commentReply';

  run() {
    return createTool({
      id: 'commentReply',
      description: `Publishes a public reply to a comment on the social platform and marks the comment RESOLVED. The reply is visible to everyone, so only send what the account owner would post.`,
      inputSchema: z.object({
        commentId: z.string().describe('Comment id from commentsList'),
        text: z.string().min(1).max(2000).describe('Reply text'),
      }),
      mcp: writes('Reply to Comment', false),
      outputSchema: anyOutput,
      execute: async (inputData, context) => {
        const orgId = orgIdFrom(inputData, context);
        const updated = await this._comments.reply(
          orgId,
          inputData.commentId,
          inputData.text,
          MCP_ACTOR
        );
        return {
          output: {
            id: updated.id,
            status: updated.status,
            repliedText: updated.repliedText,
            repliedAt: updated.repliedAt,
          },
        };
      },
    });
  }
}

@Injectable()
export class CommentSetStatusTool implements AgentToolInterface {
  constructor(private _comments: CommentsService) {}
  name = 'commentSetStatus';

  run() {
    return createTool({
      id: 'commentSetStatus',
      description: `Changes a comment's inbox status without replying: RESOLVED (handled), IGNORED (no action needed) or PENDING (back to the queue). Only affects the inbox, not the platform.`,
      inputSchema: z.object({
        commentId: z.string().describe('Comment id from commentsList'),
        status: z.enum(COMMENT_STATUSES),
      }),
      mcp: {
        annotations: {
          title: 'Set Comment Status',
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: false,
        },
      },
      outputSchema: anyOutput,
      execute: async (inputData, context) => {
        const orgId = orgIdFrom(inputData, context);
        const updated = await this._comments.setStatus(
          orgId,
          inputData.commentId,
          inputData.status,
          MCP_ACTOR
        );
        return { output: { id: updated.id, status: updated.status } };
      },
    });
  }
}

@Injectable()
export class CommentHideTool implements AgentToolInterface {
  constructor(private _comments: CommentsService) {}
  name = 'commentHide';

  run() {
    return createTool({
      id: 'commentHide',
      description: `Hides or unhides a comment on the platform (Threads: hidden reply, YouTube: held for review). Use for spam or abusive comments.`,
      inputSchema: z.object({
        commentId: z.string().describe('Comment id from commentsList'),
        hide: z.boolean().describe('true to hide, false to unhide'),
      }),
      mcp: writes('Hide Comment', true),
      outputSchema: anyOutput,
      execute: async (inputData, context) => {
        const orgId = orgIdFrom(inputData, context);
        const updated = await this._comments.hide(
          orgId,
          inputData.commentId,
          inputData.hide
        );
        return { output: { id: updated.id, hidden: updated.hidden } };
      },
    });
  }
}

@Injectable()
export class CommentsSyncNowTool implements AgentToolInterface {
  constructor(private _comments: CommentsService) {}
  name = 'commentsSyncNow';

  run() {
    return createTool({
      id: 'commentsSyncNow',
      description: `Fetches new comments for one channel right away instead of waiting for the automatic sync (every 10 minutes). Active automation rules run on the new comments. Comment syncing must be enabled for the channel.`,
      inputSchema: z.object({
        integrationId: z.string().describe('Channel id from engagementChannels'),
      }),
      mcp: writes('Sync Comments Now', false),
      outputSchema: anyOutput,
      execute: async (inputData, context) => {
        const orgId = orgIdFrom(inputData, context);
        const result = await this._comments.syncNow(orgId, inputData.integrationId);
        return { output: { added: result.added } };
      },
    });
  }
}

@Injectable()
export class AutomationsListTool implements AgentToolInterface {
  constructor(private _automations: CommentAutomationsService) {}
  name = 'automationsList';

  run() {
    return createTool({
      id: 'automationsList',
      description: `Lists the comment automation rules (auto-reply, auto-hide) with their id, name, whether they are active, keywords, replies, channels and how many times they ran.`,
      inputSchema: z.object({}),
      mcp: readOnly('List Automation Rules'),
      outputSchema: anyOutput,
      execute: async (inputData, context) => {
        const orgId = orgIdFrom(inputData, context);
        return { output: await this._automations.list(orgId) };
      },
    });
  }
}

@Injectable()
export class AutomationSetActiveTool implements AgentToolInterface {
  constructor(private _automations: CommentAutomationsService) {}
  name = 'automationSetActive';

  run() {
    return createTool({
      id: 'automationSetActive',
      description: `Turns a comment automation rule on or off.`,
      inputSchema: z.object({
        automationId: z.string().describe('Rule id from automationsList'),
        active: z.boolean(),
      }),
      mcp: {
        annotations: {
          title: 'Turn Automation Rule On/Off',
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: false,
        },
      },
      outputSchema: anyOutput,
      execute: async (inputData, context) => {
        const orgId = orgIdFrom(inputData, context);
        const updated = await this._automations.setActive(
          orgId,
          inputData.automationId,
          inputData.active
        );
        return { output: { id: updated.id, active: updated.active } };
      },
    });
  }
}

@Injectable()
export class ContentResearchTool implements AgentToolInterface {
  constructor(private _comments: CommentsService) {}
  name = 'contentResearch';

  run() {
    return createTool({
      id: 'contentResearch',
      description: `Searches public content on a connected channel's platform by keyword (YouTube videos, Threads posts when keyword search is enabled) to find trending topics, competitors and content ideas. Use a channel id from engagementChannels where canResearch is true.`,
      inputSchema: z.object({
        integrationId: z.string().describe('Channel id from engagementChannels'),
        query: z.string().min(2).max(100).describe('Keyword or topic'),
      }),
      mcp: {
        annotations: {
          title: 'Research Content',
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: true,
        },
      },
      outputSchema: anyOutput,
      execute: async (inputData, context) => {
        const orgId = orgIdFrom(inputData, context);
        return {
          output: await this._comments.research(
            orgId,
            inputData.integrationId,
            inputData.query
          ),
        };
      },
    });
  }
}

export const engagementTools = [
  EngagementChannelsTool,
  CommentsListTool,
  CommentReplyTool,
  CommentSetStatusTool,
  CommentHideTool,
  CommentsSyncNowTool,
  AutomationsListTool,
  AutomationSetActiveTool,
  ContentResearchTool,
];
