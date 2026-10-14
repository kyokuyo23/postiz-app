'use client';

import { FC, FormEvent, useEffect, useState } from 'react';
import dayjs from 'dayjs';
import clsx from 'clsx';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useToaster } from '@gitroom/react/toaster/toaster';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import {
  readError,
  useCommentSources,
} from '@gitroom/frontend/components/engagement/engagement.hooks';
import {
  Card,
  EmptyState,
  PageShell,
  SmallButton,
  inputClass,
} from '@gitroom/frontend/components/engagement/engagement.ui';

interface ResearchItem {
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

const compact = (n?: number) =>
  n === undefined ? '' : new Intl.NumberFormat('en', { notation: 'compact' }).format(n);

export const Research: FC = () => {
  const t = useT();
  const fetch = useFetch();
  const toaster = useToaster();
  const { data: sources } = useCommentSources();
  const channels = (sources || []).filter((s) => s.canResearch);
  const [integrationId, setIntegrationId] = useState('');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<ResearchItem[] | null>(null);

  const firstChannel = channels[0]?.id;
  useEffect(() => {
    if (!integrationId && firstChannel) {
      setIntegrationId(firstChannel);
    }
  }, [integrationId, firstChannel]);

  const search = async (e: FormEvent) => {
    e.preventDefault();
    if (!integrationId || query.trim().length < 2) {
      return;
    }
    setLoading(true);
    const res = await fetch(
      `/engagement/research?integrationId=${encodeURIComponent(
        integrationId
      )}&q=${encodeURIComponent(query.trim())}`
    );
    setLoading(false);
    if (!res.ok) {
      toaster.show(await readError(res, 'Search failed'), 'warning');
      return;
    }
    setResults(await res.json());
  };

  return (
    <PageShell
      title={t('research', 'Research')}
      description={t(
        'research_description',
        'Find popular public content by keyword through the platform’s official search API.'
      )}
    >
      {sources && !channels.length ? (
        <EmptyState title={t('no_research_channels', 'No channel supports research yet')}>
          {t(
            'no_research_channels_description',
            'Connect a YouTube channel. Threads keyword search needs Meta approval for the threads_keyword_search permission.'
          )}
        </EmptyState>
      ) : (
        <form onSubmit={search} className="flex flex-wrap gap-[12px]">
          <select
            value={integrationId}
            onChange={(e) => setIntegrationId(e.target.value)}
            className={clsx(inputClass, 'max-w-[240px]')}
            aria-label={t('channel', 'Channel')}
          >
            {channels.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.providerIdentifier})
              </option>
            ))}
          </select>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('research_placeholder', 'Keyword, e.g. "resep sambal"')}
            minLength={2}
            maxLength={100}
            className={clsx(inputClass, 'flex-1 min-w-[200px]')}
          />
          <SmallButton type="submit" variant="primary" disabled={loading}>
            {t('search', 'Search')}
          </SmallButton>
        </form>
      )}

      {results && !results.length && (
        <EmptyState title={t('no_results', 'No results')} />
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-[16px]">
        {(results || []).map((item) => (
          <a
            key={item.id}
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block"
          >
            <Card className="!p-[0] overflow-hidden h-full hover:border-btnPrimary transition-colors">
              {item.thumbnail && (
                <img src={item.thumbnail} alt="" className="w-full aspect-video object-cover" />
              )}
              <div className="p-[14px] flex flex-col gap-[6px]">
                {item.title && (
                  <div className="text-[14px] font-[600] line-clamp-2">{item.title}</div>
                )}
                {item.text && (
                  <div className="text-[13px] text-textItemBlur line-clamp-3">{item.text}</div>
                )}
                <div className="text-[12px] text-textItemBlur">
                  {item.author} · {dayjs(item.publishedAt).format('DD MMM YYYY')}
                </div>
                {item.views !== undefined && (
                  <div className="text-[12px] flex gap-[12px]">
                    <span>{compact(item.views)} {t('views', 'views')}</span>
                    <span>{compact(item.likes)} {t('likes', 'likes')}</span>
                    <span>{compact(item.comments)} {t('comments', 'comments')}</span>
                  </div>
                )}
              </div>
            </Card>
          </a>
        ))}
      </div>
    </PageShell>
  );
};
