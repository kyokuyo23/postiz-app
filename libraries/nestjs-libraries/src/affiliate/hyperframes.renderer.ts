import { spawn } from 'child_process';
import { existsSync, readdirSync } from 'fs';
import { copyFile, mkdir, readFile, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { extname, join, resolve, sep } from 'path';
import { randomUUID } from 'crypto';
import { isSafePublicHttpsUrl } from '@gitroom/nestjs-libraries/dtos/webhooks/webhook.url.validator';
import { ssrfSafeDispatcher } from '@gitroom/nestjs-libraries/dtos/webhooks/ssrf.safe.dispatcher';

/**
 * Renders a HyperFrames composition to MP4 with the CLI installed in the
 * image (HYPERFRAMES_HOME, default /opt/hyperframes) and a system Chromium
 * (HYPERFRAMES_BROWSER_PATH). One render at a time is enforced by the caller.
 */

const HOME = () => process.env.HYPERFRAMES_HOME || '/opt/hyperframes';
const BIN = () => join(HOME(), 'node_modules', '.bin', 'hyperframes');
const RENDER_TIMEOUT_MS = 12 * 60 * 1000;
const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif']);

export const rendererAvailable = () =>
  existsSync(BIN()) && !!findGsap() && !!process.env.HYPERFRAMES_BROWSER_PATH;

/** GSAP ships inside the HyperFrames package (vendor folder). */
export const findGsap = (): string | null => {
  const vendor = join(HOME(), 'node_modules', 'hyperframes', 'dist', 'vendor', 'npm');
  if (!existsSync(vendor)) return null;
  const dir = readdirSync(vendor).find((d) => d.startsWith('gsap@'));
  if (!dir) return null;
  const file = join(vendor, dir, 'dist', 'gsap.min.js');
  return existsSync(file) ? file : null;
};

/**
 * Maps a media URL from this Postiz instance to its file on disk when local
 * storage is used, so renders never go through the network. Returns null for
 * anything outside the upload directory.
 */
export const localUploadPath = (url: string, uploadDir?: string) => {
  const dir = uploadDir || process.env.UPLOAD_DIRECTORY;
  if (!dir) return null;
  const marker = url.indexOf('/uploads/');
  if (marker === -1) return null;
  const rest = decodeURIComponent(url.slice(marker + '/uploads/'.length).split('?')[0]);
  const base = resolve(dir);
  const full = resolve(base, rest);
  return full.startsWith(base + sep) ? full : null;
};

const fetchImage = async (url: string): Promise<Buffer | null> => {
  if (!(await isSafePublicHttpsUrl(url))) return null;
  const res = await fetch(url, {
    // @ts-ignore — undici option, not in lib.dom fetch types
    dispatcher: ssrfSafeDispatcher,
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) return null;
  const buf = Buffer.from(await res.arrayBuffer());
  return buf.length > 25 * 1024 * 1024 ? null : buf;
};

const run = (args: string[], cwd: string) =>
  new Promise<void>((done, fail) => {
    const child = spawn(BIN(), args, {
      cwd,
      env: {
        ...process.env,
        HYPERFRAMES_SKIP_SKILLS: '1',
        HYPERFRAMES_NO_TELEMETRY: '1',
        HF_CLI_TELEMETRY_DISABLED: '1',
        DO_NOT_TRACK: '1',
        HYPERFRAMES_NO_UPDATE_CHECK: '1',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let tail = '';
    const keep = (chunk: Buffer) => {
      tail = (tail + chunk.toString()).slice(-4000);
    };
    child.stdout.on('data', keep);
    child.stderr.on('data', keep);
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      fail(new Error('Render timed out'));
    }, RENDER_TIMEOUT_MS);
    child.on('error', (e) => {
      clearTimeout(timer);
      fail(e);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) done();
      else {
        const line = tail
          .split('\n')
          .reverse()
          .find((l) => /error|✗|failed/i.test(l));
        fail(new Error(`Render failed (exit ${code})${line ? `: ${line.trim().slice(0, 300)}` : ''}`));
      }
    });
  });

export const renderComposition = async (
  html: string,
  imageUrls: Record<number, string>,
  buildHtml: (files: Record<number, string>) => string = () => html
): Promise<Buffer> => {
  const gsap = findGsap();
  if (!gsap) throw new Error('HyperFrames is not installed on this server');
  const dir = join(tmpdir(), `postiz-render-${randomUUID()}`);
  await mkdir(dir, { recursive: true });
  try {
    await copyFile(gsap, join(dir, 'gsap.min.js'));
    const files: Record<number, string> = {};
    for (const [key, url] of Object.entries(imageUrls)) {
      const index = Number(key);
      let ext = extname(url.split('?')[0]).toLowerCase();
      if (!IMAGE_EXT.has(ext)) ext = '.jpg';
      const name = `img${index}${ext}`;
      const local = localUploadPath(url);
      try {
        if (local && existsSync(local)) {
          await copyFile(local, join(dir, name));
          files[index] = name;
        } else {
          const buf = await fetchImage(url);
          if (buf) {
            await writeFile(join(dir, name), buf);
            files[index] = name;
          }
        }
      } catch {
        // a missing image only leaves that scene without a photo
      }
    }
    await writeFile(join(dir, 'index.html'), buildHtml(files));
    await writeFile(
      join(dir, 'hyperframes.json'),
      JSON.stringify({ name: 'postiz-affiliate' })
    );
    await run(
      ['render', dir, '--quality', 'looks', '--workers', '1', '--fps', '24', '--quiet', '-o', join(dir, 'out.mp4')],
      dir
    );
    return await readFile(join(dir, 'out.mp4'));
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
};
