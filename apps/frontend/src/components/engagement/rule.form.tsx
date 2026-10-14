'use client';

import { FC, FormEvent, useState } from 'react';
import clsx from 'clsx';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useToaster } from '@gitroom/react/toaster/toaster';
import { useModals } from '@gitroom/frontend/components/layout/new-modal';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import {
  CommentStatus,
  MatchType,
  RuleFields,
  readError,
  useCommentSources,
} from '@gitroom/frontend/components/engagement/engagement.hooks';
import {
  ChipsInput,
  SmallButton,
  inputClass,
} from '@gitroom/frontend/components/engagement/engagement.ui';

export interface RuleFormValue extends RuleFields {
  name: string;
  description?: string;
  integrations?: string[];
  active?: boolean;
}

export const emptyRule: RuleFormValue = {
  name: '',
  matchType: 'any',
  keywords: [],
  excludeKeywords: [],
  replies: [''],
  hide: false,
  markAs: 'RESOLVED',
  integrations: [],
};

const Field: FC<{ label: string; hint?: string; children: React.ReactNode }> = ({
  label,
  hint,
  children,
}) => (
  <label className="flex flex-col gap-[6px]">
    <span className="text-[14px] font-[500]">{label}</span>
    {children}
    {hint && <span className="text-[12px] text-textItemBlur">{hint}</span>}
  </label>
);

/**
 * Shared form for automation rules (mode="automation") and reusable
 * templates (mode="template").
 */
