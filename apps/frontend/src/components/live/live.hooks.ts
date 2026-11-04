'use client';

import { useCallback } from 'react';
import useSWR from 'swr';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';

export type LiveStatus = 'SCHEDULED' | 'LIVE' | 'RECONNECTING' | 'ENDED' | 'ERROR';

export interface LiveDestination {
  id: string;
  kind: 'youtube' | 'facebook' | 'custom';
  integrationId: string | null;
  name: string;
  watchUrl: string | null;
  status: string;
  error: string | null;
}

export interface LiveSession {
  id: string;
  title: string;
  description: string | null;
  source: 'RTMP' | 'VIDEO';
  streamKey: string | null;
  ingestUrl: string | null;
  mediaPath: string | null;
  loop: boolean;
  durationMinutes: number | null;
  privacy: string;
  autoReply: boolean;
  status: LiveStatus;
  scheduledAt: string;
  startedAt: string | null;
  endsAt: string | null;
  endedAt: string | null;
  error: string | null;
  destinations: LiveDestination[];
}

export interface MediaItem {
  id: string;
  name: string;
  path: string;
  thumbnail?: string | null;
}

export const isVideoPath = (path: string) => /\.(mp4|mov|webm|m4v)(\?|$)/i.test(path);

export const useLiveSessions = () => {
  const fetch = useFetch();
  const load = useCallback(async () => {
    return (await (await fetch('/live')).json()) as LiveSession[];
  }, [fetch]);
  return useSWR('live-sessions', load, { refreshInterval: 5000 });
};

export const useLiveStatus = () => {
  const fetch = useFetch();
  const load = useCallback(async () => {
    return (await (await fetch('/live/status')).json()) as {
      ingest: boolean;
      ingestUrl: string | null;
    };
  }, [fetch]);
  return useSWR('live-status', load, { revalidateOnFocus: false });
};

export const useLiveVideos = (page: number) => {
  const fetch = useFetch();
  const load = useCallback(async () => {
    const body = (await (await fetch(`/media?page=${page}`)).json()) as {
      pages: number;
      results: MediaItem[];
    };
    return { pages: body.pages, videos: body.results.filter((m) => isVideoPath(m.path)) };
  }, [fetch, page]);
  return useSWR(`live-videos-${page}`, load);
};

export const useLiveChannels = () => {
  const fetch = useFetch();
  const load = useCallback(async () => {
    const list = (await (await fetch('/integrations/list')).json()).integrations as {
      id: string;
      name: string;
      identifier: string;
      picture?: string;
      disabled: boolean;
    }[];
    return list.filter(
      (i) => !i.disabled && (i.identifier === 'youtube' || i.identifier === 'facebook')
    );
  }, [fetch]);
  return useSWR('live-channels', load, { revalidateOnFocus: false });
};
