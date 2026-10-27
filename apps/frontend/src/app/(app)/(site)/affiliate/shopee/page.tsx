import { ShopeeResearch } from '@gitroom/frontend/components/affiliate/shopee.research';
export const dynamic = 'force-dynamic';
import { Metadata } from 'next';
import { isGeneralServerSide } from '@gitroom/helpers/utils/is.general.server.side';
export const metadata: Metadata = {
  title: `${isGeneralServerSide() ? 'Postiz' : 'Gitroom'} Riset Shopee`,
  description: '',
};
export default async function Index() {
  return <ShopeeResearch />;
}
