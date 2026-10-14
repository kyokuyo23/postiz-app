const possible =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

// Unbiased index from a CSPRNG (rejection sampling). `crypto` is a global in
// Node >= 19 and in all supported browsers, so this works on backend and frontend.
const randomIndex = (max: number) => {
  const limit = 256 - (256 % max);
  const buf = new Uint8Array(1);
  let value: number;
  do {
    globalThis.crypto.getRandomValues(buf);
    value = buf[0];
  } while (value >= limit);
  return value % max;
};

// Same alphabet and output shape as before, but cryptographically secure:
// it is used for OAuth state, API keys, client secrets and auth codes.
export const makeId = (length: number) => {
  let text = '';
  for (let i = 0; i < length; i += 1) {
    text += possible.charAt(randomIndex(possible.length));
  }
  return text;
};
