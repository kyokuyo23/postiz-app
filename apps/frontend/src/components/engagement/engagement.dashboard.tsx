'use client';

import { FC, useCallback, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useToaster } from '@gitroom/react/toaster/toaster';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { Slider } from '@gitroom/react/form/slider';
import {
  CommentSource,
  CommentStats,
  readError,
  useCommentSources,
  useCommentStats,
} from '@gitroom/frontend/components/engagement/engagement.hooks';
import {
  Card,
  EmptyState,
  PageShell,
  ProviderAvatar,
  Segmented,
  SmallButton,
  StatusDot,
  statusColor,
} from '@gitroom/frontend/components/engagement/engagement.ui';
import { useEngagementTabs } from '@gitroom/frontend/components/engagement/engagement.tabs';

const PERIODS = [3, 7, 14, 30];
const SERIES = [
  { key: 'resolved', status: 'RESOLVED', label: 'Resolved' },
  { key: 'pending', status: 'PENDING', label: 'Pending' },
  { key: 'ignored', status: 'IGNORED', label: 'Ignored' },
] as const;

export const EngagementDashboard: FC = () => {
  const t = useT();
  const tabs = useEngagementTabs();
  const [days, setDays] = useState(3);
  const { data: stats } = useCommentStats(days);
  const { data: sources, mutate: reloadSources } = useCommentSources();

  const broken = (sources || []).filter(
    (s) => s.enabled && (s.refreshNeeded || s.lastError)
  );

  return (
    <PageShell
      title={t('engagement_dashboard', 'Dashboard')}
      description={t(
        'engagement_dashboard_description',
        'Comments from your connected channels, and how they were handled.'
      )}
      tabs={tabs}
    >
      {!!broken.length && (
        <div className="flex items-center gap-[10px] rounded-[10px] border border-red-500/40 bg-red-500/10 px-[16px] py-[12px] text-[14px]">
          <span className="text-red-500 font-[700]">!</span>
          <span>
            {t(
              'engagement_broken_sources',
              'Some channels lost their connection or failed to sync. Reconnect them so their automations keep running:'
            )}{' '}
            <b>{broken.map((b) => b.name).join(', ')}</b>
          </span>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-[12px]">
        <h3 className="flex-1 text-[16px] font-[600]">
          {t('comments', 'Comments')}
        </h3>
        <Segmented
          value={days}
          onChange={setDays}
          options={PERIODS.map((p) => ({
            value: p,
            label: t('n_days', `${p} days`, { n: p }),
          }))}
        />
      </div>

      <StatCards stats={stats} days={days} />
      <PerDay stats={stats} />
      <Sources sources={sources} reload={reloadSources} />
    </PageShell>
  );
};

const StatCards: FC<{ stats?: CommentStats; days: number }> = ({
  stats,
  days,
}) => {
  const t = useT();
  const cards = [
    { label: t('all', 'All'), value: stats?.all, status: '' },
    ...SERIES.map((s) => ({
      label: t(s.key, s.label),
      value: stats?.[s.key],
      status: s.status,
    })),
  ];
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-[16px]">
      {cards.map((c) => (
        <Card key={c.label}>
          <div className="flex items-center gap-[8px] text-[14px]">
            {c.status && <StatusDot status={c.status} />}
            {c.label}
          </div>
          <div className="text-[32px] font-[600] mt-[8px]">
            {c.value ?? '–'}
          </div>
          <div className="text-[12px] text-textItemBlur mt-[4px]">
            {c.value
              ? t('in_previous_n_days', `in the previous ${days} days`, {
                  n: days,
                })
              : t(
                  'no_comments_previous_n_days',
                  `No comments in the previous ${days} days`,
                  { n: days }
                )}
          </div>
        </Card>
      ))}
    </div>
  );
};

const PerDay: FC<{ stats?: CommentStats }> = ({ stats }) => {
  const t = useT();
  const [view, setView] = useState<'chart' | 'table'>('chart');
  const max = useMemo(
    () =>
      Math.max(
        4,
        ...(stats?.perDay || []).map((d) => d.resolved + d.pending + d.ignored)
      ),
    [stats]
  );
  const empty = !stats?.all;

  return (
    <Card>
      <div className="flex flex-wrap items-center gap-[12px] mb-[16px]">
        <div className="flex-1">
          <div className="text-[16px] font-[600]">
            {t('comments_per_day', 'Comments per day')}
          </div>
          <div className="flex gap-[14px] mt-[6px] text-[13px] text-textItemBlur">
            {SERIES.map((s) => (
              <span key={s.key} className="flex items-center gap-[6px]">
                <StatusDot status={s.status} />
                {t(s.key, s.label)}
              </span>
            ))}
          </div>
        </div>
        <Segmented
          value={view}
          onChange={setView}
          options={[
            { value: 'chart', label: t('chart', 'Chart') },
            { value: 'table', label: t('table', 'Table') },
          ]}
        />
      </div>

      {view === 'chart' ? (
        <div className="relative h-[240px] flex items-end gap-[8px] border-b border-newTableBorder">
          {empty && (
            <div className="absolute inset-0 flex items-center justify-center text-[14px] text-textItemBlur">
              {t('no_comments_period', 'No comments in this period yet.')}
            </div>
          )}
          {(stats?.perDay || []).map((d) => (
            <div
              key={d.date}
              className="flex-1 flex flex-col items-center gap-[6px] h-full justify-end"
              title={`${d.date}: ${d.resolved} / ${d.pending} / ${d.ignored}`}
            >
              <div className="w-full max-w-[48px] flex flex-col-reverse rounded-t-[6px] overflow-hidden">
                {SERIES.map((s) => (
                  <div
                    key={s.key}
                    className={statusColor(s.status)}
                    style={{ height: `${(d[s.key] / max) * 200}px` }}
                  />
                ))}
              </div>
              <div className="text-[11px] text-textItemBlur pb-[4px]">
                {dayjs(d.date).format('DD/MM')}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <table className="w-full text-[14px]">
          <thead>
            <tr className="text-textItemBlur text-start">
              <th className="text-start py-[8px]">{t('date', 'Date')}</th>
              {SERIES.map((s) => (
                <th key={s.key} className="text-end py-[8px]">
                  {t(s.key, s.label)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(stats?.perDay || []).map((d) => (
              <tr key={d.date} className="border-t border-newTableBorder">
                <td className="py-[8px]">{dayjs(d.date).format('DD MMM YYYY')}</td>
                <td className="text-end">{d.resolved}</td>
                <td className="text-end">{d.pending}</td>
                <td className="text-end">{d.ignored}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
};

const Sources: FC<{ sources?: CommentSource[]; reload: () => void }> = ({
  sources,
  reload,
}) => {
  const t = useT();
  const fetch = useFetch();
  const toaster = useToaster();
  const [busy, setBusy] = useState<string | null>(null);

  const toggle = useCallback(
    (source: CommentSource) => async (value: 'on' | 'off') => {
      setBusy(source.id);
      const res = await fetch(`/engagement/sources/${source.id}`, {
        method: 'PUT',
        body: JSON.stringify({ enabled: value === 'on' }),
      });
      setBusy(null);
      if (!res.ok) {
        toaster.show(await readError(res, 'Could not update the channel'), 'warning');
      }
      reload();
    },
    [fetch, toaster, reload]
  );

  const syncNow = useCallback(
    (source: CommentSource) => async () => {
      setBusy(source.id);
      const res = await fetch(`/engagement/sources/${source.id}/sync`, {
        method: 'POST',
      });
      setBusy(null);
      if (!res.ok) {
        toaster.show(await readError(res, 'Sync failed'), 'warning');
      } else {
        const { added } = await res.json();
        toaster.show(
          t('sync_done', `Synced, ${added} new comments`, { n: added }),
          'success'
        );
      }
      reload();
    },
    [fetch, t, toaster, reload]
  );

  return (
    <Card>
      <div className="text-[16px] font-[600]">
        {t('comment_sources', 'Comment sources')}
      </div>
      <div className="text-[13px] text-textItemBlur mt-[4px] mb-[12px]">
        {t(
          'comment_sources_description',
          'Turn on the channels whose comments should be collected. New comments are checked about every 10 minutes. Automations only act on comments posted after a channel is turned on.'
        )}
      </div>
      {!sources ? null : !sources.length ? (
        <EmptyState title={t('no_comment_sources', 'No supported channels yet')}>
          {t(
            'no_comment_sources_description',
            'Connect a Threads or YouTube channel to start collecting comments.'
          )}
        </EmptyState>
      ) : (
        <div className="flex flex-col divide-y divide-newTableBorder">
          {sources.map((s) => (
            <div key={s.id} className="flex flex-wrap items-center gap-[12px] py-[12px]">
              <ProviderAvatar picture={s.picture} provider={s.providerIdentifier} />
              <div className="flex-1 min-w-[160px]">
                <div className="text-[14px] font-[500]">{s.name}</div>
                <div className="text-[12px] text-textItemBlur">
                  {s.refreshNeeded
                    ? t('reconnect_needed', 'Reconnect needed')
                    : s.lastError
                    ? `${t('last_error', 'Last error')}: ${s.lastError}`
                    : s.lastSyncAt
                    ? `${t('last_synced', 'Last synced')} ${dayjs(s.lastSyncAt).format('DD MMM HH:mm')}`
                    : s.enabled
                    ? t('waiting_first_sync', 'Waiting for the first sync')
                    : t('off', 'Off')}
                </div>
              </div>
              {s.enabled && (
                <SmallButton onClick={syncNow(s)} disabled={busy === s.id}>
                  {t('sync_now', 'Sync now')}
                </SmallButton>
              )}
              <Slider value={s.enabled ? 'on' : 'off'} onChange={toggle(s)} fill={true} />
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};
