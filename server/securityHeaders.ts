const ADSENSE_SCRIPT_HOSTS = [
  "https://pagead2.googlesyndication.com",
  "https://fundingchoicesmessages.google.com",
];

const ADSENSE_CONNECTION_HOSTS = [
  "https://pagead2.googlesyndication.com",
  "https://googleads.g.doubleclick.net",
  "https://fundingchoicesmessages.google.com",
  "https://ep1.adtrafficquality.google",
  "https://ep2.adtrafficquality.google",
];

const ADSENSE_FRAME_HOSTS = [
  "https://pagead2.googlesyndication.com",
  "https://googleads.g.doubleclick.net",
  "https://tpc.googlesyndication.com",
  "https://fundingchoicesmessages.google.com",
  "https://www.google.com",
];

export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  `script-src 'self' ${ADSENSE_SCRIPT_HOSTS.join(" ")}`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob: https:",
  `connect-src 'self' ${ADSENSE_CONNECTION_HOSTS.join(" ")}`,
  `frame-src https://js.stripe.com https://hooks.stripe.com ${ADSENSE_FRAME_HOSTS.join(" ")}`,
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
].join("; ");
