'use client';

import { FC, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useToaster } from '@gitroom/react/toaster/toaster';
import { useModals } from '@gitroom/frontend/components/layout/new-modal';
import { deleteDialog } from '@gitroom/react/helpers/delete.dialog';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import {
  CommentTemplate,
  readError,
  useCommentAutomations,
  useCommentTemplates,
} from '@gitroom/frontend/components/engagement/engagement.hooks';
import {
  Card,
  PageShell,
  SmallButton,
} from '@gitroom/frontend/components/engagement/engagement.ui';
import { useAutomationTabs } from '@gitroom/frontend/components/engagement/engagement.tabs';
import { RuleForm } from '@gitroom/frontend/components/engagement/rule.form';

export const AutomationTemplates: FC = () => {
  const t = useT();
  const fetch = useFetch();
  const toaster = useToaster();
  const modals = useModals();
  const router = useRouter();
  const tabs = useAutomationTabs();
  const { data, mutate } = useCommentTemplates();
  const { mutate: reloadAutomations } = useCommentAutomations();

  const open = useCallback(
    (template?: CommentTemplate) => () => {
      modals.openModal({
        title: template
          ? t('edit_template', 'Edit template')
          : t('new_template', 'New template'),
        withCloseButton: true,
        children: (
          <RuleForm
            mode="template"
            id={template?.id}
            initial={
              template
                ? {
                    ...template,
                    replies: template.replies.length ? template.replies : [''],
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

  const use = useCallback(
    (template: CommentTemplate) => async () => {
      const res = await fetch(
        `/engagement/automations/templates/${template.id}/use`,
        { method: 'POST' }
      );
      if (!res.ok) {
        toaster.show(await readError(res, 'Could not use template'), 'warning');
        return;
      }
      toaster.show(
        t(
          'template_used',
          'Automation created (turned off). Review it, then switch it on.'
        ),
        'success'
      );
      await reloadAutomations();
      router.push('/automations');
    },
    [fetch, toaster, t, router, reloadAutomations]
  );

  const remove = useCallback(
    (template: CommentTemplate) => async () => {
      if (
        !(await deleteDialog(
          t('delete_template_confirm', `Delete template "${template.name}"?`, {
            name: template.name,
          })
        ))
      ) {
        return;
      }
      await fetch(`/engagement/automations/templates/${template.id}`, {
        method: 'DELETE',
      });
      mutate();
    },
    [fetch, t, mutate]
  );

  return (
    <PageShell
      title={t('automation_templates', 'Templates')}
      description={t(
        'automation_templates_description',
        'Ready-made rules. Using a template creates an automation that starts switched off.'
      )}
      tabs={tabs}
      actions={
        <SmallButton variant="primary" onClick={open()}>
          {t('new_template', 'New template')}
        </SmallButton>
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-[16px]">
        {(data || []).map((template) => (
          <Card key={template.id} className="flex flex-col gap-[8px]">
            <div className="flex items-center gap-[8px]">
              <div className="text-[15px] font-[600] flex-1">{template.name}</div>
              {template.builtIn && (
                <span className="text-[11px] px-[6px] py-[2px] rounded-[4px] bg-boxFocused text-textItemFocused">
                  {t('built_in', 'Built-in')}
                </span>
              )}
            </div>
            {template.description && (
              <div className="text-[13px] text-textItemBlur">{template.description}</div>
            )}
            {template.matchType !== 'every' && !!template.keywords.length && (
              <div className="flex flex-wrap gap-[6px]">
                {template.keywords.map((k) => (
                  <span
                    key={k}
                    className="text-[12px] px-[8px] h-[22px] flex items-center rounded-[6px] bg-btnSimple"
                  >
                    {k}
                  </span>
                ))}
              </div>
            )}
            {!!template.replies.length && (
              <div className="text-[13px] italic text-textItemBlur">
                “{template.replies[0]}”
              </div>
            )}
            <div className="flex gap-[8px] mt-auto pt-[8px]">
              <SmallButton variant="primary" onClick={use(template)}>
                {t('use_template', 'Use template')}
              </SmallButton>
              {!template.builtIn && (
                <>
                  <SmallButton onClick={open(template)}>{t('edit', 'Edit')}</SmallButton>
                  <SmallButton onClick={remove(template)}>{t('delete', 'Delete')}</SmallButton>
                </>
              )}
            </div>
          </Card>
        ))}
      </div>
    </PageShell>
  );
};
