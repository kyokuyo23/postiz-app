import { CommentsInbox } from '@gitroom/frontend/components/engagement/comments.inbox';
export const dynamic = 'force-dynamic';
import { Metadata } from 'next';
import { isGeneralServerSide } from '@gitroom/helpers/utils/is.general.server.side';
export const metadata: Metadata = {
  title: `${isGeneralServerSide() ? 'Postiz' : 'Gitroom'} Comments`,
  description: '',
};
export default async function Index() {
  return <CommentsInbox />;
}
