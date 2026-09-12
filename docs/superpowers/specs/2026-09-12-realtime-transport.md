# Realtime transport — P14.T0

**Status:** recommendation, awaiting the owner. Nothing implemented. No source file
written, `docs/DECISIONS.md` untouched.

**Deferred from:** D23 ("realtime transport deferred to phase 14"), which inherited
it from D13 ("realtime ships after cutover; polling until then"). D48 binds the
draft board to the same answer: one mechanism, both surfaces.

**Researched:** 2026-09-12, against live documentation. Every platform claim below
carries a source. The two claims most models get wrong — that Vercel Functions
cannot hold a socket, and that streaming needs `runtime = 'edge'` — are both false
and were verified rather than recalled.

---

## 1. The problem, sized

An admin marks a winner during a ceremony. Every viewer's page should show it
without a reload. Same shape on the draft board: an owner enters picks on a video
call while the league watches (D46/D48). Both are **one-way, server to client**.
Nothing is computed on the client; the number is already in `winners` and already
flows through `lib/services/scoring.ts`.

Measured against the actual product:

| | |
|---|---|
| Total users | 60 |
| Viewers at the peak moment | ~20 (one league) |
| Ceremony length | ~3 hours |
| Categories in a show | ~24 |
| Server-side writes per ceremony | ~50 (24 winners plus corrections — a correction is ordinary, not an error path, per `actions/awards/set-winner.ts`) |
| Client-visible deliveries per ceremony | ~1,000 (50 events × 20 viewers) |
| Average event rate | **one event every four minutes** |

🔴 **This is not a realtime problem by volume. It is a realtime problem by
duration.** One event every four minutes is a rounding error on every pricing
page in this document. What is hard is staying connected and correct for three
hours on a platform whose function ceiling is five minutes.

Three properties follow, and they decide the whole thing:

