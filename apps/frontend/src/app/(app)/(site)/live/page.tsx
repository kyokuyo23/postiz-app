import { LivePage } from '@gitroom/frontend/components/live/live.component';
export const dynamic = 'force-dynamic';
import { Metadata } from 'next';
import { isGeneralServerSide } from '@gitroom/helpers/utils/is.general.server.side';
export const metadata: Metadata = {
  title: `${isGeneralServerSide() ? 'Postiz' : 'Gitroom'} Live`,
  description: '',
};
export default async function Index() {
  return <LivePage />;
}
