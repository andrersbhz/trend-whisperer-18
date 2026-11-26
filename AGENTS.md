# Architecture rules

- Share image format validation and 9Router image requests under the functions' `_shared` directory; frontend selectors use the same format definitions to avoid dimension drift.
- Manual AI image requests require an explicit per-request format; upload crop preferences must not silently select the generation format.
- Knowledge-base article creation forwards its explicitly selected image format through the shared image invocation helper and returns image failures as warnings without losing the saved article.
- When visual references are configured, use a reference-capable image route or extract their visual specification through a 9Router vision model before text-to-image generation; fail clearly rather than ignoring references.
- Resolve real-person imagery through the shared news-photo resolver and reuse only explicitly licensed source photographs with attribution; fail closed when identity, date, or reuse rights are unverified to avoid fabricated people and unauthorized copying.
- Article automation and manual requests use a per-user durable queue with independent publication/generation lanes, leased research/text/save/image steps, atomic article progress, bounded dispatch and cooldown-limited chaining; generation pauses must not block publishing existing ready articles.
- Scoped server request budgets preserve manual image behavior while background provider denials, refusals and ambiguous outcomes stop the job without replay; owners see progress and recoverable pauses in Articles.