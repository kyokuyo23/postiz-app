'use client';

import { FC, KeyboardEvent, ReactNode, useCallback, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';

export const PageShell: FC<{
  title: string;
  description?: string;
  tabs?: { label: string; href: string }[];
  actions?: ReactNode;
  children: ReactNode;
}> = ({ title, description, tabs, actions, children }) => {
  const pathname = usePathname();
  return (
    <div className="bg-newBgColorInner flex-1 flex flex-col p-[20px] gap-[20px] overflow-auto">
      <div className="flex flex-wrap items-start gap-[12px]">
        <div className="flex-1 min-w-[200px]">
          <h2 className="text-[20px] font-[600]">{title}</h2>
          {description && (
            <div className="text-[14px] text-textItemBlur mt-[4px]">
              {description}
            </div>
          )}
        </div>
        {actions}
      </div>
      {!!tabs?.length && (
        <div className="flex gap-[4px] border-b border-newTableBorder">
          {tabs.map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              className={clsx(
                'px-[14px] py-[10px] text-[14px] font-[500] -mb-px border-b-2 transition-colors',
                pathname === tab.href
                  ? 'border-btnPrimary text-textColor'
                  : 'border-transparent text-textItemBlur hover:text-textColor'
              )}
            >
              {tab.label}
            </Link>
          ))}
        </div>
      )}
      {children}
    </div>
  );
};

export const Card: FC<{ className?: string; children: ReactNode }> = ({
  className,
  children,
}) => (
  <div
    className={clsx(
      'bg-newBgColor border border-newTableBorder rounded-[12px] p-[20px]',
      className
    )}
  >
    {children}
  </div>
);

export const Segmented = <T extends string | number>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { label: string; value: T }[];
  onChange: (value: T) => void;
}) => (
  <div className="flex bg-newBgColor border border-newTableBorder rounded-[8px] p-[3px]">
    {options.map((o) => (
      <button
        type="button"
        key={String(o.value)}
        onClick={() => onChange(o.value)}
        className={clsx(
          'px-[12px] h-[30px] rounded-[6px] text-[13px] transition-colors',
          value === o.value
            ? 'bg-newBgColorInner text-textColor font-[600]'
            : 'text-textItemBlur hover:text-textColor'
        )}
      >
        {o.label}
      </button>
    ))}
  </div>
);

export const inputClass =
  'h-[42px] bg-newBgColorInner px-[14px] outline-none border-newTableBorder border rounded-[8px] text-[14px] text-textColor w-full';

export const SmallButton: FC<{
  onClick?: () => void;
  children: ReactNode;
  variant?: 'primary' | 'simple' | 'danger';
  disabled?: boolean;
  type?: 'button' | 'submit';
}> = ({ onClick, children, variant = 'simple', disabled, type = 'button' }) => (
  <button
    type={type}
    onClick={onClick}
    disabled={disabled}
    className={clsx(
      'h-[32px] px-[12px] rounded-[8px] text-[13px] font-[500] whitespace-nowrap transition-opacity',
      disabled && 'opacity-50 pointer-events-none',
      variant === 'primary' && 'bg-btnPrimary text-white hover:opacity-90',
      variant === 'simple' && 'bg-btnSimple text-btnText hover:opacity-80',
      variant === 'danger' && 'bg-red-600 text-white hover:opacity-90'
    )}
  >
    {children}
  </button>
);

const STATUS_STYLE: Record<string, string> = {
  PENDING: 'bg-amber-500',
  RESOLVED: 'bg-textColor',
  IGNORED: 'bg-gray-400',
};

export const StatusDot: FC<{ status: string }> = ({ status }) => (
  <span
    className={clsx(
      'inline-block w-[10px] h-[10px] rounded-[3px]',
      STATUS_STYLE[status]
    )}
  />
);

export const statusColor = (status: string) => STATUS_STYLE[status];

/** Tag input: Enter or comma adds a keyword. */
export const ChipsInput: FC<{
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
}> = ({ value, onChange, placeholder }) => {
  const [draft, setDraft] = useState('');
  const commit = useCallback(() => {
    const parts = draft
      .split(',')
      .map((p) => p.trim())
      .filter((p) => p && !value.includes(p));
    if (parts.length) {
      onChange([...value, ...parts]);
    }
    setDraft('');
  }, [draft, value, onChange]);
  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        commit();
      } else if (e.key === 'Backspace' && !draft && value.length) {
        onChange(value.slice(0, -1));
      }
    },
    [commit, draft, value, onChange]
  );
  return (
    <div className="min-h-[42px] bg-newBgColorInner border border-newTableBorder rounded-[8px] px-[8px] py-[6px] flex flex-wrap gap-[6px] items-center">
      {value.map((chip) => (
        <span
          key={chip}
          className="flex items-center gap-[4px] bg-boxFocused text-textItemFocused rounded-[6px] px-[8px] h-[26px] text-[13px]"
        >
          {chip}
          <button
            type="button"
            aria-label={`Remove ${chip}`}
            onClick={() => onChange(value.filter((v) => v !== chip))}
            className="opacity-70 hover:opacity-100"
          >
            ×
          </button>
        </span>
      ))}
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={commit}
        placeholder={value.length ? '' : placeholder}
        className="flex-1 min-w-[120px] bg-transparent outline-none text-[14px] h-[28px]"
      />
    </div>
  );
};

export const EmptyState: FC<{ title: string; children?: ReactNode }> = ({
  title,
  children,
}) => (
  <div className="flex flex-col items-center justify-center text-center gap-[8px] py-[48px] text-textItemBlur">
    <div className="text-[16px] font-[600] text-textColor">{title}</div>
    {children && <div className="text-[14px] max-w-[460px]">{children}</div>}
  </div>
);

export const ProviderAvatar: FC<{
  picture?: string;
  provider: string;
  size?: number;
}> = ({ picture, provider, size = 32 }) => (
  <div className="relative shrink-0" style={{ width: size, height: size }}>
    {picture ? (
      <img
        src={picture}
        alt=""
        className="rounded-full w-full h-full object-cover"
      />
    ) : (
      <div className="rounded-full w-full h-full bg-btnSimple" />
    )}
    <img
      src={`/icons/platforms/${provider}.png`}
      alt={provider}
      className="absolute -bottom-[2px] -end-[2px] w-[14px] h-[14px] rounded-full border border-newBgColorInner"
    />
  </div>
);
