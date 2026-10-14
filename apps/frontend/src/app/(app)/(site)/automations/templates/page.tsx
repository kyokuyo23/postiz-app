import { AutomationTemplates } from '@gitroom/frontend/components/engagement/templates';
export const dynamic = 'force-dynamic';
import { Metadata } from 'next';
import { isGeneralServerSide } from '@gitroom/helpers/utils/is.general.server.side';
export const metadata: Metadata = {
  title: `${isGeneralServerSide() ? 'Postiz' : 'Gitroom'} Automation templates`,
  description: '',
};
export default async function Index() {
  return <AutomationTemplates />;
}
