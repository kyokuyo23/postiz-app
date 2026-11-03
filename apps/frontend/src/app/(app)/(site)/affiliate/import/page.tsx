import { PageImport } from '@gitroom/frontend/components/affiliate/page.import';
export const dynamic = 'force-dynamic';
import { Metadata } from 'next';
import { isGeneralServerSide } from '@gitroom/helpers/utils/is.general.server.side';
export const metadata: Metadata = {
  title: `${isGeneralServerSide() ? 'Postiz' : 'Gitroom'} Import Product`,
  description: '',
};
export default async function Index() {
  return <PageImport />;
}
