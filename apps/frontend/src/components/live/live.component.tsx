'use client';

import { CSSProperties, FC, FormEvent, useMemo, useState } from 'react';
import clsx from 'clsx';
import dayjs from 'dayjs';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useToaster } from '@gitroom/react/toaster/toaster';
import { readError } from '@gitroom/frontend/components/engagement/engagement.hooks';
import {
  Card,
  EmptyState,
  PageShell,
  Segmented,
  SmallButton,
  inputClass,
} from '@gitroom/frontend/components/engagement/engagement.ui';
import {
  LiveSession,
  LiveStatus,
  useLiveChannels,
  useLiveCheck,
  useLiveSessions,
  useLiveTargets,
  useLiveStatus,
  useLiveVideos,
} from '@gitroom/frontend/components/live/live.hooks';

interface CustomTarget {
  name: string;
  serverUrl: string;
  streamKey: string;
  save: boolean;
}

const CHECK_ICON = { ok: '✅', warn: '⚠️', error: '❌' } as const;

const Checklist: FC<{ integrationIds: string[]; skipIngest: boolean }> = ({
  integrationIds,
  skipIngest,
}) => {
  const { data, isLoading, mutate } = useLiveCheck(integrationIds);
  return (
    <div className="flex flex-col gap-[6px] bg-newBgColorInner border border-newTableBorder rounded-[8px] p-[12px]">
      <div className="flex items-center gap-[8px]">
        <div className="text-[13px] font-[600] flex-1">Cek kesiapan</div>
        <SmallButton onClick={() => mutate()} disabled={isLoading}>
          {isLoading ? 'Mengecek…' : 'Cek ulang'}
        </SmallButton>
      </div>
      {(data || []).filter((c) => !(skipIngest && c.key === 'ingest')).map((c) => (
        <div key={c.key} className="flex gap-[8px] text-[13px]">
          <span>{CHECK_ICON[c.status]}</span>
          <span className="font-[500] shrink-0">{c.label}</span>
          <span className="text-textItemBlur">{c.message}</span>
        </div>
      ))}
    </div>
  );
};

const STATUS: Record<LiveStatus, { label: string; className: string }> = {
  SCHEDULED: { label: 'Terjadwal', className: 'bg-amber-500/15 text-amber-500' },
  LIVE: { label: '● LIVE', className: 'bg-red-600 text-white' },
  RECONNECTING: { label: 'Menyambung ulang…', className: 'bg-amber-500 text-white' },
  ENDED: { label: 'Selesai', className: 'bg-btnSimple text-textItemBlur' },
  ERROR: { label: 'Gagal', className: 'bg-red-600/15 text-red-500' },
};

const KIND_LABEL = { youtube: 'YouTube', facebook: 'Facebook', custom: 'RTMP' };

const defaultTime = () => dayjs().add(10, 'minute').format('YYYY-MM-DDTHH:mm');

const Label: FC<{ children: string; hint?: string }> = ({ children, hint }) => (
  <div className="text-[13px] font-[600] mb-[6px]">
    {children}
    {hint && <span className="font-[400] text-textItemBlur"> · {hint}</span>}
  </div>
);

const CopyField: FC<{ label: string; value: string; secret?: boolean }> = ({
  label,
  value,
  secret,
}) => {
  const toaster = useToaster();
  const [show, setShow] = useState(!secret);
  return (
    <div className="flex flex-col gap-[4px] min-w-0">
      <div className="text-[12px] text-textItemBlur">{label}</div>
      <div className="flex gap-[6px] items-center">
        <code className="flex-1 min-w-0 truncate bg-newBgColorInner border border-newTableBorder rounded-[6px] px-[10px] py-[6px] text-[12px]">
          {show ? value : '•'.repeat(24)}
        </code>
        {secret && (
          <SmallButton onClick={() => setShow((s) => !s)}>{show ? 'Sembunyikan' : 'Lihat'}</SmallButton>
        )}
        <SmallButton
          onClick={async () => {
            await navigator.clipboard.writeText(value);
            toaster.show('Disalin', 'success');
          }}
        >
          Salin
        </SmallButton>
      </div>
    </div>
  );
};

