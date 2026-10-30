import {
  Storyboard,
  StoryboardScene,
  storyboardDuration,
} from '@gitroom/nestjs-libraries/affiliate/storyboard';

/**
 * Turns a storyboard into a HyperFrames composition (720x1280, 9:16).
 * `images` maps a gallery index to a file name inside the render folder.
 * All text is HTML-escaped; nothing from the storyboard reaches script code.
 */

export const VIDEO_WIDTH = 720;
export const VIDEO_HEIGHT = 1280;

const escapeHtml = (text: string) =>
  text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const THEMES = {
  dark: {
    bg: 'radial-gradient(120% 80% at 50% 30%, #3b1d6e 0%, #140b26 70%)',
    ink: '#ffffff',
    soft: 'rgba(255,255,255,0.78)',
    accent: '#ffb020',
    accentInk: '#1a0f2e',
    card: 'rgba(255,255,255,0.10)',
    hot: '#ff3d6e',
  },
  light: {
    bg: 'linear-gradient(180deg, #ffffff 0%, #fff4e8 100%)',
    ink: '#1b1530',
    soft: 'rgba(27,21,48,0.72)',
    accent: '#ff6a00',
    accentInk: '#ffffff',
    card: 'rgba(27,21,48,0.06)',
    hot: '#ff2e63',
  },
} as const;

const fmt = (n: number) => Number(n.toFixed(3));

const sceneHtml = (
  scene: StoryboardScene,
  index: number,
  start: number,
  image?: string
) => {
  const id = `s${index}`;
  const headlineClass =
    scene.kind === 'price' ? 'headline price' : scene.kind === 'hook' ? 'headline hook' : 'headline';
  const headline =
    scene.kind === 'cta'
      ? `<div class="btn">${escapeHtml(scene.headline)}</div>`
      : `<h1 class="${headlineClass}">${escapeHtml(scene.headline)}</h1>`;
  return `
      <div id="${id}" class="clip scene ${scene.kind}" data-start="${fmt(start)}" data-duration="${fmt(scene.duration)}" data-track-index="1">
        ${image ? `<div class="photo"><img src="${image}" alt="" /></div>` : '<div class="photo empty"></div>'}
        <div class="text">
          ${headline}
          ${scene.subtext ? `<p class="sub">${escapeHtml(scene.subtext)}</p>` : ''}
        </div>
      </div>`;
};

const sceneTweens = (scene: StoryboardScene, index: number, start: number) => {
  const sel = `#s${index}`;
  const t = (offset: number) => fmt(start + offset);
  const lines = [
    `tl.fromTo('${sel} .photo', { scale: 1.12, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.45, ease: 'power3.out' }, ${t(0)});`,
    `tl.to('${sel} .photo img', { scale: 1.08, duration: ${fmt(scene.duration)}, ease: 'none' }, ${t(0)});`,
  ];
  if (scene.kind === 'cta') {
    lines.push(
      `tl.fromTo('${sel} .btn', { y: 60, opacity: 0 }, { y: 0, opacity: 1, duration: 0.4, ease: 'back.out(1.8)' }, ${t(0.15)});`,
      `tl.to('${sel} .btn', { scale: 1.07, duration: 0.3, yoyo: true, repeat: 3, ease: 'sine.inOut' }, ${t(0.7)});`
    );
  } else if (scene.kind === 'price') {
    lines.push(
      `tl.fromTo('${sel} .headline', { scale: 0.3, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.5, ease: 'back.out(2.2)' }, ${t(0.15)});`
    );
  } else if (scene.kind === 'hook') {
    lines.push(
      `tl.fromTo('${sel} .headline', { y: 50, opacity: 0, scale: 0.9 }, { y: 0, opacity: 1, scale: 1, duration: 0.35, ease: 'power4.out' }, ${t(0.05)});`,
      `tl.to('${sel} .headline', { scale: 1.06, duration: 0.2, yoyo: true, repeat: 1, ease: 'power1.inOut' }, ${t(1.2)});`
    );
  } else {
    lines.push(
      `tl.fromTo('${sel} .headline', { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: 0.4, ease: 'power3.out' }, ${t(0.15)});`
    );
  }
  if (scene.subtext) {
    lines.push(
      `tl.fromTo('${sel} .sub', { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.35, ease: 'power2.out' }, ${t(0.45)});`
    );
  }
  return lines.join('\n      ');
};

/**
 * Natural creator look (POV, story, review, tips, problem): the photo fills
 * the frame over a blurred copy of itself, captions sit in the lower third in
 * TikTok-style outlined text, no ad card or button.
 */
const naturalSceneHtml = (
  scene: StoryboardScene,
  index: number,
  start: number,
  image?: string
) => `
      <div id="s${index}" class="clip nscene ${scene.kind}" data-start="${fmt(start)}" data-duration="${fmt(scene.duration)}" data-track-index="1">
        ${
          image
            ? `<img class="nbg" src="${image}" alt="" /><img class="nfg" src="${image}" alt="" />`
            : '<div class="nbg empty"></div>'
        }
        <div class="nshade"></div>
        <div class="ncap">
          <div class="nline">${escapeHtml(scene.headline)}</div>
          ${scene.subtext ? `<div class="nsub">${escapeHtml(scene.subtext)}</div>` : ''}
        </div>
      </div>`;

