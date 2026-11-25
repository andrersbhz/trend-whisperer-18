# Architecture rules

- Share image format validation and 9Router image requests under the functions' `_shared` directory; frontend selectors use the same format definitions to avoid dimension drift.
- Manual AI image requests require an explicit per-request format; upload crop preferences must not silently select the generation format.
- When visual references are configured, use a reference-capable image route or extract their visual specification through a 9Router vision model before text-to-image generation; fail clearly rather than ignoring references.