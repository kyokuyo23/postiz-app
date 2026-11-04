import { spawn, ChildProcess } from 'child_process';
import { isSafePublicHttpsUrl } from '@gitroom/nestjs-libraries/dtos/webhooks/webhook.url.validator';

export const FFMPEG = () => process.env.LIVE_FFMPEG_PATH || 'ffmpeg';
export const FFPROBE = () => process.env.LIVE_FFPROBE_PATH || 'ffprobe';

/** Escapes a URL for the ffmpeg tee muxer slave list. */
export const teeEscape = (url: string) => url.replace(/[\\|[\]]/g, (c) => `\\${c}`);

/** `[f=flv:onfail=ignore]a|[f=flv:onfail=ignore]b`: one failing target never stops the others. */
export const teeTargets = (urls: string[]) =>
  urls.map((u) => `[f=flv:onfail=ignore]${teeEscape(u)}`).join('|');

export interface FileLiveOptions {
  file: string;
  outputs: string[];
  loop: boolean;
  /** Stop after this many seconds (required when looping). */
  durationSec?: number;
  hasAudio: boolean;
}

/**
 * Plays a video file in real time as a live stream. Video is re-encoded so
 * every platform gets what it expects (H.264, 2 s keyframes, ≤1280 px, AAC
 * audio), whatever the source file is. A silent track is added when the file
 * has no audio, because Facebook rejects streams without one.
 */
export const fileLiveArgs = (o: FileLiveOptions): string[] => {
  const args = ['-hide_banner', '-loglevel', 'error', '-nostdin', '-re'];
  if (o.loop) args.push('-stream_loop', '-1');
  args.push('-i', o.file);
  if (!o.hasAudio) {
    args.push('-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100');
  }
  args.push('-map', '0:v:0', '-map', o.hasAudio ? '0:a:0' : '1:a:0');
  args.push(
    '-vf',
    "scale='min(iw,1280)':'min(ih,1280)':force_original_aspect_ratio=decrease,scale=trunc(iw/2)*2:trunc(ih/2)*2,fps=30",
    '-c:v', 'libx264',
    '-preset', 'veryfast',
    '-pix_fmt', 'yuv420p',
    '-b:v', '2500k',
    '-maxrate', '2500k',
    '-bufsize', '5000k',
    '-g', '60',
    '-keyint_min', '60',
    '-sc_threshold', '0',
    '-c:a', 'aac',
    '-b:a', '128k',
    '-ar', '44100',
    '-ac', '2'
  );
  if (o.durationSec) args.push('-t', String(Math.round(o.durationSec)));
  else if (!o.hasAudio) args.push('-shortest');
  args.push('-f', 'tee', teeTargets(o.outputs));
  return args;
};

/**
 * Relays a stream from the ingest server without re-encoding (cheap on a
 * small VPS). OBS should send H.264 + AAC with a 2 s keyframe interval.
 */
export const relayArgs = (input: string, outputs: string[]): string[] => [
  '-hide_banner',
  '-loglevel', 'error',
  '-nostdin',
  '-rw_timeout', '15000000',
  '-i', input,
  '-map', '0:v:0',
  '-map', '0:a:0?',
  '-c', 'copy',
  '-f', 'tee',
  teeTargets(outputs),
];

export const startFfmpeg = (args: string[], onExit: (code: number | null, log: string) => void): ChildProcess => {
  const child = spawn(FFMPEG(), args, { stdio: ['ignore', 'ignore', 'pipe'] });
  let log = '';
  child.stderr?.on('data', (d) => {
    log = (log + d.toString()).slice(-2000);
  });
  child.on('error', (e) => {
    log += `\n${e.message}`;
  });
  child.on('close', (code) => onExit(code, log.trim()));
  return child;
};

/** True when the file has an audio stream. */
export const probeHasAudio = (file: string) =>
  new Promise<boolean>((done) => {
    const child = spawn(FFPROBE(), [
      '-v', 'error',
      '-select_streams', 'a',
      '-show_entries', 'stream=index',
      '-of', 'csv=p=0',
      file,
    ]);
    let out = '';
    child.stdout.on('data', (d) => (out += d.toString()));
    child.on('error', () => done(false));
    child.on('close', () => done(out.trim().length > 0));
  });

/**
 * Custom RTMP targets (TikTok LIVE, Instagram Live Producer, Shopee Live…):
 * rtmp:// or rtmps:// to a public host only, so the server can't be used to
 * push data into its own network.
 */
export const isSafeRtmpUrl = async (value: string) => {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol !== 'rtmp:' && url.protocol !== 'rtmps:') return false;
  if (!url.hostname || !url.hostname.includes('.')) return false;
  return isSafePublicHttpsUrl(`https://${url.hostname}/`);
};
