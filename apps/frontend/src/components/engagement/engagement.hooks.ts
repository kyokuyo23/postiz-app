'use client';

import { useCallback } from 'react';
import useSWR from 'swr';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';

export type CommentStatus = 'PENDING' | 'RESOLVED' | 'IGNORED';
export type MatchType = 'any' | 'all' | 'every';

export interface CommentSource {
  id: string;
  name: string;
  picture?: string;
  providerIdentifier: string;
  disabled: boolean;
  refreshNeeded: boolean;
  capabilities?: { reply: boolean; hide: boolean; directMessage: boolean };
  canResearch: boolean;
  enabled: boolean;
  lastSyncAt: string | null;
  lastError: string | null;
}

export interface CommentStats {
  days: number;
  all: number;
  resolved: number;
  pending: number;
  ignored: number;
  perDay: { date: string; resolved: number; pending: number; ignored: number }[];
}

export interface InboxComment {
  id: string;
  integrationId: string;
  internalId: string;
  postUrl?: string;
  postText?: string;
  authorName: string;
  authorPicture?: string;
  text: string;
  status: CommentStatus;
  hidden: boolean;
  repliedText?: string;
  repliedAt?: string;
  resolvedBy?: string;
  publishedAt: string;
  integration: {
    id: string;
    name: string;
    picture?: string;
    providerIdentifier: string;
  };
}

export interface RuleFields {
  matchType: MatchType;
  keywords: string[];
  excludeKeywords: string[];
  replies: string[];
  hide: boolean;
  markAs: CommentStatus;
}

export interface CommentAutomation extends RuleFields {
  id: string;
  name: string;
  active: boolean;
  integrations: string[];
  runs: number;
}

export interface CommentTemplate extends RuleFields {
  id: string;
  name: string;
  description?: string;
  builtIn: boolean;
}

export interface CommentsFilter {
  status?: CommentStatus;
  integrationId?: string;
  search?: string;
  page: number;
}

export const useCommentSources = () => {
  const fetch = useFetch();
  const load = useCallback(async () => {
    return (await (await fetch('/engagement/sources')).json()) as CommentSource[];
  }, [fetch]);
  return useSWR('engagement-sources', load);
};

export const useCommentStats = (days: number) => {
  const fetch = useFetch();
  const load = useCallback(async () => {
    return (await (
      await fetch(`/engagement/stats?days=${days}`)
    ).json()) as CommentStats;
  }, [fetch, days]);
  return useSWR(`engagement-stats-${days}`, load);
};

export const useInboxComments = (filter: CommentsFilter) => {
  const fetch = useFetch();
  const params = new URLSearchParams();
  if (filter.status) params.set('status', filter.status);
  if (filter.integrationId) params.set('integrationId', filter.integrationId);
  if (filter.search) params.set('search', filter.search);
  params.set('page', String(filter.page));
  const query = params.toString();
  const load = useCallback(async () => {
    return (await (await fetch(`/engagement/comments?${query}`)).json()) as {
      total: number;
      pages: number;
      comments: InboxComment[];
    };
  }, [fetch, query]);
  return useSWR(`engagement-comments-${query}`, load);
};

export const useCommentAutomations = () => {
  const fetch = useFetch();
  const load = useCallback(async () => {
    return (await (
      await fetch('/engagement/automations')
    ).json()) as CommentAutomation[];
  }, [fetch]);
  return useSWR('engagement-automations', load);
};

export const useCommentTemplates = () => {
  const fetch = useFetch();
  const load = useCallback(async () => {
    return (await (
      await fetch('/engagement/automations/templates')
    ).json()) as CommentTemplate[];
  }, [fetch]);
  return useSWR('engagement-templates', load);
};

/** Reads the error message returned by the API (Nest exception body). */
export const readError = async (response: Response, fallback: string) => {
  try {
    const body = await response.json();
    const message = Array.isArray(body?.message)
      ? body.message.join(', ')
      : body?.message;
    return message || fallback;
  } catch {
    return fallback;
  }
};
