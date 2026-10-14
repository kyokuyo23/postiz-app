import { Research } from '@gitroom/frontend/components/engagement/research';
export const dynamic = 'force-dynamic';
import { Metadata } from 'next';
import { isGeneralServerSide } from '@gitroom/helpers/utils/is.general.server.side';
export const metadata: Metadata = {
  title: `${isGeneralServerSide() ? 'Postiz' : 'Gitroom'} Research`,
  description: '',
};
export default async function Index() {
  return <Research />;
}
