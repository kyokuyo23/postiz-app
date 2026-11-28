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
  useResearchPlatforms,
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

const PLATFORM_LABELS: Record<string, string> = {
  tiktok: 'TikTok',
  youtube: 'YouTube',
  instagram: 'Instagram',
  threads: 'Threads',
  facebook: 'Facebook',
};

const compact = (n?: number) =>
  n === undefined ? '' : new Intl.NumberFormat('en', { notation: 'compact' }).format(n);

export const Research: FC = () => {
  const t = useT();
  const fetch = useFetch();
  const toaster = useToaster();
  const { data: sources } = useCommentSources();
  const { data: keyword } = useResearchPlatforms();
  const channels = (sources || []).filter((s) => s.canResearch);
  const platforms = keyword?.platforms || [];
  // "sc:<platform>" searches through ScrapeCreators, "ch:<id>" through a channel.
  const [source, setSource] = useState('');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<ResearchItem[] | null>(null);

  const firstSource = platforms[0]
    ? `sc:${platforms[0]}`
    : channels[0]
    ? `ch:${channels[0].id}`
    : '';
  useEffect(() => {
    if (!source && firstSource) {
      setSource(firstSource);
    }
  }, [source, firstSource]);
  const selectedChannel = source.startsWith('ch:')
    ? channels.find((c) => c.id === source.slice(3))
    : undefined;

  const search = async (e: FormEvent) => {
    e.preventDefault();
    if (!source || query.trim().length < 2) {
      return;
    }
    setLoading(true);
    const q = encodeURIComponent(query.trim());
    const res = await fetch(
      source.startsWith('sc:')
        ? `/engagement/research/keyword?platform=${encodeURIComponent(
            source.slice(3)
          )}&q=${q}`
        : `/engagement/research?integrationId=${encodeURIComponent(
            source.slice(3)
          )}&q=${q}`
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
        'Find popular public content by keyword on TikTok, YouTube, Instagram, Threads and Facebook.'
      )}
    >
      {sources && keyword && !channels.length && !platforms.length ? (
        <EmptyState title={t('no_research_channels', 'No channel supports research yet')}>
          {t(
            'no_research_channels_description',
            'Set SCRAPECREATORS_API_KEY in backend.env to search TikTok, YouTube, Instagram, Threads and Facebook, or connect a YouTube channel.'
          )}
        </EmptyState>
      ) : (
        <form onSubmit={search} className="flex flex-wrap gap-[12px]">
          <select
            value={source}
            onChange={(e) => setSource(e.target.value)}
            className={clsx(inputClass, 'max-w-[260px]')}
            aria-label={t('research_source', 'Search on')}
          >
            {!!platforms.length && (
              <optgroup label={t('research_public_search', 'Public search')}>
                {platforms.map((p) => (
                  <option key={p} value={`sc:${p}`}>
                    {PLATFORM_LABELS[p] || p}
                  </option>
                ))}
              </optgroup>
            )}
            {!!channels.length && (
              <optgroup label={t('research_my_channels', 'My channels')}>
                {channels.map((c) => (
                  <option key={c.id} value={`ch:${c.id}`}>
                    {c.name} ({c.providerIdentifier})
                  </option>
                ))}
              </optgroup>
            )}
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
        <EmptyState title={t('no_results', 'No results')}>
          {selectedChannel?.researchNote || null}
        </EmptyState>
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
                <img
                  src={item.thumbnail}
                  alt=""
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  className="w-full aspect-video object-cover"
                />
              )}
              <div className="p-[14px] flex flex-col gap-[6px]">
                {item.title && (
                  <div className="text-[14px] font-[600] line-clamp-2">{item.title}</div>
                )}
                {item.text && (
                  <div className="text-[13px] text-textItemBlur line-clamp-3">{item.text}</div>
                )}
                <div className="text-[12px] text-textItemBlur">
                  {item.author}
                  {item.publishedAt
                    ? ` · ${dayjs(item.publishedAt).format('DD MMM YYYY')}`
                    : ''}
                </div>
                {(item.views !== undefined ||
                  item.likes !== undefined ||
                  item.comments !== undefined) && (
                  <div className="text-[12px] flex gap-[12px]">
                    {item.views !== undefined && (
                      <span>{compact(item.views)} {t('views', 'views')}</span>
                    )}
                    {item.likes !== undefined && (
                      <span>{compact(item.likes)} {t('likes', 'likes')}</span>
                    )}
                    {item.comments !== undefined && (
                      <span>{compact(item.comments)} {t('comments', 'comments')}</span>
                    )}
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
