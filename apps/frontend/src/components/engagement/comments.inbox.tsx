'use client';

import { FC, useCallback, useEffect, useState } from 'react';
import dayjs from 'dayjs';
import clsx from 'clsx';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useToaster } from '@gitroom/react/toaster/toaster';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import {
  CommentSource,
  CommentStatus,
  InboxComment,
  readError,
  useCommentSources,
  useInboxComments,
} from '@gitroom/frontend/components/engagement/engagement.hooks';
import {
  Card,
  EmptyState,
  PageShell,
  ProviderAvatar,
  Segmented,
  SmallButton,
  StatusDot,
  inputClass,
} from '@gitroom/frontend/components/engagement/engagement.ui';
import { useEngagementTabs } from '@gitroom/frontend/components/engagement/engagement.tabs';

type StatusFilter = CommentStatus | 'ALL';

export const CommentsInbox: FC = () => {
  const t = useT();
  const tabs = useEngagementTabs();
  const [status, setStatus] = useState<StatusFilter>('PENDING');
  const [integrationId, setIntegrationId] = useState('');
  const [searchDraft, setSearchDraft] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);

  useEffect(() => {
    const id = setTimeout(() => {
      setSearch(searchDraft.trim());
      setPage(0);
    }, 400);
    return () => clearTimeout(id);
  }, [searchDraft]);

  const { data: sources } = useCommentSources();
  const { data, mutate, isLoading } = useInboxComments({
    status: status === 'ALL' ? undefined : status,
    integrationId: integrationId || undefined,
    search: search || undefined,
    page,
  });

  return (
    <PageShell
      title={t('comments', 'Comments')}
      description={t(
        'comments_inbox_description',
        'Reply to, hide or sort comments from all your channels in one place.'
      )}
      tabs={tabs}
    >
      <div className="flex flex-wrap gap-[12px] items-center">
        <Segmented<StatusFilter>
          value={status}
          onChange={(v) => {
            setStatus(v);
            setPage(0);
          }}
          options={[
            { value: 'PENDING', label: t('pending', 'Pending') },
            { value: 'RESOLVED', label: t('resolved', 'Resolved') },
            { value: 'IGNORED', label: t('ignored', 'Ignored') },
            { value: 'ALL', label: t('all', 'All') },
          ]}
        />
        <select
          value={integrationId}
          onChange={(e) => {
            setIntegrationId(e.target.value);
            setPage(0);
          }}
          className={clsx(inputClass, 'max-w-[220px]')}
          aria-label={t('channel', 'Channel')}
        >
          <option value="">{t('all_channels', 'All channels')}</option>
          {(sources || []).map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <input
          value={searchDraft}
          onChange={(e) => setSearchDraft(e.target.value)}
          placeholder={t('search_comments', 'Search text or name…')}
          className={clsx(inputClass, 'max-w-[280px]')}
        />
      </div>

      {sources && !sources.some((s) => s.enabled) ? (
        <EmptyState title={t('no_inbox_sources', 'No channels are collecting comments')}>
          {t(
            'no_inbox_sources_description',
            'Turn on a Threads or YouTube channel under Dashboard → Comment sources.'
          )}
        </EmptyState>
      ) : !isLoading && !data?.comments?.length ? (
        <EmptyState title={t('no_comments_found', 'No comments here')} />
      ) : (
        <div className="flex flex-col gap-[12px]">
          {(data?.comments || []).map((c) => (
            <CommentRow
              key={c.id}
              comment={c}
              source={sources?.find((s) => s.id === c.integrationId)}
              reload={mutate}
            />
          ))}
        </div>
      )}

      {(data?.pages || 0) > 1 && (
        <div className="flex items-center justify-center gap-[12px] text-[14px]">
          <SmallButton disabled={page === 0} onClick={() => setPage(page - 1)}>
            {t('previous', 'Previous')}
          </SmallButton>
          <span className="text-textItemBlur">
            {page + 1} / {data?.pages}
          </span>
          <SmallButton
            disabled={page + 1 >= (data?.pages || 0)}
            onClick={() => setPage(page + 1)}
          >
            {t('next', 'Next')}
          </SmallButton>
        </div>
      )}
    </PageShell>
  );
};

