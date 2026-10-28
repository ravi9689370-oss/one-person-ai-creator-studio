/**
 * maya.js — the local (offline) studio assistant.
 *
 * Honest by design: Maya identifies itself as an AI, runs rule-based
 * generation entirely on-device, and labels every answer "offline".
 * No network calls, no fabricated claims about cloud models.
 */

const PLATFORM_TAGS = {
  youtube: ["#youtubegrowth", "#contentstrategy", "#creatortips"],
  instagram: ["#reels", "#creatorlife", "#growthtips"],
  linkedin: ["#creatoreconomy", "#solopreneur", "#buildinpublic"],
  blog: ["#newsletter", "#writing", "#indiehackers"],
};

export const SUGGESTIONS = [
  "Give me 5 hook ideas for my top topic",
  "Outline a 60-second script",
  "Write an Instagram caption",
  "What should I post about next?",
  "How do I price a sponsorship?",
  "Plan my posting week",
];

function pick(list, n) {
  const copy = [...list];
  const out = [];
  while (copy.length && out.length < n) out.push(copy.splice(Math.floor(Math.random() * copy.length), 1)[0]);
  return out;
}

function hooks(topicTitle) {
  const t = topicTitle || "your topic";
  return [
    `I tried ${t.toLowerCase()} for 30 days. Here's what nobody tells you.`,
    `Stop scrolling — ${t.toLowerCase()} is easier than you think (if you avoid these 2 mistakes).`,
    `The 10-minute ${t.toLowerCase()} system that replaced my $4k/month workflow.`,
    `Why 90% of creators fail at ${t.toLowerCase()} — and the 10% do this instead.`,
    `I was wrong about ${t.toLowerCase()}. Here's what changed my mind.`,
  ];
}

function outline(title) {
  return `OUTLINE — "${title || "Untitled"}" (60s vertical)

1. HOOK (0:00–0:05)
   Pattern interrupt + the payoff promise.
2. STAKES (0:05–0:15)
   Why this matters now; one concrete number.
3. POINT (0:15–0:40)
   The one idea, demonstrated. Show, don't list.
4. PROOF (0:40–0:52)
   Before/after, screenshot, or result.
5. CTA (0:52–0:60)
   One ask only: follow, comment keyword, or next video.`;
}

function scriptDraft(topic, platform) {
  const t = topic || "your topic";
  return `TITLE: ${t}\nPLATFORM: ${platform || "youtube"}\n\nHOOK (0:00-0:08)\n${hooks(t)[0]}\n\nCONTEXT (0:08-0:30)\nSet the stakes: what the viewer gets in the next minute.\n\nMAIN POINT (0:30-1:40)\nOne idea, demonstrated step by step. Show the screen, the result, the mistake to avoid.\n\nPROOF (1:40-2:00)\nConcrete before/after with numbers.\n\nCTA (2:00-2:15)\nSingle ask. Comment keyword + follow for part 2.`;
}

function caption(platform, topic) {
  const t = (topic || "my new post").replace(/\.$/, "");
  const tags = (PLATFORM_TAGS[platform] || PLATFORM_TAGS.instagram).join(" ");
  if (platform === "linkedin") return `${t} — here's the honest breakdown.\n\nWhat worked:\n• One idea per post\n• Proof over promises\n• A single, clear CTA\n\nWhat I'd do differently: start with the result, not the story.\n\n${tags}`;
  if (platform === "youtube") return `${t} 🎬\n\nIn this one: the exact system, the mistakes to skip, and the result you can copy.\n\n${tags}`;
  return `${t} 👇\n\nSave this one — you'll want the checklist later.\n\n${tags}`;
}

function pricing(audience) {
  const perK = 25; // $25 per 1k impressions baseline
  const est = Math.max(1, Math.round((audience || 10000) / 1000));
  return `SPONSORSHIP PRICING WORKSHEET (baseline method)

Inputs: audience ≈ ${(audience || 10000).toLocaleString()} followers/subs.

Formula: $${perK} per estimated 1,000 reached views
→ floor price: $${(est * perK).toLocaleString()} per integration.

Rule of thumb:
• Integration (60–90s): 1.0× floor
• Dedicated video/newsletter: 3.0× floor
• Bundle (video + newsletter): 3.5–4× floor

Never discount below 0.8× floor. Trade "extra deliverables" before price.`;
}

