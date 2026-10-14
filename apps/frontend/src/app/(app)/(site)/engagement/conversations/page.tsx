import { Conversations } from '@gitroom/frontend/components/engagement/conversations';
export const dynamic = 'force-dynamic';
import { Metadata } from 'next';
import { isGeneralServerSide } from '@gitroom/helpers/utils/is.general.server.side';
export const metadata: Metadata = {
  title: `${isGeneralServerSide() ? 'Postiz' : 'Gitroom'} Conversations`,
  description: '',
};
export default async function Index() {
  return <Conversations />;
}
