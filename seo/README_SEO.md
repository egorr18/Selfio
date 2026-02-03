# SEO package (Selfio)

This project includes a complete SEO setup for a bilingual (EN/UK) SaaS landing:

## What’s implemented
- Separate semantic core for EN and UK (see `seo/semantic-core.csv`)
- Keyword mapping (page → primary/secondary keywords) (`seo/keyword-mapping.csv`)
- Internal linking plan with natural anchors (`seo/internal-linking.csv`)
- Technical SEO: canonical + hreflang pairs for every EN/UK page
- `sitemap.xml` and `robots.txt`
- Structured data (Schema.org): Organization + WebSite
- App pages are `noindex,nofollow`, marketing pages are `index,follow`

## Page structure
Marketing (indexable): index / why-selfio / solutions / community / pricing  
Product (noindex): signin / app / weekly / habits / account / choose-plan / my-plan / settings

## Notes
This is designed as a production-like SEO foundation for a small SaaS on GitHub Pages.