const CreateLive: FC<{
  onCreated: () => void;
  quick: boolean;
  lastSession?: LiveSession;
}> = ({ onCreated, quick, lastSession }) => {
  const fetch = useFetch();
  const toaster = useToaster();
  const { data: status } = useLiveStatus();
  const { data: channels } = useLiveChannels();
  const [videoPage, setVideoPage] = useState(1);
  const { data: videos } = useLiveVideos(videoPage);
  const { data: savedTargets, mutate: reloadTargets } = useLiveTargets();

  const [source, setSource] = useState<'RTMP' | 'VIDEO'>('RTMP');
  const [title, setTitle] = useState(() =>
    quick ? `Live ${dayjs().format('DD MMM HH:mm')}` : ''
  );
  const [description, setDescription] = useState('');
  const [when, setWhen] = useState(defaultTime);
  const [privacy, setPrivacy] = useState<'public' | 'unlisted'>('public');
  const [mediaPath, setMediaPath] = useState('');
  const [loop, setLoop] = useState(true);
  const [duration, setDuration] = useState(60);
  // Same channels as the last live, so "Live sekarang" is one click.
  const [selected, setSelected] = useState<string[]>(() =>
    (lastSession?.destinations || [])
      .filter((d) => d.kind !== 'custom' && d.integrationId)
      .map((d) => d.integrationId!)
  );
  const [touched, setTouched] = useState(false);
  const available = (channels || []).map((c) => c.id);
  const chosen = touched ? selected : selected.filter((id) => available.includes(id));
  const [custom, setCustom] = useState<CustomTarget[]>([]);
  const [autoReply, setAutoReply] = useState(true);
  const [saving, setSaving] = useState(false);

  const tiktokInVideo =
    source === 'VIDEO' && custom.some((c) => /tiktok/i.test(`${c.name} ${c.serverUrl}`));
  const destinationCount = chosen.length + custom.length;

  const toggle = (id: string) => {
    setTouched(true);
    setSelected(chosen.includes(id) ? chosen.filter((x) => x !== id) : [...chosen, id]);
  };
  const addCustom = (name: string, serverUrl = '', save = !serverUrl) =>
    setCustom((all) => [...all, { name, serverUrl, streamKey: '', save }]);
  const removeSaved = async (id: string) => {
    await fetch(`/live/targets/${id}`, { method: 'DELETE' });
    reloadTargets();
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !destinationCount) {
      toaster.show('Isi judul dan pilih minimal 1 tujuan', 'warning');
      return;
    }
    setSaving(true);
    const res = await fetch('/live', {
      method: 'POST',
      body: JSON.stringify({
        title: title.trim(),
        description: description.trim() || undefined,
        source,
        scheduledAt: quick ? new Date().toISOString() : new Date(when).toISOString(),
        privacy,
        autoReply,
        ...(source === 'VIDEO'
          ? { mediaPath, loop, durationMinutes: Number(duration) || undefined }
          : {}),
        destinations: [
          ...chosen.map((id) => ({
            kind: channels?.find((c) => c.id === id)?.identifier,
            integrationId: id,
          })),
          ...custom.map((c) => ({ kind: 'custom', ...c })),
        ],
      }),
    });
    setSaving(false);
    if (!res.ok) {
      toaster.show(await readError(res, 'Gagal membuat live'), 'warning');
      return;
    }
    toaster.show(quick ? 'Live siap: mulai streaming dari OBS/HP' : 'Live dijadwalkan', 'success');
    reloadTargets();
    setTitle('');
    setDescription('');
    setCustom([]);
    setWhen(defaultTime());
    onCreated();
  };

  return (
    <Card>
      <form onSubmit={submit} className="flex flex-col gap-[16px]">
        <div className="text-[16px] font-[600]">{quick ? 'Live sekarang' : 'Jadwalkan live'}</div>

        <Segmented
          value={source}
          onChange={setSource}
          options={[
            { label: 'Live dari OBS / HP', value: 'RTMP' },
            { label: 'Video jadi live', value: 'VIDEO' },
          ]}
        />
        {source === 'RTMP' && status && !status.ingest && (
          <div className="text-[13px] text-amber-500">
            Server live belum aktif. Set LIVE_RELAY_SECRET di backend.env lalu jalankan MediaMTX
            (lihat docs/deploy/live-streaming.md).
          </div>
        )}
        {source === 'RTMP' && (
          <div className="text-[13px] text-textItemBlur">
            Setelah dijadwalkan, kamu dapat server URL dan stream key untuk OBS / Larix / Prism.
            Begitu kamu mulai streaming, Postiz meneruskannya ke semua tujuan sekaligus.
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-[16px]">
          <div>
            <Label>Judul</Label>
            <input
              className={inputClass}
              value={title}
              maxLength={100}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Live jualan malam ini"
            />
          </div>
          {!quick && (
          <div>
            <Label hint="WIB, waktu perangkatmu">Mulai</Label>
            <input
              type="datetime-local"
              className={inputClass}
              value={when}
              onChange={(e) => setWhen(e.target.value)}
            />
          </div>
          )}
        </div>

        <div>
          <Label hint="opsional">Deskripsi</Label>
          <textarea
            className={clsx(inputClass, 'h-[80px] py-[10px]')}
            value={description}
            maxLength={5000}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        {source === 'VIDEO' && (
          <div className="flex flex-col gap-[10px]">
            <Label hint="dari Media Library">Video</Label>
            {!videos?.videos.length ? (
              <div className="text-[13px] text-textItemBlur">
                Belum ada video di halaman ini. Upload video lewat menu Media.
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-[8px]">
                {videos.videos.map((v) => (
                  <button
                    type="button"
                    key={v.id}
                    onClick={() => setMediaPath(v.path)}
                    className={clsx(
                      'rounded-[8px] border overflow-hidden text-start',
                      mediaPath === v.path ? 'border-btnPrimary border-2' : 'border-newTableBorder'
                    )}
                  >
                    <video src={v.path} muted preload="metadata" className="w-full aspect-[9/12] object-cover bg-black" />
                    <div className="text-[11px] p-[6px] truncate">{v.name}</div>
                  </button>
                ))}
              </div>
            )}
            {!!videos && videos.pages > 1 && (
              <div className="flex gap-[6px] items-center text-[12px]">
                <SmallButton disabled={videoPage <= 1} onClick={() => setVideoPage((p) => p - 1)}>
                  ‹
                </SmallButton>
                {videoPage}/{videos.pages}
                <SmallButton disabled={videoPage >= videos.pages} onClick={() => setVideoPage((p) => p + 1)}>
                  ›
                </SmallButton>
              </div>
            )}
            <div className="flex flex-wrap gap-[16px] items-end">
              <label className="flex items-center gap-[8px] text-[14px] h-[42px]">
                <input type="checkbox" checked={loop} onChange={(e) => setLoop(e.target.checked)} />
                Ulang terus (loop)
              </label>
              <div className="w-[180px]">
                <Label hint={loop ? 'wajib' : 'opsional'}>Durasi (menit)</Label>
                <input
                  type="number"
                  min={1}
                  max={720}
                  className={inputClass}
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value))}
                />
              </div>
            </div>
            <div className="text-[12px] text-textItemBlur">
              Video diputar sebagai live di YouTube dan Facebook. Live otomatis berhenti setelah durasi
              habis (maks. 12 jam).
            </div>
          </div>
        )}

        <div>
          <Label>Tujuan</Label>
          <div className="flex flex-wrap gap-[8px]">
            {(channels || []).map((c) => (
              <button
                type="button"
                key={c.id}
                onClick={() => toggle(c.id)}
                className={clsx(
                  'flex items-center gap-[8px] h-[38px] px-[12px] rounded-[8px] border text-[13px]',
                  chosen.includes(c.id)
                    ? 'border-btnPrimary bg-btnPrimary/10'
                    : 'border-newTableBorder'
                )}
              >
                {c.picture && <img src={c.picture} alt="" className="w-[20px] h-[20px] rounded-full" />}
                {c.name}
                <span className="text-textItemBlur">
                  {c.identifier === 'youtube' ? 'YouTube' : 'Facebook'}
                </span>
              </button>
            ))}
            {!channels?.length && (
              <div className="text-[13px] text-textItemBlur">
                Belum ada channel YouTube / Facebook Page yang tersambung.
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-[8px]">
          {custom.map((c, i) => (
            <div key={i} className="grid grid-cols-1 md:grid-cols-[150px_1fr_1fr_auto] gap-[8px] items-center">
              <input
                className={inputClass}
                value={c.name}
                placeholder="Nama (mis. TikTok)"
                onChange={(e) =>
                  setCustom((all) => all.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))
                }
              />
              <input
                type="url"
                name={`rtmp-server-${i}`}
                autoComplete="off"
                data-lpignore="true"
                data-1p-ignore="true"
                className={inputClass}
                value={c.serverUrl}
                placeholder="Server URL (rtmp://…)"
                onChange={(e) =>
                  setCustom((all) => all.map((x, j) => (j === i ? { ...x, serverUrl: e.target.value } : x)))
                }
              />
              {/* Text field masked with CSS (not type=password) so browsers never autofill a saved login here. */}
              <input
                type="text"
                name={`rtmp-key-${i}`}
                autoComplete="off"
                spellCheck={false}
                data-lpignore="true"
                data-1p-ignore="true"
                style={{ WebkitTextSecurity: 'disc' } as CSSProperties}
                className={inputClass}
                value={c.streamKey}
                placeholder="Stream key"
                onChange={(e) =>
                  setCustom((all) => all.map((x, j) => (j === i ? { ...x, streamKey: e.target.value } : x)))
                }
              />
              <div className="flex items-center gap-[8px]">
                <label className="flex items-center gap-[4px] text-[12px] whitespace-nowrap" title="Simpan nama + server URL (stream key tidak disimpan)">
                  <input
                    type="checkbox"
                    checked={c.save}
                    onChange={(e) =>
                      setCustom((all) => all.map((x, j) => (j === i ? { ...x, save: e.target.checked } : x)))
                    }
                  />
                  Simpan
                </label>
                <SmallButton onClick={() => setCustom((all) => all.filter((_, j) => j !== i))}>Hapus</SmallButton>
              </div>
            </div>
          ))}
          <div className="flex flex-wrap gap-[8px] items-center">
            {(savedTargets || []).map((t) => (
              <span key={t.id} className="flex items-center rounded-[8px] border border-newTableBorder overflow-hidden">
                <button
                  type="button"
                  className="h-[32px] px-[10px] text-[13px] hover:bg-btnSimple"
                  title={t.serverUrl}
                  onClick={() => addCustom(t.name, t.serverUrl, false)}
                >
                  + {t.name}
                </button>
                <button
                  type="button"
                  className="h-[32px] px-[8px] text-[13px] text-textItemBlur hover:text-red-500 border-s border-newTableBorder"
                  aria-label={`Hapus ${t.name}`}
                  onClick={() => removeSaved(t.id)}
                >
                  ×
                </button>
              </span>
            ))}
            {!(savedTargets || []).some((t) => /tiktok/i.test(t.name)) && (
              <SmallButton onClick={() => addCustom('TikTok')}>+ TikTok</SmallButton>
            )}
            {!(savedTargets || []).some((t) => /shopee/i.test(t.name)) && (
              <SmallButton onClick={() => addCustom('Shopee Live')}>+ Shopee Live</SmallButton>
            )}
            <SmallButton onClick={() => addCustom('')}>+ RTMP lain</SmallButton>
          </div>
          <div className="text-[12px] text-textItemBlur">
            TikTok tidak punya API live: ambil server URL dan stream key dari TikTok LIVE Studio / LIVE
            Center (hanya untuk akun yang memenuhi syarat LIVE). Stream key disimpan terenkripsi.
          </div>
          {custom.some((c) => c.serverUrl && !/^rtmps?:\/\//i.test(c.serverUrl.trim())) && (
            <div className="text-[13px] text-red-500">
              Server URL harus diawali rtmp:// atau rtmps:// (bukan email/password). Salin dari TikTok LIVE Studio /
              LIVE Center.
            </div>
          )}
          {tiktokInVideo && (
            <div className="text-[13px] text-red-500">
              TikTok melarang video rekaman di LIVE. Hapus TikTok atau pakai mode “Live dari OBS / HP”.
            </div>
          )}
        </div>

        {chosen.some((id) => channels?.find((c) => c.id === id)?.identifier === 'youtube') && (
          <div className="w-[220px]">
            <Label>Privasi YouTube</Label>
            <select
              className={inputClass}
              value={privacy}
              onChange={(e) => setPrivacy(e.target.value as 'public' | 'unlisted')}
            >
              <option value="public">Publik</option>
              <option value="unlisted">Tidak publik (unlisted)</option>
            </select>
          </div>
        )}

        <Checklist integrationIds={chosen} skipIngest={source === 'VIDEO'} />

        <div className="flex flex-col gap-[4px]">
          <label className="flex items-center gap-[8px] text-[14px]">
            <input type="checkbox" checked={autoReply} onChange={(e) => setAutoReply(e.target.checked)} />
            Auto-reply komentar live (YouTube & Facebook)
          </label>
          <div className="text-[12px] text-textItemBlur ps-[22px]">
            Memakai aturan di menu Automation (kata kunci → balasan, mis. “harga” → “cek link di deskripsi ya
            {' {name}'}”). Aturan “semua komentar” tidak dipakai di live. Maks. 1 balasan per penonton tiap 5
            menit, jeda 20 detik, 60 balasan per live. TikTok tidak punya API komentar live.
          </div>
        </div>

        <div>
          <SmallButton
            type="submit"
            variant="primary"
            disabled={saving || tiktokInVideo || (source === 'VIDEO' && !mediaPath)}
          >
            {saving ? 'Menyiapkan…' : quick ? '● Mulai live sekarang' : 'Jadwalkan live'}
          </SmallButton>
        </div>
      </form>
    </Card>
  );
};

