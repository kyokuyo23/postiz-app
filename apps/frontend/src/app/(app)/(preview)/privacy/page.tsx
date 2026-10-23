import { Metadata } from 'next';
import {
  Contact,
  H2,
  LegalPage,
  legalOwner,
} from '@gitroom/frontend/components/legal/legal.page';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'How this social media management service handles your data.',
};

export default function PrivacyPage() {
  const owner = legalOwner();
  return (
    <LegalPage title="Privacy Policy">
      <p>
        This service is a social media management tool operated by {owner}{' '}
        (&quot;we&quot;). It lets you schedule posts to your own social media
        accounts, read and reply to comments on your own content, and view
        analytics. This policy explains what data we process and why.
      </p>

      <H2>Data we collect</H2>
      <ul className="list-disc ps-[20px]">
        <li>
          <b>Account data:</b> your name, email address and a hashed
          password, used to sign you in.
        </li>
        <li>
          <b>Connected social accounts:</b> when you connect a channel (for
          example YouTube), we store the access and refresh tokens the platform
          issues, plus the channel name, ID and profile picture.
        </li>
        <li>
          <b>Content you create:</b> posts, media you upload, schedules,
          automation rules and templates.
        </li>
        <li>
          <b>Data from connected platforms:</b> comments on your own posts and
          videos (author name, profile picture, text, date), basic post
          statistics, and results of searches you run in the Research feature.
        </li>
      </ul>

      <H2>How we use it</H2>
      <p>
        Only to provide the features you use: publishing and scheduling your
        posts, showing comments in your inbox, posting replies you write or
        that your own automation rules generate, hiding comments when you ask,
        and showing analytics. We do not sell your data, do not use it for
        advertising, and do not share it with third parties except the
        platforms you connect, which receive the actions you request.
      </p>

      <H2>Google and YouTube data</H2>
      <p>
        This service uses YouTube API Services. By connecting a YouTube
        channel you also agree to the{' '}
        <a className="underline" href="https://www.youtube.com/t/terms">
          YouTube Terms of Service
        </a>
        , and Google&apos;s handling of your data is described in the{' '}
        <a className="underline" href="https://policies.google.com/privacy">
          Google Privacy Policy
        </a>
        .
      </p>
      <p>
        Our use and transfer of information received from Google APIs adheres
        to the{' '}
        <a
          className="underline"
          href="https://developers.google.com/terms/api-services-user-data-policy"
        >
          Google API Services User Data Policy
        </a>
        , including the Limited Use requirements. YouTube data is used only to
        provide the features described above, is never used to train AI
        models, and is never transferred to others except as needed to provide
        those features or to comply with law.
      </p>
      <p>
        You can revoke this service&apos;s access to your Google account at
        any time at{' '}
        <a
          className="underline"
          href="https://myaccount.google.com/permissions"
        >
          myaccount.google.com/permissions
        </a>
        , or by removing the channel inside the app.
      </p>

      <H2>Storage and security</H2>
      <p>
        Data is stored on servers we control, transmitted over HTTPS, and
        accessible only to the people who operate the service.
      </p>

      <H2>Retention and deletion</H2>
      <p>
        We keep your data while your account is active. When you remove a
        connected channel, the service stops using it and stops collecting its
        data. To have a channel&apos;s tokens and collected data, or your
        whole account, permanently deleted, contact <Contact />; we complete
        such requests within 30 days. If you revoke access in your Google
        account, we can no longer retrieve any YouTube data.
      </p>

      <H2>Contact</H2>
      <p>
        Questions about this policy: <Contact />.
      </p>
    </LegalPage>
  );
}
