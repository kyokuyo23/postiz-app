import { Integration } from '@prisma/client';

/**
 * Optional comment-inbox support for a social provider.
 *
 * Only providers whose official API allows it implement these members.
 * Everything is optional so existing providers are unaffected.
 */
export interface FetchedComment {
  /** Provider id of the comment */
  id: string;
  /** Provider id of the post/video the comment belongs to */
  postId: string;
  postUrl?: string;
  postText?: string;
  /** Provider id of the parent comment when this is a nested reply */
  parentId?: string;
  authorName: string;
  authorId?: string;
  authorPicture?: string;
  text: string;
  /** ISO date */
  publishedAt: string;
  hidden?: boolean;
}

export interface CommentCapabilities {
  /** Can publish a public reply under the comment */
  reply: boolean;
  /** Can hide the comment from the public (reversible) */
  hide: boolean;
  /** Can send a private message to the commenter */
  directMessage: boolean;
}

export interface ResearchItem {
  id: string;
  url: string;
  title?: string;
  text: string;
  author: string;
  thumbnail?: string;
  publishedAt: string;
  views?: number;
  likes?: number;
  comments?: number;
}

export interface CommentsProvider {
  /** Public content search through the platform's official search API */
  searchContent?(integration: Integration, query: string): Promise<ResearchItem[]>;
  commentCapabilities?: CommentCapabilities;
  /**
   * Returns comments on the account's recent posts published after `since`.
   */
  fetchComments?(
    integration: Integration,
    since: Date
  ): Promise<FetchedComment[]>;
  replyToComment?(
    integration: Integration,
    comment: { id: string; postId: string; parentId?: string | null },
    text: string
  ): Promise<{ id: string }>;
  hideComment?(
    integration: Integration,
    commentId: string,
    hide: boolean
  ): Promise<void>;
}
