import { EngagementDashboard } from '@gitroom/frontend/components/engagement/engagement.dashboard';
export const dynamic = 'force-dynamic';
import { Metadata } from 'next';
import { isGeneralServerSide } from '@gitroom/helpers/utils/is.general.server.side';
export const metadata: Metadata = {
  title: `${isGeneralServerSide() ? 'Postiz' : 'Gitroom'} Engagement`,
  description: '',
};
export default async function Index() {
  return <EngagementDashboard />;
}
