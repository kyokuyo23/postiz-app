'use client';

import { FC } from 'react';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { EmptyState, PageShell } from '@gitroom/frontend/components/engagement/engagement.ui';
import { useEngagementTabs } from '@gitroom/frontend/components/engagement/engagement.tabs';
import { useCommentSources } from '@gitroom/frontend/components/engagement/engagement.hooks';

/**
 * Direct-message inbox. None of the currently supported comment channels
 * (Threads, YouTube) offer a messaging API, so this page explains that
 * instead of showing an empty, misleading inbox.
 */
export const Conversations: FC = () => {
  const t = useT();
  const tabs = useEngagementTabs();
  const { data: sources } = useCommentSources();
  const withDm = (sources || []).filter((s) => s.capabilities?.directMessage);

  return (
    <PageShell
      title={t('conversations', 'Conversations')}
      description={t(
        'conversations_description',
        'Private messages with your audience.'
      )}
      tabs={tabs}
    >
      {!withDm.length && (
        <EmptyState
          title={t('dm_not_available', 'Direct messages are not available yet')}
        >
          {t(
            'dm_not_available_description',
            'Threads and YouTube do not offer an API for private messages. Conversations will appear here once a channel with messaging support (such as Instagram or a Facebook Page, after Meta approval) is added.'
          )}
        </EmptyState>
      )}
    </PageShell>
  );
};