function weekPlan(topics) {
  const t = topics.length ? topics : ["grow with a series", "teach a tool", "react to a trend"];
  return `POSTING WEEK PLAN (solo pace)

MON — Short teaser for "${t[0]}" (15s vertical, ends with a question)
TUE — Main upload: "${t[1] || t[0]}" (long-form or carousel)
WED — Engagement day: reply to every comment + 1 poll
THU — Short #2: behind-the-scenes of TUE's piece
FRI — "${t[2] || t[0]}" draft + thumbnail A/B test
SAT — Newsletter/blog recap of the week
SUN — Rest / batch hooks for next week

Rule: one idea, three formats.`;
}

/**
 * answer(input, ctx) → { text, action? }
 * ctx: { topTopic, recentScripts, followers }
 */
export function answer(input, ctx = {}) {
  const q = String(input || "").toLowerCase();
  const topic = ctx.topTopic || "";

  if (!q.trim()) return { text: "Ask me for hooks, an outline, a caption, pricing, or a week plan." };

  if (/\b(hooks?|opening|first line)\b/.test(q)) {
    const hs = hooks(topic).map((x, i) => `${i + 1}. ${x}`).join("\n");
    return { text: `5 hook options for ${topic ? `"${topic}"` : "your topic"}:\n\n${hs}\n\nWant any of these expanded into a full script?` };
  }
  if (/\b(outlines?|structures?|frameworks?)\b/.test(q)) return { text: outline(topic) };
  if (/\b(captions?|post text|social)\b/.test(q)) {
    const platform = /linked/.test(q) ? "linkedin" : /you ?tube|yt/.test(q) ? "youtube" : "instagram";
    return { text: caption(platform, topic) + "\n\nCopy it into Publishing Hub → Export package." };
  }
  if (/\b(scripts?|drafts?|write|writing)\b/.test(q)) {
    return { text: scriptDraft(topic, /insta/.test(q) ? "instagram" : /linked/.test(q) ? "linkedin" : "youtube") + "\n\n(This is a starting scaffold — edit it in the Script Studio.)" };
  }
  if (/\b(prices?|pricing|charge|rates?|sponsor)/.test(q)) return { text: pricing(ctx.followers) };
  if (/\b(weeks?|schedule|plans?|calendars?)\b/.test(q)) {
    const topics = (ctx.recentScripts || []).slice(0, 3).map((s) => s.title);
    return { text: weekPlan(topics) };
  }
  if (/\b(ideas?|topics?|about next|what should i post)\b/.test(q)) {
    const ideas = pick([
      "Teach the smallest useful version of your best-performing post.",
      "Reverse tutorial: start from the finished result, then unpack it.",
      "Myth vs reality in your niche — with one real number.",
      "A 7-day experiment, documented daily.",
      "The tool stack you'd rebuild with if you started today.",
      "React to a common mistake beginners make (and fix it live).",
    ], 4);
    return { text: `Next-post ideas${topic ? ` (building on "${topic}")` : ""}:\n\n${ideas.map((x, i) => `${i + 1}. ${x}`).join("\n")}` };
  }
  if (/^(hi|hello|hey)\b/.test(q)) {
    return { text: "Hey! I'm AI Maya (offline assistant). I can help with hooks, outlines, captions, posting plans, and pricing. What are we making today?" };
  }
  if (/\b(help|what can you do)\b/.test(q)) {
    return { text: "Things I can do right now, fully offline:\n• 5 hook ideas for any topic\n• 60-second script outline\n• Full script scaffold\n• Platform captions (YouTube/Instagram/LinkedIn)\n• Sponsorship pricing worksheet\n• 7-day posting plan\n\nTip: any script I generate is a draft — edit it in the Script Studio." };
  }
  return {
    text: `Here's how I'd approach "${input.trim()}":\n\n1. Outcome — decide the ONE takeaway the viewer should leave with.\n2. Hook — promise that takeaway in the first 5 seconds.\n3. Body — one idea, one proof, no lists of lists.\n4. CTA — a single ask.\n\nWant hooks or an outline for this? Just ask "give me hooks for this".`,
  };
}

export function disclaimerLine() {
  return "AI Maya · offline assistant · generated drafts always need your review";
}