1. **Fan-out must cross instances.** The admin's write lands on one function
   instance; viewers are connected to others. Vercel is explicit: *"Because no two
   instances share memory"* and connections pin to the instance that accepted them
   — rooms, presence and pub/sub coordination must live in an external store
   ([KB: publish and subscribe to realtime data](https://vercel.com/kb/guide/publish-and-subscribe-to-realtime-data-on-vercel)).
2. **Every connection dies at 300 seconds.** *"WebSocket connections close when a
   Vercel Function reaches its maximum duration"*
   ([WebSockets](https://vercel.com/docs/functions/websockets)), and the same
   ceiling governs a streamed HTTP response: max duration *"includes time spent
   processing the request and sending the response, including streamed responses"*
   ([Limits](https://vercel.com/docs/functions/limitations)). A 3-hour ceremony is
   **36 forced disconnects per client**, ~720 across 20 clients.
3. **The page is public.** P17.T16 put `/live/(.*)` in `proxy.ts`'s `isPublic` on
   the owner's ruling. The viewer count is therefore not bounded by the user
   table — a link pasted into a wider chat during a ceremony is the intended use.

🔴 **Property 2 plus property 1 is the finding that decides this document.** A
push mechanism delivers *events*. An event delivered into one of those 720
reconnect gaps is gone — `NOTIFY` is fire-and-forget, Redis pub/sub has no
replay, and a socket that is not open receives nothing. So **every** push design
must also do a full state read on (re)connect to catch up. That state read *is* a
poll. You do not get to choose between "a bus" and "a poll" — you build the poll
either way, and then decide whether a bus earns its place on top of it.

At one event every four minutes and twenty readers, it does not.

---

## 2. What was verified, and what is taken on trust

**Verified against current docs (2026-09):**

- Vercel Functions hold WebSockets natively; Next.js uses
  `experimental_upgradeWebSocket()` from `@vercel/functions`; no third party is
  required. Requires Fluid compute, default since 2025-04-23.
  ([WebSockets](https://vercel.com/docs/functions/websockets))
- SSE and `ReadableStream` work on the default Node.js runtime. Vercel states
  plainly that Edge offers no streaming advantage. Edge is *not* recommended.
  (`vercel:vercel-functions` skill; [Streaming](https://vercel.com/docs/functions/streaming))
- Fluid reuses one instance across concurrent requests, and Provisioned Memory is
  billed *per instance lifetime*, not per request:
  *"If you have a 1GB function instance running for 1 hour handling multiple
  requests, you're billed for 1 GB-hour … regardless of how many requests it
  processed."*
  ([Fluid compute pricing](https://vercel.com/docs/functions/usage-and-pricing))
- 🔴 **Hobby max duration is 300s default *and maximum*** — not raisable. Pro
  reaches 800s, and 1800s in beta.
  ([Limits](https://vercel.com/docs/functions/limitations))
- Hobby monthly allowances: **4 CPU-hrs Active CPU, 360 GB-hrs Provisioned
  Memory, 1M invocations**; memory fixed at 2 GB / 1 vCPU; concurrency auto-scales
  to 30,000; single region (`iad1`) — multi-region is Pro and above.
  ([Limits](https://vercel.com/docs/limits), [Functions limits](https://vercel.com/docs/functions/limitations))
- 🔴 **Neon's pooler does not support `LISTEN`/`NOTIFY`.** The docs list it
  explicitly under "Not supported with pooled connections", alongside
  `SET`/`RESET`, SQL-level `PREPARE`, and temp tables. Direct connection required.
  ([Connection pooling](https://neon.com/docs/connect/connection-pooling)) — the
  same class of breakage `prisma.config.ts` already documents for advisory locks
  and DDL.
- Neon direct connection limit at 0.25 CU: **104 `max_connections`, 7 reserved for
  the superuser → 97 usable.** Pooled endpoint: up to 10,000. (same page)
- Neon Free: **100 CU-hrs per project per month**, 0.5 GB storage, **scale-to-zero
  after 5 minutes and not disableable**, no always-on compute.
  ([Plans](https://neon.com/docs/introduction/plans))
- Upstash Redis free: **500K commands per month** (not per day), 256 MB, 10 GB
  bandwidth, 10k commands/sec ceiling.
  ([Upstash pricing](https://upstash.com/pricing/redis))
- Pusher Channels Sandbox (free): **100 concurrent connections, 200K messages/day.**
  Next tier, Startup, **$49/mo** (1M msgs/day, 500 connections).
  ([Pusher pricing](https://pusher.com/channels/pricing/))
- Ably free: **6M messages/month, 200 concurrent connections, 200 channels.** Next
  tier, Standard, **$29/mo**. ([Ably pricing](https://ably.com/pricing))
- Vercel Queues: public beta, **billed per API operation with no stated free
  allowance**, permission-gated. Fan-out is to *consumer groups*, i.e. server-side
  workers — not to browsers.
  ([Queues](https://vercel.com/docs/queues), [Queues pricing](https://vercel.com/docs/queues/pricing))

**Taken on trust, and flagged as such:**

- 🔴 **Whether WebSockets are usable on Hobby at all.** The docs page carries a
  `🔒 Permissions Required: WebSockets` banner, the feature is in public beta, and
  no page states plan eligibility. The `@vercel/functions` API is `experimental_`
  prefixed. This is unresolved — but it does not change the recommendation, because
  §3.2 rules WebSockets out on shape, not on availability.
- 🔴 **How aggressively Fluid packs 20 idle held connections onto one instance.**
  The docs say one instance serves many concurrent WebSocket connections and that
  optimized concurrency exists, but publish no per-instance connection number. §4
  prices the best, likely and worst cases rather than guessing. **This is the one
  number that wants a measurement, and P12 already carries "measure Neon free-tier
  headroom and Runtime Cache hit rate under realistic load" — this belongs beside it.**
- Upstash pub/sub command accounting (whether each delivered message to each
  subscriber counts as a command). Immaterial: even the most pessimistic reading is
  ~1,000 commands per ceremony against 500K/month.

---

## 3. The options

### 3.1 SSE over Fluid compute, with a server-side poll behind it — **recommended**

**How it works.** `GET /api/live/[abbr]/stream` returns a `ReadableStream` with
`Content-Type: text/event-stream` on the default Node runtime. The handler loops:
call `getLiveShow(abbr, year, userId)` — the existing P17.T16 service, unchanged —
every 2 seconds, hash the result, and emit an SSE frame only when the hash moves.
At ~290s it closes cleanly; `EventSource` reconnects itself; the server's first
frame on every connection is always the **complete current state**.

**Fan-out.** 🔴 **There is none to solve, and that is the argument.** The admin's
write goes to Postgres. Two seconds later every stream on every instance sees it,
because every stream reads Postgres. **The database is the bus.** No publisher, no
broker, no channel names, no secret, no vendor, no `@vercel/functions` beta API.

**At 300s.** The server closes *before* the platform kills it, so the client sees a
clean end rather than a truncated stream. `EventSource` reconnects per spec (~3s,
tunable with a `retry:` field), and the reconnect costs nothing because the first
frame is full state. A winner announced during the gap arrives on the next frame.

**Reconnection.** Native and free. This is the property no push option has.

**Cost.** §4. Free on Hobby and Neon Free with an order of magnitude of headroom,
provided the stop conditions in §5 are built.

**Dependencies added.** None. `ReadableStream`, `TextEncoder` and `EventSource`
are all platform. No new package, no new env var, no new account.

**Honest weaknesses.**
- Up to 2s of latency plus render. (The broadcast feed is 5–20s behind the stage;
  this is not the bottleneck a viewer perceives.)
- It is a poll, and it will look like a cop-out to anyone who reads only the
  heading. §1 property 2 is the answer: every alternative contains this poll.
- It ties stream lifetime to Neon awake-time, which is the free tier's real
  currency. §5 makes that a design requirement rather than a hope.

---

### 3.2 WebSockets via `experimental_upgradeWebSocket()`

**How it works.** `app/api/ws/route.ts` returns
`experimental_upgradeWebSocket(ws => …)`. Supported, documented, real.

**Fan-out.** Unsolved by the socket itself, and Vercel says so: *"New WebSocket
connections are not guaranteed to reach the same Vercel Function instance … Store
durable state, presence, counters, rooms, and pub/sub coordination in an external
data store"* ([WebSockets](https://vercel.com/docs/functions/websockets)). So this
option is really "WebSockets **plus** §3.3, §3.4 or §3.6".

**At 300s.** Identical — the docs describe the same close and the same
client-side exponential-backoff reconnect, and add that reconnect logic must
*"resubscribe to any channels or topics, and reload any state the client needs"*.
That reload is §3.1's first frame, written by hand.

**Cost.** Identical to SSE: *"WebSocket connections use Vercel Functions and follow
the same limits and pricing model as other Function invocations."* No saving.

**Verdict: ruled out on shape, not capability.** 🔴 Both surfaces are strictly
one-way. A WebSocket buys a client→server channel nobody uses, costs exactly the
same compute, dies at exactly the same ceiling, still needs an external bus, adds
an `experimental_`-prefixed beta API and a permission gate of unconfirmed
availability on Hobby — and replaces `EventSource`'s built-in reconnect with
hand-written backoff. It is more machinery for less function.

---

### 3.3 Postgres `LISTEN`/`NOTIFY` as the bus

**How it works.** `set-winner.ts` issues `NOTIFY live_<abbr>, '<payload>'`; each
stream holds a session `LISTEN`ing and forwards.

**Fan-out.** Genuinely works, and it is the most tempting option here because the
database is already in the stack.

**Four problems, in ascending order of seriousness.**

1. 🔴 **It cannot use the app's connection.** Neon's pooler explicitly does not
   support `LISTEN`/`NOTIFY`
   ([Connection pooling](https://neon.com/docs/connect/connection-pooling)). `lib/db.ts`
   runs `@prisma/adapter-neon` on `DATABASE_URL`, the pooled host. A listener needs
   a *second* client on `DATABASE_URL_UNPOOLED` — the same split `prisma.config.ts`
   already documents for advisory locks and DDL. This is a known, repo-acknowledged
   trap, not a surprise.
2. **It needs raw SQL and a production dependency.** Prisma has no `LISTEN` API, so
   it is `pg` or `@neondatabase/serverless` directly. `pg` is a **devDependency**
   today and would have to be promoted.
3. **It spends the scarce connection budget.** One direct session per stream against
   97 usable slots at 0.25 CU. Twenty is survivable; it is also the app's entire
   direct-connection headroom pledged to one page.
4. 🔴 **It loses announcements.** `NOTIFY` is fire-and-forget with no replay. Across
   ~720 mandatory reconnect gaps in a 3-hour ceremony, a winner landing in a gap is
   never delivered to that viewer. The fix is a full state read on connect — §3.1.
   **Having built §3.1, the `LISTEN` half buys 2 seconds of latency for a second
   connection path, a promoted dependency, and raw SQL.**

**Cost.** Free — it is the same Neon compute. Cost is not why it loses.

**Verdict: ruled out.** The right assessment is that it is a *latency optimisation
on top of the recommendation*, not an alternative to it, and at one event every
four minutes there is no latency to optimise.

---

### 3.4 Upstash Redis pub/sub (Marketplace)

**Fan-out.** Correct and conventional: publish on write, `SUBSCRIBE` per stream.

**Cost.** Free tier 500K commands/month; this needs ~1,000 per ceremony. Not close
to a limit.

**Against it.**
- 🔴 **Pub/sub needs a real Redis connection.** `@upstash/redis` is a REST client
  and cannot `SUBSCRIBE`; this means adding `ioredis` (or equivalent) as a
  production dependency plus a new secret.
- It still dies at 300s and still loses messages across the gap → §3.1 anyway.
- 🔴 **This project already deleted Upstash once.** D6 introduced it, D23 removed
  it in favour of Vercel Runtime Cache. Re-adding it to solve a problem twenty
  people create would need a much better reason than "this is how it is usually done".

**Verdict: ruled out.** Correct architecture, wrong scale. Named in §6 as the
upgrade path if the premise ever changes.

---

### 3.5 A hosted vendor — Pusher or Ably

🔴 **Taken seriously, and it is the only option that beats the recommendation on a
real axis.** The brief is right that "no vendor" is not an argument by itself.

| | Pusher Sandbox | Ably Free |
|---|---|---|
| Concurrent connections | **100** | **200** |
| Messages | 200K/day | 6M/month |
| Channels | — | 200 |
| Needed here | ~20 conns, ~1,000 msgs/day | same |
| Cost today | **$0** | **$0** |
| First paid tier | **$49/mo** | **$29/mo** |

**What it genuinely buys.**
- 🔴 **It moves connection-holding off Vercel entirely.** The Provisioned Memory
  exposure in §4 — the one number in this document with real uncertainty — goes to
  zero. That is a substantive win, not a stylistic one.
- The 300s ceiling disappears. The vendor holds the socket; reconnects are the
  client library's problem and are well-tested.
- Vercel's own function work reduces to one HTTP publish inside `set-winner.ts`,
  which is trivially cheap and trivially testable.

**What it costs.**
- Two production dependencies (`pusher` server + `pusher-js` client, or the Ably
  equivalents), an account, and a secret — plus a **public** key served to anyone
  who opens the public `/live` page.
- 🔴 **It does not delete the poll.** A client that reconnects, or that loads the
  page mid-ceremony, still needs current state. That comes from the server render
  or a fetch — the same state read §3.1 is built around. So the vendor is added
  *on top of* the thing that already suffices, not instead of it.
- 🔴 **The connection cap is a wall, and `/live` is public.** 100 concurrent
  connections against a 60-user app looks roomy until the ceremony link goes wide
  — which is the stated purpose of making the route public. At 101 viewers Pusher
  refuses connections; on Vercel the same growth shows up as GB-hrs you can watch
  climbing in Observability. **A hard cliff is worse than a soft slope for a page
  whose audience is deliberately unbounded.** Ably's 200 doubles the runway without
  changing the shape.
- Outgrowing it costs $49/mo (Pusher) or $29/mo (Ably) — a step, not a ramp.

**Verdict: the runner-up, and the one to present to the owner.** It wins on
"someone else holds the socket". It loses on dependency count, on the connection
cliff against a public page, and on not actually removing the work it is meant to
replace. If the owner's priority is *never think about Vercel function billing
again*, Ably free is the answer and it is defensible.

---

### 3.6 Vercel Queues

Fan-out is to **consumer groups** — server-side workers — not to browsers. Poll
mode would mean each viewer's stream issuing metered `Receive` operations on a
loop, i.e. §3.1 with a bill attached. Billed per operation with **no stated free
allowance**, and permission-gated in beta.

**Verdict: ruled out.** It is a durable work queue, not a broadcast bus, and it is
the only option in this document that costs money from day one.

---

### 3.7 Client-side polling (what D13 promised)

For the record: `grep` finds **no client poll in the repo**. The only `setInterval`s
are `LiveCountdown`'s clock and `GroupCeremony`'s reel tick. D13's fallback was
never built, so there is nothing to remove — P14.T3's "replacing the polling hook"
is replacing something that does not exist.

Worth stating because it is the honest comparison: 20 clients polling a **page**
every 2s is 36,000 full RSC renders an hour, each a real invocation with real
queries. The recommendation is the same idea with the loop moved server-side,
where one held connection replaces 1,800 invocations per client per hour and the
work is one cheap query instead of a page render.

---

## 4. Cost at this scale, worked

Assumption throughout: **Vercel Hobby, Neon Free**, one 3-hour ceremony with 20
concurrent viewers, ~6 shows in a season.

### Vercel — Provisioned Memory (360 GB-hrs/month included)

Billed per **instance** lifetime × 2 GB, shared across concurrent requests on that
instance. The unknown is how many instances 20 idle streams occupy.

| Packing | GB-hrs per ceremony | % of monthly allowance |
|---|---|---|
| All 20 on one instance (Fluid working as documented) | **6** | 1.7% |
| Spread across 4 instances | **24** | 6.7% |
| Pathological — one instance each | **120** | **33%** |

🔴 **This is the only number in the document that can bite, and it is identical
for SSE and for WebSockets.** Best and likely cases are comfortable — six shows a
season at 24 GB-hrs is 144 GB-hrs, inside 360 for a month in which every ceremony
somehow happened. The pathological case blows the month in three ceremonies.
**Measure it after the first real ceremony in Observability; do not guess.** A
hosted vendor (§3.5) is the mitigation if the measurement is bad; Pro is the other.

### Vercel — Active CPU (4 CPU-hrs/month included)

Waiting on I/O does not count. A 2s poll is 20 × 3h × 1,800/h = **108,000 queries**
per ceremony; at ~5 ms of genuine CPU each (Prisma deserialise + hash + compare)
that is ~540 CPU-seconds ≈ **0.15 CPU-hrs**, under 4%. At 5s polling it is 0.06.
**Not a constraint.**

### Vercel — Invocations (1M/month included)

One per stream per 290s window: 20 × 12/h × 3h = **720 per ceremony**. Immaterial.

### Neon Free (100 CU-hrs/project/month)

🔴 **Neon bills awake-time, not queries.** At the free 0.25 CU:

- One 3-hour ceremony holding the compute awake: **0.75 CU-hrs** — 0.75% of the
  month. Six ceremonies: 4.5 CU-hrs. Nothing.
- 108,000 queries during that window cost **nothing extra**, because the compute
  was awake anyway. **The poll interval is a latency decision, not a cost
  decision**, which is the opposite of the intuition in the brief — 2s is fine.
- 🔴 **The actual hazard is one forgotten tab.** A stream that reconnects forever
  pins the compute awake: 0.25 CU × 720 h = **180 CU-hrs/month against a 100
  CU-hr allowance.** One person leaving `/live` open on a spare monitor exhausts
  Neon's free tier by itself. Scale-to-zero after 5 minutes is mandatory on Free
  and cannot be disabled, so the *only* defence is not holding the connection.
  §5 makes this a task rather than a footnote.

Connection budget: pooled endpoint, up to 10,000 — 20 streams is nothing. (This is
also why §3.3 is expensive and §3.1 is not: the recommendation stays on the
pooler, where the app already lives.)

### Verdict by cost class

| Option | Free at this scale? |
|---|---|
| **SSE + server poll** | ✅ **Free, day one, no threshold, no new vendor or dependency.** Ceiling is Vercel Provisioned Memory (§4) and Neon awake-hours (§5) — both visible in dashboards before they bite. |
| WebSockets + a bus | ✅ Free, identical Vercel cost, plus whatever bus it needs. No saving over SSE. |
| Postgres LISTEN/NOTIFY | ✅ Free. Loses on correctness and dependency cost, not money. |
| Upstash Redis | ⚠️ Free **until ~500K commands/month** — roughly 500 ceremonies. Effectively unreachable; the cost is the dependency, not the bill. |
| **Ably** | ⚠️ Free **until 200 concurrent connections or 6M msgs/month**, then **$29/mo**. ~200 simultaneous viewers = ~10× today's league. |
| **Pusher** | ⚠️ Free **until 100 concurrent connections or 200K msgs/day**, then **$49/mo**. ~100 simultaneous viewers = ~5× today's league, and reachable on a public page. |
| Vercel Queues | ❌ **Metered per operation from the first message.** No free allowance. |

---

## 5. Recommendation

🔴 **Server-side polling behind an SSE stream, on the default Node.js runtime, with
Postgres as the bus.** No new dependency, no new vendor, no new secret, no beta
API, free on Hobby and Neon Free with an order of magnitude of headroom.

The shape:

- `GET /api/live/[abbr]/stream` — `ReadableStream`, `text/event-stream`,
  `Cache-Control: no-store`, `X-Accel-Buffering: no`. **Not** `runtime = 'edge'`.
- The loop calls `getLiveShow()` — the existing service, unchanged — every 2s,
  hashes the view, and emits only on change. A `:` keepalive comment every ~20s
  keeps intermediaries from dropping an idle stream.
- Closes itself at ~290s, ahead of the platform's 300s kill, so the client sees a
  clean end rather than a truncated frame.
- 🔴 **The first frame of every connection is full current state.** This is the
  whole reconnection story, and it is what makes the 36-disconnects-per-viewer
  reality a non-event: nothing announced during a gap can be missed, because
  nothing is ever delivered as a delta-only event.
- The route joins `isPublic` in `proxy.ts` beside `/live/(.*)`, for the same
  reason and with the same narrow-amendment note P17.T16 wrote for D40.

**Stop conditions — these are the free-tier guard, not polish:**

- The server closes the stream permanently, and signals "do not reconnect" (a 204
  on the reconnect attempt is the cleanest), when the show's `awardsActive` is
  false. A ceremony that has ended stops costing money.
- The client closes its `EventSource` on `document.visibilitychange → hidden` and
  reopens on visible. This is what stops a forgotten tab from spending 180 CU-hrs
  against Neon's 100 (§4).

**Failure modes accepted, explicitly:**

1. **Up to ~2s of latency** on a winner. The broadcast is 5–20s behind the stage;
   nobody perceives this.
2. **A ~3s dead window every ~290s** during which a new winner is not pushed. It
   is invisible because the reconnect immediately delivers full state — the
   announcement appears 3 seconds late, not never.
3. **If Neon is briefly unreachable**, the loop skips a beat and the page keeps
   showing its last good state. Same posture as `lib/external/cache.ts`: an
   infrastructure failure is a slow path, not an error path.
4. **It scales to roughly a few hundred concurrent viewers** before the Provisioned
   Memory arithmetic (§4) gets uncomfortable. That is 10× the league and the
   failure is a bill, visible in advance in Observability — not an outage.

**What I would build first, in one sitting:** the route, the loop, the 290s close,
and a two-tab manual check that a winner marked in tab A appears in tab B. That is
the whole risk. Everything else — the hook, the animation, the E2E — is downstream
of it working.

---

## 6. The upgrade path, named

🔴 If the premise changes — hundreds of concurrent viewers, or sub-second latency
becomes a product requirement — **the change is one line inside the loop.** Replace
`await sleep(2000)` with an await on a notification (Upstash pub/sub, or
`LISTEN`/`NOTIFY` on the unpooled endpoint), and keep the full-state read on
connect exactly as it is. The route contract, the client hook, `getLiveShow()` and
every component are untouched.

That is the `ponytail:` comment this design leaves behind:

```
// ponytail: polls Postgres every 2s; the DB is the bus. ~20 viewers, ~1 event
// per 4 minutes. Swap the sleep for a pub/sub await if concurrent viewers pass
// ~200 — the full-state-on-connect contract already covers the reconnect gap.
```

---

## 7. What this means for Phase 14

| Task | As planned | After this decision |
|---|---|---|
| **T0** | Choose the transport | ✅ This document. |
| **T1** | Publisher wired into the winner-marking Server Action | 🔴 **Delete.** There is no publisher. `actions/awards/set-winner.ts` is unchanged — its existing `revalidatePath` still serves the non-streaming pages. |
| **T2** | `/api/live/[event]/stream` SSE route | ✅ **Stands, as written.** The original plan guessed right. |
| **T3** | Client subscription replacing the polling hook | ✅ Stands, with a correction: **there is no polling hook** (§3.7). This is a new `useLiveShow(abbr, initial)` wrapping `EventSource`, seeded from the server-rendered view so first paint is instant. |
| **T4** | Winner-seal stamp animation | Unaffected. Fires on the transition the hook already surfaces. |
| **T5** | Reconnection handling | 🔴 **Promoted from a nicety to the centre of the design** — and mostly free. `EventSource` reconnects itself; the work is the 290s server close, the full-state-on-connect guarantee, and a "stream stalled" affordance. |
| **T6** | E2E: two clients, admin marks winner, viewer receives it | ✅ Stands. Two Playwright browser contexts; the assertion that matters is that context B updates **with no `reload()`**. |
| **T7** | *(new, small)* | **Stop conditions**: close on `awardsActive === false`, close on tab hidden. 🔴 Its own task because it is the free-tier guard and is exactly the kind of thing that gets folded into T2 and then skipped. |
| **D48** | Draft board on the same transport | Same route shape and the same hook, pointed at `getLeagueBoard`. 🔴 **Do not generalise the route until the second consumer actually exists** — one `[abbr]` route now, a shared helper when there are two. |

**One ordering note.** `LiveShowView.leagues` is typed `[]` in T16a and widens to
`LiveLeague[]` in T16b. The stream serialises whatever the type is, so T2 should
land after T16b — or knowingly ship a narrower payload and widen it later.

**Tension to record:** D8 says "no general `/api` layer". `app/api/` already holds
three routes, each with a narrow written justification (`revalidate`, `ical`,
`webhooks/clerk`). A stream is a fourth of the same kind — it is not a page, a
Server Component cannot hold a connection, and a Server Action cannot return a
stream. The route should carry that justification in its own header comment, in
the register the existing three use.

---

## 8. Does P17.T16's live page need changing?

🔴 **No — and that is the payoff of how T16 was built.**

`getLiveShow()` returns a plain serialisable `LiveShowView`. The page is a Server
Component that renders it. T3 wraps the rendered subtree in a client component
taking that server value as `initial` and re-rendering from stream frames.
`lib/services/live.ts`, its types, `LiveCountdown` and `LiveBoard` are all
untouched. This is exactly the property D48 asserted for the draft board —
"realtime is added by changing who supplies the props" — and T16 gets it for free
by having held no state of its own.

The only additions outside the new route are the `isPublic` entry and the client
wrapper.

---

## 9. Proposed `DECISIONS.md` entry

🔴 **Unnumbered by instruction.** The ledger is complete through D84 and P17.T26
assigns D85+ in one pass. Do not number this, and do not edit `DECISIONS.md`.

> | D?? | **Realtime is an SSE stream over a server-side poll; Postgres is the bus.** `/api/live/[abbr]/stream` holds a `text/event-stream` response on the default Node runtime (never `runtime = 'edge'` — Vercel discourages it and it offers no streaming advantage), re-reads `getLiveShow()` every two seconds, and emits only on change. There is no publisher, no broker and no vendor: the admin's write lands in Postgres and every stream on every instance sees it on its next read. **This supersedes the polling fallback of D13 and closes the transport deferral of D23, and it serves the draft board too (D48) — one route shape, one hook, both surfaces.** 🔴 **The reason it is a poll is the 300-second function ceiling, not laziness.** Every connection on Vercel is killed at 300s (Hobby's default *and* maximum), so a three-hour ceremony is ~36 forced disconnects per viewer. A pushed *event* delivered into one of those gaps is lost forever — `NOTIFY` is fire-and-forget and Redis pub/sub has no replay — so every push design must also read full state on reconnect. That read *is* the poll. Having built it, the bus buys two seconds of latency for a second connection path and a new dependency, at one event every four minutes and twenty viewers. So the stream closes itself at ~290s and **its first frame is always complete current state**, which makes the reconnect gap unmissable rather than merely short. Rejected: WebSockets via `experimental_upgradeWebSocket()` — supported and real, but both surfaces are one-way, it costs identical compute, dies at the identical ceiling, still needs an external store for cross-instance fan-out, and trades `EventSource`'s built-in reconnect for hand-written backoff; `LISTEN`/`NOTIFY` — Neon's pooler does not support it, so it needs a second client on the unpooled URL, promotes `pg` to a production dependency, and spends the 97-slot direct connection budget; Upstash pub/sub — D23 removed Upstash from this project once already; Vercel Queues — a durable work queue for server-side consumer groups, metered per operation from the first message. Pusher and Ably were taken seriously and are genuinely free at this size; they lose on a hard concurrent-connection cliff (100 and 200) against a **public** `/live` page whose audience is deliberately unbounded, and on not removing the state read they would sit on top of. 🔴 **The cost model is awake-time, not messages.** Neon bills compute-hours, so 108,000 polls during a ceremony cost nothing the ceremony was not already spending — but a stream that reconnects forever pins the compute awake and one forgotten tab spends 180 CU-hrs against a 100 CU-hr free allowance. The stream therefore closes permanently when the show is off air and while the tab is hidden; those stop conditions are load-bearing, not polish. |

---

## 10. What needs the owner, not me

1. 🔴 **Hobby or Pro.** Everything here assumes Hobby, where 300s is the hard
   ceiling and 360 GB-hrs is the month. The design works on Hobby. The one number
   that could surprise is how Fluid packs 20 held connections (§4): best case is
   1.7% of the month per ceremony, pathological case is 33%. **This is measurable
   after the first real ceremony and should be measured** — it belongs with P12's
   existing free-tier headroom task. Deciding in advance is guessing.
2. 🔴 **Vendor or not — a real fork, not a formality.** Ably free (200 connections,
   6M msgs/month, then $29/mo) moves connection-holding off Vercel entirely and
   makes item 1 moot. It costs two dependencies, an account, a public key on a
   public page, and a hard cliff at 200 concurrent viewers. If the owner's
   priority is "never think about function billing", that is a defensible answer
   and I would not argue against it. My recommendation is the other way because
   the public page's audience is unbounded by design and a soft slope beats a wall
   — but this is a preference about risk, which is the owner's to hold.
3. **Is ~2s good enough?** The product call. My read is comfortably yes (the
   broadcast lags the stage by more), but nobody has watched a ceremony on this
   app yet.
4. **Is "the answer is polling" acceptable?** D13 promised "polling until then",
   and this decision says polling is the destination, with the loop moved
   server-side. §1 property 2 is the technical justification and I believe it
   holds. But someone should be comfortable saying it out loud before it is in the
   ledger.
