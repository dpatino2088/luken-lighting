# Deployment Guide

## Pre-Deployment Checklist

Before deploying to production, ensure:

- [ ] All environment variables are configured
- [ ] Database migrations are run
- [ ] Admin user is created
- [ ] Sample data is removed or replaced with real data
- [ ] Product images are uploaded
- [ ] Logo is added
- [ ] Brand colors are customized
- [ ] Contact information is updated
- [ ] SEO metadata is configured

## Deploy to Vercel

### Method 1: Via GitHub Integration (Recommended)

1. **Push to GitHub**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/your-username/luken-lighting.git
   git push -u origin main
   ```

2. **Import to Vercel**
   - Go to [vercel.com](https://vercel.com)
   - Click "New Project"
   - Import your GitHub repository
   - Vercel will auto-detect Next.js

3. **Configure Environment Variables**
   Add these in Vercel project settings:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=xxxxx
   NEXT_PUBLIC_SITE_URL=https://yourdomain.com
   SUPABASE_SERVICE_ROLE_KEY=xxxxx
   ```

   `SUPABASE_SERVICE_ROLE_KEY` is **server-only** (never `NEXT_PUBLIC_`). It is required for
   Admin → Users (list / invite / change role / delete). Get it from Supabase → Project
   Settings → API → `service_role` (secret). Without it, `/admin/users` shows
   “Server not configured”.

4. **Deploy**
   - Click "Deploy"
   - Wait for build to complete
   - Your site is live!

### Method 2: Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy
vercel

# Deploy to production
vercel --prod
```

## Deploy to Other Platforms

### Netlify

1. Create `netlify.toml`:
   ```toml
   [build]
     command = "npm run build"
     publish = ".next"

   [[plugins]]
     package = "@netlify/plugin-nextjs"
   ```

2. Deploy via Netlify CLI or GitHub integration

### Railway

1. Connect GitHub repository
2. Add environment variables
3. Railway will auto-deploy

### Self-Hosted (Docker)

Create `Dockerfile`:
```dockerfile
FROM node:18-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM node:18-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:18-alpine AS runner
WORKDIR /app
ENV NODE_ENV production
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000
CMD ["node", "server.js"]
```

Build and run:
```bash
docker build -t luken-lighting .
docker run -p 3000:3000 luken-lighting
```

## Post-Deployment

### 1. Configure Custom Domain

**Vercel:**
- Project Settings → Domains
- Add your domain
- Update DNS with provided values

**DNS Configuration:**
```
Type: CNAME
Name: @ (or www)
Value: cname.vercel-dns.com
```

### 2. Update Supabase Settings

In Supabase → Authentication → URL Configuration:
- Add production URL to redirect URLs
- Update site URL

### 3. Set Up SSL

- Vercel: Automatic
- Netlify: Automatic
- Others: Use Let's Encrypt

### 4. Configure Analytics

Add to `app/layout.tsx`:
```tsx
// Google Analytics
<Script
  src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXX"
  strategy="afterInteractive"
/>
<Script id="google-analytics" strategy="afterInteractive">
  {`
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', 'G-XXXXXXX');
  `}
</Script>
```

### 5. Set Up Monitoring

**Vercel Analytics:**
- Automatically enabled on Vercel

**Sentry (Error Tracking):**
```bash
npm install @sentry/nextjs
npx @sentry/wizard -i nextjs
```

### 6. Submit to Search Engines

**Google Search Console:**
- Add property
- Verify ownership
- Submit sitemap: `https://yourdomain.com/sitemap.xml`

**Bing Webmaster Tools:**
- Add site
- Submit sitemap

## Performance Optimization

### 1. Image Optimization

- Use Next.js Image component
- Store images in Supabase Storage
- Enable CDN

### 2. Caching Strategy

In `next.config.js`:
```js
module.exports = {
  // ... existing config
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
  // Add cache headers
  async headers() {
    return [
      {
        source: '/images/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },
};
```

### 3. Enable ISR

In product pages, add:
```tsx
export const revalidate = 3600; // Revalidate every hour
```

### 4. Database Optimization

- Ensure indexes are created (already in migrations)
- Monitor query performance in Supabase
- Use connection pooling for high traffic

## Monitoring & Maintenance

### Regular Tasks

**Daily:**
- Check error logs
- Monitor uptime

**Weekly:**
- Review analytics
- Check broken links
- Test admin functions

**Monthly:**
- Update dependencies
- Review security
- Database backup verification

### Performance Monitoring

Check:
- Core Web Vitals
- Lighthouse scores
- Page load times
- Database query performance

### Security

- Keep dependencies updated
- Monitor Supabase logs
- Review RLS policies
- Audit admin access

## Backup Strategy

### Database Backups

Supabase provides:
- Automatic daily backups (Pro plan)
- Point-in-time recovery

Manual backup:
```sql
-- Export via Supabase Dashboard
-- Or use pg_dump
```

### File Backups

- Supabase Storage is replicated
- Consider periodic exports for archives

## Troubleshooting

### Build Failures

Check:
- Node version (use 18+)
- Environment variables are set
- No TypeScript errors: `npm run type-check`

### 500 Errors

- Check server logs
- Verify Supabase connection
- Check RLS policies

### Slow Performance

- Enable caching
- Optimize images
- Review database queries
- Check Supabase performance metrics

## Rollback Procedure

**Vercel:**
1. Go to Deployments
2. Find previous working deployment
3. Click three dots → Promote to Production

**Others:**
```bash
git revert HEAD
git push
```

## Support & Resources

- [Next.js Docs](https://nextjs.org/docs)
- [Vercel Docs](https://vercel.com/docs)
- [Supabase Docs](https://supabase.com/docs)
- [Tailwind CSS Docs](https://tailwindcss.com/docs)

---

**Questions?** Review the README.md and SETUP_GUIDE.md for additional information.

