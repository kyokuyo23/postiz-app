import { Metadata } from 'next';
import {
  Contact,
  H2,
  LegalPage,
  legalOwner,
} from '@gitroom/frontend/components/legal/legal.page';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'Terms for using this social media management service.',
};

export default function TermsPage() {
  const owner = legalOwner();
  return (
    <LegalPage title="Terms of Service">
      <p>
        These terms apply to your use of this social media management service,
        operated by {owner}. By creating an account you agree to them.
      </p>

      <H2>Your account and content</H2>
      <p>
        You are responsible for your account, for keeping your password safe,
        and for all content you publish or reply with through the service,
        including replies sent by automation rules you create. You keep all
        rights to your content.
      </p>

      <H2>Connected platforms</H2>
      <p>
        When you connect a social media account you must follow that
        platform&apos;s own terms. For YouTube this means the{' '}
        <a className="underline" href="https://www.youtube.com/t/terms">
          YouTube Terms of Service
        </a>
        . The service acts only on accounts you are authorised to manage and
        only through the platforms&apos; official APIs.
      </p>

      <H2>Acceptable use</H2>
      <p>
        Do not use the service for spam, harassment, misleading content, or
        anything that breaks the law or a platform&apos;s rules. We may suspend
        accounts that do.
      </p>

      <H2>Availability</H2>
      <p>
        The service is provided as is. Platforms can change or limit their APIs
        at any time, so some features may stop working without notice. We are
        not liable for losses caused by outages, platform changes, or content
        you publish.
      </p>

      <H2>Privacy</H2>
      <p>
        How we handle data is described in our{' '}
        <a className="underline" href="/privacy">
          Privacy Policy
        </a>
        .
      </p>

      <H2>Contact</H2>
      <p>
        Questions about these terms: <Contact />.
      </p>
    </LegalPage>
  );
}
