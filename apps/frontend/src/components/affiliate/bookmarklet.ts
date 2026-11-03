/**
 * "Kirim ke Postiz" bookmarklet. Runs only when the user clicks it on a
 * product page they have open, reads what that page already shows (JSON-LD,
 * meta tags, visible images/videos and text) and opens Postiz with the data in
 * the URL fragment. It makes no requests to the marketplace and sends nothing
 * anywhere except to this Postiz (fragments never reach any server log).
 */
// Plain JavaScript kept as a string so the bundler never rewrites it.
export const BOOKMARKLET_SOURCE = `(function(appUrl){try{
var q=function(s){return document.querySelector(s)};
var meta=function(n){var el=q('meta[property="'+n+'"]')||q('meta[name="'+n+'"]');return (el&&el.content)||''};
var ld=null;
document.querySelectorAll('script[type="application/ld+json"]').forEach(function(s){try{var j=JSON.parse(s.textContent||'');[].concat(j['@graph']||j).forEach(function(x){if(x&&/Product/i.test(String(x['@type'])))ld=x})}catch(e){}});
var text=(document.body&&document.body.innerText)||'';
var images=[];var add=function(u){if(u&&typeof u==='string'&&/^https:/.test(u)&&images.indexOf(u)===-1)images.push(u)};
if(ld)[].concat(ld.image||[]).forEach(function(i){add(typeof i==='string'?i:i&&i.url)});
add(meta('og:image'));
document.querySelectorAll('img').forEach(function(img){var s=img.currentSrc||img.src||'';if(/susercontent\\.com\\/file\\/|images\\.tokopedia\\.net|slatic\\.net|tiktokcdn/.test(s)&&(img.naturalWidth||0)>=200)add(s)});
var videos=[];document.querySelectorAll('video, video source').forEach(function(v){var s=v.currentSrc||v.src||'';if(/^https:/.test(s)&&videos.indexOf(s)===-1)videos.push(s)});
var offer=ld&&[].concat(ld.offers||[])[0];var price='';
var fmt=function(n){return 'Rp '+Math.round(Number(n)).toLocaleString('id-ID')};
if(offer){var lo=offer.lowPrice||offer.price,hi=offer.highPrice;if(lo)price=hi&&Number(hi)>Number(lo)?fmt(lo)+' - '+fmt(hi):fmt(lo)}
if(!price){var m=text.match(/Rp\\s?\\d{1,3}(?:[.,]\\d{3})+/);if(m)price=m[0]}
var soldM=text.match(/([\\d.,]+\\s?(?:rb|RB|jt|JT|K|k)?\\+?)\\s*(?:Terjual|terjual)/);
var description=(ld&&ld.description)||'';
var di=text.search(/\\n\\s*Deskripsi Produk\\s*\\n/i);
if(di!==-1){var rest=text.slice(di).replace(/^\\s*Deskripsi Produk\\s*/i,'');var end=rest.search(/\\n\\s*(Penilaian Produk|Ulasan|Produk Lainnya|Rekomendasi)/i);var fp=(end===-1?rest.slice(0,6000):rest.slice(0,end)).trim();if(fp.length>description.length)description=fp}
if(!description)description=meta('og:description');
var data={v:1,url:location.href,name:String((ld&&ld.name)||meta('og:title')||document.title).replace(/\\s*\\|\\s*Shopee Indonesia\\s*$/i,'').slice(0,200),price:price,description:String(description).slice(0,8000),images:images.slice(0,15),videos:videos.slice(0,2),rating:(ld&&ld.aggregateRating&&String(ld.aggregateRating.ratingValue||''))||'',sold:soldM?soldM[1].replace(/\\s+/g,''):''};
var b64=btoa(unescape(encodeURIComponent(JSON.stringify(data)))).replace(/\\+/g,'-').replace(/\\//g,'_').replace(/=+$/,'');
window.open(appUrl+'/affiliate/import#d='+b64,'_blank');
}catch(e){alert('Postiz: '+(e&&e.message))}})`;

/** `javascript:` URL for the bookmark (the function source, with the app URL). */
export const bookmarkletHref = (appUrl: string) =>
  'javascript:' +
  encodeURIComponent(
    BOOKMARKLET_SOURCE.replace(/\n/g, '') + '(' + JSON.stringify(appUrl) + ');void 0'
  );

export interface CapturedProduct {
  v: number;
  url: string;
  name: string;
  price?: string;
  description?: string;
  images?: string[];
  videos?: string[];
  rating?: string;
  sold?: string;
}

/** Reads the data the bookmarklet put in the URL fragment. */
export const readCapturedFromHash = (hash: string): CapturedProduct | null => {
  const m = hash.match(/(?:^#|&)d=([A-Za-z0-9_-]+)/);
  if (!m) return null;
  try {
    const b64 = m[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64 + '==='.slice((b64.length + 3) % 4);
    const json = decodeURIComponent(escape(atob(padded)));
    const data = JSON.parse(json);
    if (!data || typeof data.url !== 'string' || typeof data.name !== 'string') return null;
    return data;
  } catch {
    return null;
  }
};
