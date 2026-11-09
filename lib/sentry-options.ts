// The DSN is public; build/upload credentials belong only in SENTRY_AUTH_TOKEN.
export const sentryOptions = {
  dsn:
    process.env.NEXT_PUBLIC_SENTRY_DSN ??
    "https://1aae069856a229384efd225b88df273a@o4512399029305344.ingest.us.sentry.io/4512399058272256",
  environment:
    process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
  release: process.env.NEXT_PUBLIC_SENTRY_RELEASE,
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,
  dataCollection: {
    userInfo: false,
    cookies: false,
    httpHeaders: false,
    httpBodies: [],
    urlQueryParams: false,
    databaseQueryData: false,
    stackFrameVariables: false,
  },
};