const CommentRow: FC<{
  comment: InboxComment;
  source?: CommentSource;
  reload: () => void;
}> = ({ comment, source, reload }) => {
  const t = useT();
  const fetch = useFetch();
  const toaster = useToaster();
  const [replying, setReplying] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  const call = useCallback(
    async (url: string, method: string, body: object, success?: string) => {
      setBusy(true);
      const res = await fetch(url, { method, body: JSON.stringify(body) });
      setBusy(false);
      if (!res.ok) {
        toaster.show(await readError(res, 'Something went wrong'), 'warning');
        return false;
      }
      if (success) {
        toaster.show(success, 'success');
      }
      reload();
      return true;
    },
    [fetch, toaster, reload]
  );

  const setStatus = (status: CommentStatus) =>
    call(`/engagement/comments/${comment.id}/status`, 'PUT', { status });

  const sendReply = async () => {
    if (!text.trim()) {
      return;
    }
    const ok = await call(
      `/engagement/comments/${comment.id}/reply`,
      'POST',
      { text },
      t('reply_sent', 'Reply sent')
    );
    if (ok) {
      setText('');
      setReplying(false);
    }
  };

  const canReply = source?.capabilities?.reply;
  const canHide = source?.capabilities?.hide;

  return (
    <Card className="!p-[16px]">
      <div className="flex gap-[12px]">
        <ProviderAvatar
          picture={comment.authorPicture || comment.integration.picture}
          provider={comment.integration.providerIdentifier}
          size={36}
        />
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-x-[8px] gap-y-[2px] text-[13px]">
            <span className="font-[600] text-[14px]">{comment.authorName}</span>
            <span className="text-textItemBlur">
              {t('on_channel', 'on')} {comment.integration.name} ·{' '}
              {dayjs(comment.publishedAt).format('DD MMM YYYY HH:mm')}
            </span>
            <span className="flex items-center gap-[4px] text-textItemBlur">
              <StatusDot status={comment.status} />
              {t(comment.status.toLowerCase(), comment.status.toLowerCase())}
            </span>
            {comment.hidden && (
              <span className="text-[12px] px-[6px] rounded-[4px] bg-btnSimple">
                {t('hidden', 'Hidden')}
              </span>
            )}
          </div>
          <div className="text-[14px] mt-[6px] whitespace-pre-wrap break-words">
            {comment.text}
          </div>
          {comment.postUrl && (
            <a
              href={comment.postUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[12px] text-textItemBlur underline mt-[6px] inline-block truncate max-w-full"
            >
              {comment.postText
                ? comment.postText.slice(0, 80)
                : t('view_post', 'View post')}
            </a>
          )}
          {comment.repliedText && (
            <div className="mt-[8px] border-s-2 border-btnPrimary ps-[10px] text-[13px]">
              <div className="text-textItemBlur text-[12px]">
                {comment.resolvedBy?.startsWith('automation:')
                  ? t('auto_replied', 'Replied by automation')
                  : t('you_replied', 'You replied')}
              </div>
              {comment.repliedText}
            </div>
          )}

          {replying && (
            <div className="mt-[10px] flex flex-col gap-[8px]">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                maxLength={500}
                rows={3}
                autoFocus
                placeholder={t('write_reply', 'Write a public reply…')}
                className="bg-newBgColorInner border border-newTableBorder rounded-[8px] p-[10px] text-[14px] outline-none"
              />
              <div className="flex gap-[8px] justify-end items-center">
                <span className="text-[12px] text-textItemBlur me-auto">
                  {text.length}/500
                </span>
                <SmallButton onClick={() => setReplying(false)}>
                  {t('cancel', 'Cancel')}
                </SmallButton>
                <SmallButton
                  variant="primary"
                  onClick={sendReply}
                  disabled={busy || !text.trim()}
                >
                  {t('send_reply', 'Send reply')}
                </SmallButton>
              </div>
            </div>
          )}

          {!replying && (
            <div className="flex flex-wrap gap-[8px] mt-[10px]">
              {canReply && (
                <SmallButton variant="primary" onClick={() => setReplying(true)}>
                  {t('reply', 'Reply')}
                </SmallButton>
              )}
              {comment.status !== 'RESOLVED' && (
                <SmallButton disabled={busy} onClick={() => setStatus('RESOLVED')}>
                  {t('mark_resolved', 'Mark resolved')}
                </SmallButton>
              )}
              {comment.status !== 'IGNORED' && (
                <SmallButton disabled={busy} onClick={() => setStatus('IGNORED')}>
                  {t('ignore', 'Ignore')}
                </SmallButton>
              )}
              {comment.status !== 'PENDING' && (
                <SmallButton disabled={busy} onClick={() => setStatus('PENDING')}>
                  {t('move_to_pending', 'Move to pending')}
                </SmallButton>
              )}
              {canHide && (
                <SmallButton
                  disabled={busy}
                  onClick={() =>
                    call(`/engagement/comments/${comment.id}/hide`, 'POST', {
                      hide: !comment.hidden,
                    })
                  }
                >
                  {comment.hidden ? t('unhide', 'Unhide') : t('hide', 'Hide')}
                </SmallButton>
              )}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
};
