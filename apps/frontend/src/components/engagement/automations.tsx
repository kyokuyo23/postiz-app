'use client';

import { FC, useCallback } from 'react';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useToaster } from '@gitroom/react/toaster/toaster';
import { useModals } from '@gitroom/frontend/components/layout/new-modal';
import { deleteDialog } from '@gitroom/react/helpers/delete.dialog';
import { Slider } from '@gitroom/react/form/slider';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import {
  CommentAutomation,
  readError,
  useCommentAutomations,
  useCommentSources,
} from '@gitroom/frontend/components/engagement/engagement.hooks';
import {
  Card,
  EmptyState,
  PageShell,
  SmallButton,
  StatusDot,
} from '@gitroom/frontend/components/engagement/engagement.ui';
import { useAutomationTabs } from '@gitroom/frontend/components/engagement/engagement.tabs';
import { RuleForm } from '@gitroom/frontend/components/engagement/rule.form';

export const Automations: FC = () => {
  const t = useT();
  const fetch = useFetch();
  const toaster = useToaster();
  const modals = useModals();
  const tabs = useAutomationTabs();
  const { data, mutate } = useCommentAutomations();
  const { data: sources } = useCommentSources();

  const open = useCallback(
    (rule?: CommentAutomation) => () => {
      modals.openModal({
        title: rule
          ? t('edit_automation', 'Edit automation')
          : t('new_automation', 'New automation'),
        withCloseButton: true,
        children: (
          <RuleForm
            mode="automation"
            id={rule?.id}
            initial={
              rule
                ? {
                    ...rule,
                    replies: rule.replies.length ? rule.replies : [''],
                  }
                : undefined
            }
            onSaved={() => mutate()}
          />
        ),
      });
    },
    [modals, t, mutate]
  );

  const toggle = useCallback(
    (rule: CommentAutomation) => async (value: 'on' | 'off') => {
      const res = await fetch(`/engagement/automations/${rule.id}/active`, {
        method: 'POST',
        body: JSON.stringify({ active: value === 'on' }),
      });
      if (!res.ok) {
        toaster.show(await readError(res, 'Could not update'), 'warning');
      }
      mutate();
    },
    [fetch, toaster, mutate]
  );

  const remove = useCallback(
    (rule: CommentAutomation) => async () => {
      if (
        !(await deleteDialog(
          t('delete_automation_confirm', `Delete automation "${rule.name}"?`, {
            name: rule.name,
          })
        ))
      ) {
        return;
      }
      await fetch(`/engagement/automations/${rule.id}`, { method: 'DELETE' });
      mutate();
    },
    [fetch, t, mutate]
  );

  const channelNames = (ids: string[]) =>
    ids.length
      ? ids
          .map((id) => sources?.find((s) => s.id === id)?.name)
          .filter(Boolean)
          .join(', ') || t('removed_channels', 'Removed channels')
      : t('all_channels', 'All channels');

  return (
    <PageShell
      title={t('automation', 'Automation')}
      description={t(
        'automation_description',
        'Rules run on new comments, top to bottom; the first matching rule wins.'
      )}
      tabs={tabs}
      actions={
        <SmallButton variant="primary" onClick={open()}>
          {t('new_automation', 'New automation')}
        </SmallButton>
      }
    >
      {data && !data.length ? (
        <EmptyState title={t('no_automations', 'No automations yet')}>
          {t(
            'no_automations_description',
            'Create one from scratch or start from a template.'
          )}
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-[12px]">
          {(data || []).map((rule, index) => (
            <Card key={rule.id} className="!p-[16px]">
              <div className="flex flex-wrap items-start gap-[12px]">
                <div className="text-[13px] text-textItemBlur w-[24px] pt-[2px]">
                  #{index + 1}
                </div>
                <div className="flex-1 min-w-[220px]">
                  <div className="text-[15px] font-[600]">{rule.name}</div>
                  <div className="text-[13px] text-textItemBlur mt-[4px]">
                    {rule.matchType === 'every'
                      ? t('match_every', 'Every comment')
                      : `${
                          rule.matchType === 'all'
                            ? t('contains_all', 'Contains all of')
                            : t('contains_any', 'Contains any of')
                        }: ${rule.keywords.join(', ')}`}
                  </div>
                  <div className="text-[13px] text-textItemBlur mt-[2px]">
                    {[
                      rule.replies.length &&
                        t('n_replies', `${rule.replies.length} reply variation(s)`, {
                          n: rule.replies.length,
                        }),
                      rule.hide && t('hides_comment', 'hides comment'),
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                    {' · '}
                    <span className="inline-flex items-center gap-[4px]">
                      <StatusDot status={rule.markAs} />
                      {t(rule.markAs.toLowerCase(), rule.markAs.toLowerCase())}
                    </span>
                  </div>
                  <div className="text-[12px] text-textItemBlur mt-[2px]">
                    {channelNames(rule.integrations)} ·{' '}
                    {t('ran_n_times', `ran ${rule.runs} times`, { n: rule.runs })}
                  </div>
                </div>
                <div className="flex items-center gap-[8px]">
                  <SmallButton onClick={open(rule)}>{t('edit', 'Edit')}</SmallButton>
                  <SmallButton onClick={remove(rule)}>{t('delete', 'Delete')}</SmallButton>
                  <Slider
                    value={rule.active ? 'on' : 'off'}
                    onChange={toggle(rule)}
                    fill={true}
                  />
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </PageShell>
  );
};
