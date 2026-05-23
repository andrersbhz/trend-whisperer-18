A conversion-focused blog home page with a modern UX/UI, featuring multi-language support (pt-br, eng, es) and organized categories.

### Features
- **Conversion-Optimized UI**: Modern, clean design using the project's futuristic theme (Glassmorphism, gradients, neon accents).
- **Featured News Banner**: A top-tier slider or grid showing the most accessed articles to capture immediate attention.
- **Categorized Sections**: Content organized by categories (Sports, Politics, etc.) for better user flow.
- **Multi-language Support**: Native i18n implementation with URL structure (`/pt-br`, `/eng`, `/es`) and flag-based switching.
- **SEO & Performance**: Optimized meta tags, semantic HTML, and fast-loading structures for Google ranking.
- **WordPress Content Transfer**: Conceptual strategy to import content via API or direct database migration (preparing the infrastructure).

### Technical Tasks
1. **Routing**: Update `App.tsx` to handle language prefixes using `react-router-dom`.
2. **Components**:
    - `BlogHeader`: New header for the public blog with language switcher (flags).
    - `FeaturedBanner`: Top section with hero articles.
    - `CategorySection`: Modular component to render posts by category.
    - `BlogPostCard`: Beautiful card design for news items.
    - `BlogFooter`: Conversion-focused footer.
3. **Pages**:
    - `BlogHome`: The primary landing page.
    - `BlogArticle`: Template for individual news reading.
4. **i18n Logic**: Setup a simple localization hook or context to manage translations and route detection.
5. **UI/UX**: Refine CSS and use `lucide-react` icons for a premium feel.

### SEO Strategy
- Dynamic titles and meta descriptions per language.
- Use of `hreflang` tags to indicate language variants to Google.
- Structured data (JSON-LD) for articles.

---
**Note**: This will create a separate "Public Blog" experience distinct from the current "Admin Dashboard".