const SessionCard: FC<{ session: LiveSession; onChange: () => void }> = ({ session, onChange }) => {
  const fetch = useFetch();
  const toaster = useToaster();
  const active = ['SCHEDULED', 'LIVE', 'RECONNECTING'].includes(session.status);
  const status = STATUS[session.status];

  const act = async (path: string, method: 'POST' | 'DELETE', done: string) => {
    const res = await fetch(path, { method });
    if (!res.ok) {
      toaster.show(await readError(res, 'Gagal'), 'warning');
      return;
    }
    toaster.show(done, 'success');
    onChange();
  };

  return (
    <Card className="flex flex-col gap-[12px]">
      <div className="flex flex-wrap items-start gap-[10px]">
        <div className="flex-1 min-w-[200px]">
          <div className="text-[15px] font-[600]">{session.title}</div>
          <div className="text-[12px] text-textItemBlur">
            {session.source === 'RTMP' ? 'Live dari OBS / HP' : `Video${session.loop ? ' · loop' : ''}`}
            {session.autoReply && ' · auto-reply'}
            {' · '}
            {dayjs(session.scheduledAt).format('DD MMM YYYY HH:mm')}
            {session.endsAt && ` → ${dayjs(session.endsAt).format('HH:mm')}`}
          </div>
        </div>
        <span className={clsx('text-[12px] font-[600] px-[10px] py-[4px] rounded-full', status.className)}>
          {status.label}
        </span>
        {active ? (
          <SmallButton variant="danger" onClick={() => act(`/live/${session.id}/stop`, 'POST', 'Live dihentikan')}>
            Hentikan
          </SmallButton>
        ) : (
          <SmallButton onClick={() => act(`/live/${session.id}`, 'DELETE', 'Dihapus')}>Hapus</SmallButton>
        )}
      </div>

      {session.source === 'RTMP' && active && session.streamKey && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-[10px]">
          <CopyField label="Server (OBS: Settings → Stream → Custom)" value={session.ingestUrl || ''} />
          <CopyField label="Stream key" value={session.streamKey} secret />
        </div>
      )}

      {session.error && <div className="text-[13px] text-red-500">{session.error}</div>}

      <div className="flex flex-col gap-[6px]">
        {session.destinations.map((d) => (
          <div key={d.id} className="flex flex-wrap items-center gap-[8px] text-[13px]">
            <span className="text-textItemBlur w-[70px]">{KIND_LABEL[d.kind]}</span>
            <span className="font-[500]">{d.name}</span>
            <span className="text-textItemBlur">· {d.status.toLowerCase()}</span>
            {d.watchUrl && (
              <a href={d.watchUrl} target="_blank" rel="noopener noreferrer" className="text-btnPrimary underline">
                buka
              </a>
            )}
            {d.error && <span className="text-red-500 basis-full ps-[78px]">{d.error}</span>}
          </div>
        ))}
      </div>
    </Card>
  );
};

