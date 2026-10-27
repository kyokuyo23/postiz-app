import { AffiliateProducts } from '@gitroom/frontend/components/affiliate/affiliate.products';
export const dynamic = 'force-dynamic';
import { Metadata } from 'next';
import { isGeneralServerSide } from '@gitroom/helpers/utils/is.general.server.side';
export const metadata: Metadata = {
  title: `${isGeneralServerSide() ? 'Postiz' : 'Gitroom'} Affiliate`,
  description: '',
};
export default async function Index() {
  return <AffiliateProducts />;
}
