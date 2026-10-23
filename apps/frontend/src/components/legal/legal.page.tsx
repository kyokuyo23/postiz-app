import { FC, ReactNode } from 'react';

/**
 * Public legal pages (privacy policy, terms). The operator name and contact
 * address come from NEXT_PUBLIC_LEGAL_OWNER / NEXT_PUBLIC_LEGAL_CONTACT_EMAIL
 * so each deployment shows its own details.
 */
export const legalOwner = () =>
  process.env.NEXT_PUBLIC_LEGAL_OWNER || 'The operator of this service';

export const legalContact = () =>
  process.env.NEXT_PUBLIC_LEGAL_CONTACT_EMAIL || '';

export const LEGAL_UPDATED = '23 October 2026';

export const Contact: FC = () => {
  const email = legalContact();
  return email ? (
    <a className="underline" href={`mailto:${email}`}>
      {email}
    </a>
  ) : (
    <span>the contact address provided by the operator</span>
  );
};

export const LegalPage: FC<{ title: string; children: ReactNode }> = ({
  title,
  children,
}) => (
  <div className="min-h-screen w-full bg-newBgColor text-textColor overflow-auto">
    <div className="mx-auto max-w-[760px] px-[20px] py-[48px] flex flex-col gap-[20px] text-[15px] leading-[1.7]">
      <h1 className="text-[28px] font-[600]">{title}</h1>
      <div className="text-[13px] text-textItemBlur">
        Last updated: {LEGAL_UPDATED}
      </div>
      {children}
      <div className="pt-[24px] border-t border-newTableBorder text-[13px] text-textItemBlur flex gap-[16px]">
        <a className="underline" href="/privacy">
          Privacy Policy
        </a>
        <a className="underline" href="/terms">
          Terms of Service
        </a>
      </div>
    </div>
  </div>
);

export const H2: FC<{ children: ReactNode }> = ({ children }) => (
  <h2 className="text-[18px] font-[600] mt-[12px]">{children}</h2>
);
