# hafsdaangn

## Sentry monitoring

Errors and request/navigation tracing are configured for the browser, Node.js, and
Edge runtimes. The public DSN defaults to the `hafsdaangn` project in the
`hafsdaangn` organization. Override `NEXT_PUBLIC_SENTRY_DSN` to use another project,
or set it to an empty string to disable reporting. Development captures all traces;
production captures 10%. Error sampling remains at 100%.

### Vercel deployment

1. Create an organization auth token in
   [Sentry organization settings](https://hafsdaangn.sentry.io/settings/auth-tokens/)
   with source-map/release upload permissions. Store it as `SENTRY_AUTH_TOKEN` in
   the Vercel project's environment variables for Production and Preview builds.
   Keep the token out of source control and browser variables.
2. Deploy the instrumented commit using the normal Vercel deployment flow.
   `VERCEL_ENV` supplies the Sentry environment, and `VERCEL_GIT_COMMIT_SHA`
   supplies the release identifier to both browser and server code. Other hosts
   should set `NEXT_PUBLIC_SENTRY_ENVIRONMENT` and `SENTRY_RELEASE` at build time.
3. The Sentry Next.js build plugin uploads source maps and associated source
   content from that build to `hafsdaangn/hafsdaangn`, then removes client maps
   from the deployed output. Uploads require `SENTRY_AUTH_TOKEN`; without it,
   error capture still works but production browser frames may be minified.
4. After deploying, verify a fresh error in
   [Sentry Issues](https://hafsdaangn.sentry.io/issues/?project=4512399058272256)
   and check that it has the expected environment, release, file, and line.

Run `npm run dev` for local development or `npm run build` and `npm start` for a
production build. Local source-map uploads can use the same token in the ignored
`.env.local` file. Session Replay and a feedback widget are not enabled.
