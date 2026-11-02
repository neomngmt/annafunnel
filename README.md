# Funnel chat

Chat page per model: 18+ step, chat with her labelled AI version, OnlyFans link. Page URL: `?m=<slug>&src=<source>`.

## Local preview

Without a key the bot plays fixed lines and the page says so. For real replies, put `ANTHROPIC_API_KEY=...` in a `.env` file here. It uses the persona from `sql/pages/anna.sql`, and each message costs money.

```bash
npm install
```

```bash
node --env-file-if-exists=.env dev/server.mjs
```

Open http://localhost:4321/?m=anna&src=ig. Tests:

```bash
node --test dev/core.test.mjs
```

## Going live

1. In this project's own Supabase project, run `sql/funnel.sql` and `sql/storage.sql` in the SQL editor, upload the photos to the `funnel` bucket, then insert a row into `funnel_pages` per model with full photo URLs (see `sql/pages/anna.sql`). Each model gets her own file in `sql/pages` and her own page at `?m=<slug>`.
2. Set the secrets listed at the top of `supabase/functions/funnel-chat/index.ts`.
3. Deploy with `supabase functions deploy funnel-chat --no-verify-jwt`.
4. Put the function URL in the `funnel-api` meta tag of `public/index.html` and host that file on its own domain.
5. Set a monthly spend limit on the Anthropic key, the endpoint is public.

Stats per page, source and day are in the `funnel_stats` view. Chat text is not stored.

The AI badge next to the name is hardcoded on purpose and must stay visible.