export const LivePage: FC = () => {
  const { data: sessions, mutate } = useLiveSessions();
  const [form, setForm] = useState<'quick' | 'schedule' | null>(null);
  const lastSession = useMemo(
    () =>
      [...(sessions || [])].sort(
        (a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime()
      )[0],
    [sessions]
  );
  const sorted = useMemo(
    () =>
      [...(sessions || [])].sort((a, b) => {
        const rank = (s: LiveSession) => (['LIVE', 'RECONNECTING'].includes(s.status) ? 0 : s.status === 'SCHEDULED' ? 1 : 2);
        return rank(a) - rank(b);
      }),
    [sessions]
  );

  return (
    <PageShell
      title="Live"
      description="Live sekali, tayang di YouTube, Facebook, TikTok dan RTMP lain sekaligus — dari OBS/HP atau dari video."
      actions={
        <div className="flex gap-[8px]">
          {form ? (
            <SmallButton onClick={() => setForm(null)}>Tutup</SmallButton>
          ) : (
            <>
              <SmallButton variant="danger" onClick={() => setForm('quick')}>
                ● Live sekarang
              </SmallButton>
              <SmallButton variant="primary" onClick={() => setForm('schedule')}>
                + Jadwalkan live
              </SmallButton>
            </>
          )}
        </div>
      }
    >
      {form && (
        <CreateLive
          key={form}
          quick={form === 'quick'}
          lastSession={lastSession}
          onCreated={() => {
            setForm(null);
            mutate();
          }}
        />
      )}
      {sessions && !sessions.length && !form && (
        <EmptyState title="Belum ada live">
          Klik “Jadwalkan live” untuk mulai multistream ke YouTube, Facebook dan TikTok.
        </EmptyState>
      )}
      <div className="flex flex-col gap-[12px]">
        {sorted.map((s) => (
          <SessionCard key={s.id} session={s} onChange={() => mutate()} />
        ))}
      </div>
    </PageShell>
  );
};