export const RuleForm: FC<{
  mode: 'automation' | 'template';
  id?: string;
  initial?: RuleFormValue;
  onSaved: () => void;
}> = ({ mode, id, initial, onSaved }) => {
  const t = useT();
  const fetch = useFetch();
  const toaster = useToaster();
  const modals = useModals();
  const { data: sources } = useCommentSources();
  const [value, setValue] = useState<RuleFormValue>(initial || emptyRule);
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof RuleFormValue>(key: K, v: RuleFormValue[K]) =>
    setValue((prev) => ({ ...prev, [key]: v }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const base =
      mode === 'automation'
        ? '/engagement/automations'
        : '/engagement/automations/templates';
    const body = {
      name: value.name.trim(),
      matchType: value.matchType,
      keywords: value.keywords,
      excludeKeywords: value.excludeKeywords,
      replies: value.replies.map((r) => r.trim()).filter(Boolean),
      hide: value.hide,
      markAs: value.markAs,
      ...(mode === 'automation'
        ? { integrations: value.integrations || [], active: value.active }
        : { description: value.description?.trim() || undefined }),
    };
    const res = await fetch(id ? `${base}/${id}` : base, {
      method: id ? 'PUT' : 'POST',
      body: JSON.stringify(body),
    });
    setSaving(false);
    if (!res.ok) {
      toaster.show(await readError(res, 'Could not save'), 'warning');
      return;
    }
    toaster.show(t('saved', 'Saved'), 'success');
    onSaved();
    modals.closeCurrent();
  };

  const replyable = (sources || []).filter((s) => s.capabilities?.reply);

  return (
    <form onSubmit={submit} className="flex flex-col gap-[16px] w-full max-w-[640px]">
      <Field label={t('name', 'Name')}>
        <input
          required
          maxLength={100}
          value={value.name}
          onChange={(e) => set('name', e.target.value)}
          className={inputClass}
        />
      </Field>

      {mode === 'template' && (
        <Field label={t('description', 'Description')}>
          <input
            maxLength={300}
            value={value.description || ''}
            onChange={(e) => set('description', e.target.value)}
            className={inputClass}
          />
        </Field>
      )}

      {mode === 'automation' && (
        <Field
          label={t('channels', 'Channels')}
          hint={t('channels_hint', 'Leave all unchecked to apply to every channel with comments turned on.')}
        >
          <div className="flex flex-wrap gap-[8px]">
            {(sources || []).map((s) => {
              const checked = value.integrations?.includes(s.id);
              return (
                <button
                  type="button"
                  key={s.id}
                  onClick={() =>
                    set(
                      'integrations',
                      checked
                        ? (value.integrations || []).filter((i) => i !== s.id)
                        : [...(value.integrations || []), s.id]
                    )
                  }
                  className={clsx(
                    'h-[32px] px-[12px] rounded-[8px] border text-[13px]',
                    checked
                      ? 'border-btnPrimary bg-boxFocused text-textItemFocused'
                      : 'border-newTableBorder text-textItemBlur'
                  )}
                >
                  {s.name}
                </button>
              );
            })}
            {!sources?.length && (
              <span className="text-[13px] text-textItemBlur">
                {t('no_comment_sources', 'No supported channels yet')}
              </span>
            )}
          </div>
        </Field>
      )}

      <Field label={t('trigger', 'Trigger')}>
        <select
          value={value.matchType}
          onChange={(e) => set('matchType', e.target.value as MatchType)}
          className={inputClass}
        >
          <option value="any">{t('match_any', 'Comment contains any keyword')}</option>
          <option value="all">{t('match_all', 'Comment contains all keywords')}</option>
          <option value="every">{t('match_every', 'Every comment')}</option>
        </select>
      </Field>

      {value.matchType !== 'every' && (
        <Field
          label={t('keywords', 'Keywords')}
          hint={t('keywords_hint', 'Press Enter or comma to add. Whole words, not case sensitive.')}
        >
          <ChipsInput
            value={value.keywords}
            onChange={(v) => set('keywords', v)}
            placeholder="harga, price, order"
          />
        </Field>
      )}

      <Field
        label={t('exclude_keywords', 'Skip if comment contains')}
        hint={t('exclude_keywords_hint', 'Optional.')}
      >
        <ChipsInput
          value={value.excludeKeywords}
          onChange={(v) => set('excludeKeywords', v)}
        />
      </Field>

      <Field
        label={t('replies', 'Public replies')}
        hint={t(
          'replies_hint',
          'Optional. With several variations one is picked per comment so replies do not look identical. Use {name} for the commenter name.'
        )}
      >
        <div className="flex flex-col gap-[8px]">
          {value.replies.map((reply, index) => (
            <div key={index} className="flex gap-[8px] items-start">
              <textarea
                value={reply}
                maxLength={500}
                rows={2}
                onChange={(e) =>
                  set(
                    'replies',
                    value.replies.map((r, i) => (i === index ? e.target.value : r))
                  )
                }
                className="flex-1 bg-newBgColorInner border border-newTableBorder rounded-[8px] p-[10px] text-[14px] outline-none"
              />
              <SmallButton
                onClick={() =>
                  set(
                    'replies',
                    value.replies.length > 1
                      ? value.replies.filter((_, i) => i !== index)
                      : ['']
                  )
                }
              >
                ×
              </SmallButton>
            </div>
          ))}
          {value.replies.length < 10 && (
            <div>
              <SmallButton onClick={() => set('replies', [...value.replies, ''])}>
                {t('add_variation', '+ Add variation')}
              </SmallButton>
            </div>
          )}
          {mode === 'automation' && !replyable.length && !!sources?.length && (
            <span className="text-[12px] text-amber-500">
              {t('no_reply_support', 'None of your channels support replies.')}
            </span>
          )}
        </div>
      </Field>

      <label className="flex items-center gap-[8px] text-[14px]">
        <input
          type="checkbox"
          checked={value.hide}
          onChange={(e) => set('hide', e.target.checked)}
        />
        {t('hide_matching', 'Hide the comment (Threads: hidden reply, YouTube: held for review)')}
      </label>

      <Field label={t('then_mark_as', 'Then mark the comment as')}>
        <select
          value={value.markAs}
          onChange={(e) => set('markAs', e.target.value as CommentStatus)}
          className={inputClass}
        >
          <option value="RESOLVED">{t('resolved', 'Resolved')}</option>
          <option value="IGNORED">{t('ignored', 'Ignored')}</option>
          <option value="PENDING">{t('pending', 'Pending')}</option>
        </select>
      </Field>

      <div className="flex justify-end gap-[8px]">
        <SmallButton onClick={() => modals.closeCurrent()}>
          {t('cancel', 'Cancel')}
        </SmallButton>
        <SmallButton type="submit" variant="primary" disabled={saving}>
          {t('save', 'Save')}
        </SmallButton>
      </div>
    </form>
  );
};
