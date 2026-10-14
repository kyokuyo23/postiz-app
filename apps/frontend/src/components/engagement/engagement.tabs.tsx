'use client';

import { useT } from '@gitroom/react/translation/get.transation.service.client';

export const useEngagementTabs = () => {
  const t = useT();
  return [
    { label: t('dashboard', 'Dashboard'), href: '/engagement' },
    { label: t('comments', 'Comments'), href: '/engagement/comments' },
    {
      label: t('conversations', 'Conversations'),
      href: '/engagement/conversations',
    },
  ];
};

export const useAutomationTabs = () => {
  const t = useT();
  return [
    { label: t('automation_rules', 'Automation rules'), href: '/automations' },
    { label: t('automation_templates', 'Templates'), href: '/automations/templates' },
  ];
};