const naturalTweens = (scene: StoryboardScene, index: number, start: number) => {
  const sel = `#s${index}`;
  const t = (offset: number) => fmt(start + offset);
  // alternate slow push-in / pull-out so consecutive photos feel filmed
  const zoomIn = index % 2 === 0;
  const lines = [
    `tl.fromTo('${sel} .nfg', { scale: ${zoomIn ? 1 : 1.12} }, { scale: ${zoomIn ? 1.12 : 1}, duration: ${fmt(scene.duration)}, ease: 'none' }, ${t(0)});`,
    `tl.fromTo('${sel}', { opacity: 0 }, { opacity: 1, duration: 0.18, ease: 'none' }, ${t(0)});`,
    `tl.fromTo('${sel} .nline', { y: 24, opacity: 0, scale: 0.96 }, { y: 0, opacity: 1, scale: 1, duration: 0.3, ease: 'power3.out' }, ${t(0.1)});`,
  ];
  if (scene.subtext) {
    lines.push(
      `tl.fromTo('${sel} .nsub', { opacity: 0 }, { opacity: 1, duration: 0.3 }, ${t(0.5)});`
    );
  }
  return lines.join('\n      ');
};

export const buildComposition = (
  storyboard: Storyboard,
  images: Record<number, string>,
  options: { brand?: string } = {}
) => {
  const theme = THEMES[storyboard.theme] || THEMES.dark;
  const total = storyboardDuration(storyboard);
  let cursor = 0;
  const scenes: string[] = [];
  const tweens: string[] = [];
  const natural = (storyboard.style || 'promo') !== 'promo';
  storyboard.scenes.forEach((scene, i) => {
    const image =
      scene.imageIndex !== undefined && scene.imageIndex >= 0
        ? images[scene.imageIndex]
        : undefined;
    scenes.push(
      natural
        ? naturalSceneHtml(scene, i, cursor, image)
        : sceneHtml(scene, i, cursor, image)
    );
    tweens.push(
      natural ? naturalTweens(scene, i, cursor) : sceneTweens(scene, i, cursor)
    );
    cursor += scene.duration;
  });
  const brand = options.brand ? escapeHtml(options.brand) : '';

  return `<!doctype html>
<html lang="id">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=${VIDEO_WIDTH}, height=${VIDEO_HEIGHT}" />
    <script src="gsap.min.js"></script>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body { width: ${VIDEO_WIDTH}px; height: ${VIDEO_HEIGHT}px; overflow: hidden; background: ${theme.bg}; }
      #root { position: relative; width: 100%; height: 100%; background: ${theme.bg}; color: ${theme.ink};
        font-family: 'DejaVu Sans', 'Noto Color Emoji', sans-serif; }
      .clip { position: absolute; inset: 0; }
      .scene { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 70px 0 40px; }
      .photo { width: 600px; height: 600px; flex-shrink: 0; border-radius: 36px; overflow: hidden;
        background: #fff; box-shadow: 0 24px 60px rgba(0,0,0,0.35); }
      .photo.empty { background: ${theme.card}; box-shadow: none; }
      .photo img { width: 100%; height: 100%; object-fit: cover; }
      .text { width: 100%; padding: 44px 48px 0; display: flex; flex-direction: column; align-items: center; gap: 18px; text-align: center; }
      .headline { font-size: 58px; line-height: 1.12; font-weight: 800; letter-spacing: -0.01em; }
      .headline.hook { font-size: 70px; }
      .headline.price { font-size: 104px; color: ${theme.accent}; font-weight: 900; }
      .sub { font-size: 32px; line-height: 1.3; font-weight: 600; color: ${theme.soft}; }
      .btn { font-size: 50px; font-weight: 900; background: ${theme.accent}; color: ${theme.accentInk};
        padding: 24px 44px; border-radius: 24px; }
      #brand { top: 40px; height: 40px; display: flex; justify-content: center; font-size: 26px; font-weight: 700; color: ${theme.soft}; }
      #bar { top: 0; height: 8px; background: ${theme.accent}; transform-origin: 0 50%; }
      .nscene { overflow: hidden; background: #000; }
      .nbg { position: absolute; inset: -40px; width: calc(100% + 80px); height: calc(100% + 80px);
        object-fit: cover; filter: blur(28px) brightness(0.65); }
      .nbg.empty { background: ${theme.bg}; filter: none; }
      .nfg { position: absolute; left: 0; top: 0; width: 100%; height: 100%; object-fit: contain; }
      .nshade { position: absolute; left: 0; right: 0; bottom: 0; height: 52%;
        background: linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.55) 100%); }
      .ncap { position: absolute; left: 48px; right: 48px; bottom: 170px; display: flex; flex-direction: column;
        align-items: center; gap: 14px; text-align: center; }
      .nline { font-size: 50px; line-height: 1.18; font-weight: 800; color: #fff;
        -webkit-text-stroke: 7px #000; paint-order: stroke fill; text-shadow: 0 4px 14px rgba(0,0,0,0.45); }
      .nsub { font-size: 32px; line-height: 1.25; font-weight: 700; color: #000; background: #fff;
        padding: 8px 18px; border-radius: 12px; }
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="${fmt(total)}" data-width="${VIDEO_WIDTH}" data-height="${VIDEO_HEIGHT}">
      ${natural ? '' : `<div id="bar" class="clip" data-start="0" data-duration="${fmt(total)}" data-track-index="0"></div>`}
      ${brand && !natural ? `<div id="brand" class="clip" data-start="0" data-duration="${fmt(total)}" data-track-index="2">${brand}</div>` : ''}
      ${scenes.join('\n')}
    </div>
    <script>
      window.__timelines = window.__timelines || {};
      const tl = gsap.timeline({ paused: true });
      ${natural ? '' : `tl.fromTo('#bar', { scaleX: 0 }, { scaleX: 1, duration: ${fmt(total)}, ease: 'none' }, 0);`}
      ${tweens.join('\n      ')}
      window.__timelines['main'] = tl;
      tl.seek(0);
    </script>
  </body>
</html>
`;
};
