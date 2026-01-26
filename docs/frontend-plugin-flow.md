# Frontend Plugin Integration Flow

## Complete Request-to-Response Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          USER REQUEST                                    │
│                     GET /blog/my-post                                    │
└─────────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                       NEXT.JS MIDDLEWARE                                 │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ 1. Load Enabled Plugins from Database                            │  │
│  │    → SELECT * FROM plugins WHERE enabled = true                  │  │
│  │    → Result: ['core', 'seo', 'analytics', 'comments']            │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      PLUGIN SSR PIPELINE                                 │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ 2. Collect SSR Injections from Each Plugin                       │  │
│  │                                                                   │  │
│  │  SEO Plugin:                                                      │  │
│  │    ├─ Meta tags: <meta name="description" content="...">        │  │
│  │    ├─ Open Graph: <meta property="og:title" content="...">      │  │
│  │    └─ Schema: <script type="ld+json">...</script>               │  │
│  │                                                                   │  │
│  │  Analytics Plugin:                                                │  │
│  │    ├─ Google Analytics: <script src="gtag.js">                  │  │
│  │    └─ Tracking code: gtag('config', 'GA-XXX')                   │  │
│  │                                                                   │  │
│  │  Comments Plugin:                                                 │  │
│  │    └─ Preload data: <link rel="preload" href="/api/comments">   │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      REACT SERVER COMPONENTS                             │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ 3. Render Page with Plugin Slots                                 │  │
│  │                                                                   │  │
│  │  <article>                                                        │  │
│  │    <h1>{post.title}</h1>                                         │  │
│  │                                                                   │  │
│  │    {/* SEO Plugin injects preview here */}                       │  │
│  │    <Slot name="post.header.after" />                            │  │
│  │                                                                   │  │
│  │    <div>{post.content}</div>                                     │  │
│  │                                                                   │  │
│  │    {/* Comments Plugin renders here */}                          │  │
│  │    <Slot name="post.content.after">                             │  │
│  │      → CommentsSection (from comments plugin)                    │  │
│  │      → ShareButtons (from social plugin)                         │  │
│  │      → RelatedPosts (from cms plugin)                            │  │
│  │    </Slot>                                                        │  │
│  │  </article>                                                       │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      HTML TRANSFORMATION                                 │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ 4. Inject Plugin Content into HTML                               │  │
│  │                                                                   │  │
│  │  <!DOCTYPE html>                                                  │  │
│  │  <html>                                                           │  │
│  │    <head>                                                         │  │
│  │      <!-- SEO Plugin -->                                          │  │
│  │      <meta name="description" content="Post description">        │  │
│  │      <meta property="og:title" content="Post Title">            │  │
│  │      <script type="application/ld+json">{...}</script>          │  │
│  │                                                                   │  │
│  │      <!-- Analytics Plugin -->                                    │  │
│  │      <script async src="https://gtag.js"></script>              │  │
│  │      <script>gtag('config', 'GA-XXX')</script>                  │  │
│  │                                                                   │  │
│  │      <!-- Plugin Styles -->                                       │  │
│  │      <link href="/plugins/seo/styles.css" rel="stylesheet">     │  │
│  │      <link href="/plugins/comments/styles.css" rel="stylesheet">│  │
│  │    </head>                                                        │  │
│  │    <body>                                                         │  │
│  │      <!-- Page content with plugin slots filled -->              │  │
│  │      <article>...</article>                                       │  │
│  │                                                                   │  │
│  │      <!-- Client-side plugin scripts -->                          │  │
│  │      <script src="/plugins/comments/frontend.js"></script>       │  │
│  │      <script src="/plugins/analytics/tracking.js"></script>      │  │
│  │    </body>                                                        │  │
│  │  </html>                                                          │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          BROWSER                                         │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ 5. Client-side Plugin Initialization                             │  │
│  │                                                                   │  │
│  │  // Page loads with all plugin features active:                  │  │
│  │  ✓ SEO meta tags already in HTML                                │  │
│  │  ✓ Analytics tracking starts immediately                         │  │
│  │  ✓ Comments section hydrated and interactive                     │  │
│  │  ✓ Share buttons functional                                      │  │
│  │  ✓ Related posts loaded                                          │  │
│  │                                                                   │  │
│  │  // Plugin hydration:                                             │  │
│  │  window.fromcode.plugins.init(['seo', 'analytics', 'comments'])  │  │
│  │                                                                   │  │
│  │  // Plugins listen to events:                                     │  │
│  │  - Page navigation → Analytics tracks                            │  │
│  │  - Comment submission → Updates UI                               │  │
│  │  - Share button click → Social plugin handles                    │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

## Plugin Enable/Disable Flow

```
┌────────────────────────────────────────────────────────────────────┐
│                    ADMIN ENABLES SEO PLUGIN                         │
│              (Clicks "Enable" button in admin panel)                │
└────────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌────────────────────────────────────────────────────────────────────┐
│                    API CALL TO BACKEND                              │
│         POST /api/plugins/seo/enable                                │
└────────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌────────────────────────────────────────────────────────────────────┐
│                    BACKEND PROCESSING                               │
│  1. Update database: plugins.seo.enabled = true                     │
│  2. Run plugin onEnable() hook                                      │
│  3. Run plugin migrations (if any)                                  │
│  4. Register plugin collections                                     │
│  5. Register plugin endpoints                                       │
│  6. Register frontend integration ← NEW!                            │
└────────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌────────────────────────────────────────────────────────────────────┐
│                 FRONTEND REGISTRATION                               │
│                                                                     │
│  frontendRegistry.register({                                        │
│    plugin: 'seo',                                                   │
│    ssr: {                                                           │
│      headInjection: [...],  // Meta tags                           │
│      middleware: [...],      // Request interceptors               │
│    },                                                               │
│    slots: {                                                         │
│      'admin.post.sidebar': './components/SEOPreview',              │
│    },                                                               │
│    clientScripts: [...],     // JS/CSS files                       │
│  })                                                                 │
└────────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌────────────────────────────────────────────────────────────────────┐
│                  BUILD PLUGIN FRONTEND                              │
│  $ fromcode plugin build seo --frontend                             │
│                                                                     │
│  Output:                                                            │
│  └── plugins/seo/dist/frontend/                                     │
│      ├── index.js       (bundled components)                        │
│      ├── styles.css     (bundled styles)                            │
│      └── assets/        (images, fonts)                             │
└────────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌────────────────────────────────────────────────────────────────────┐
│                    IMMEDIATE EFFECT                                 │
│                                                                     │
│  ✓ Next page load includes SEO meta tags                           │
│  ✓ Admin panel shows SEO preview sidebar                           │
│  ✓ Sitemap.xml endpoint is live                                    │
│  ✓ All pages automatically optimized for SEO                       │
│                                                                     │
│  NO REBUILD NEEDED! (in development)                                │
│  Hot reload updates all pages instantly                             │
└────────────────────────────────────────────────────────────────────┘
```

## Component Slot Rendering Flow

```
┌─────────────────────────────────────────────────────────────────┐
│              <Slot name="post.content.after" />                 │
└─────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│              SlotRenderer Component                              │
│  1. Look up slot in registry                                     │
│  2. Find all plugins registered for this slot                    │
│  3. Load components (lazy loaded)                                │
│  4. Render in priority order                                     │
└─────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│              Components Rendered:                                │
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐    │
│  │  CommentsSection (from 'comments' plugin)              │    │
│  │  Priority: 10                                          │    │
│  │  <div className="comments">                            │    │
│  │    <h3>Comments (5)</h3>                               │    │
│  │    {comments.map(c => <Comment {...c} />)}            │    │
│  │  </div>                                                │    │
│  └────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐    │
│  │  ShareButtons (from 'social' plugin)                   │    │
│  │  Priority: 20                                          │    │
│  │  <div className="share-buttons">                       │    │
│  │    <button>Share on Twitter</button>                   │    │
│  │    <button>Share on Facebook</button>                  │    │
│  │  </div>                                                │    │
│  └────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐    │
│  │  RelatedPosts (from 'cms' plugin)                      │    │
│  │  Priority: 30                                          │    │
│  │  <div className="related-posts">                       │    │
│  │    <h3>Related Posts</h3>                              │    │
│  │    {posts.map(p => <PostCard {...p} />)}             │    │
│  │  </div>                                                │    │
│  └────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

## Performance Optimization

```
┌──────────────────────────────────────────────────────────────────┐
│                    PLUGIN LOADING STRATEGY                        │
└──────────────────────────────────────────────────────────────────┘

1. SERVER-SIDE (Build Time)
   ┌────────────────────────────────────────────────────┐
   │ Core plugins bundled into main app                 │
   │ - users, auth, core                                │
   │ ✓ Zero runtime overhead                            │
   │ ✓ Best performance                                 │
   └────────────────────────────────────────────────────┘

2. SERVER-SIDE (Runtime)
   ┌────────────────────────────────────────────────────┐
   │ Plugin SSR injections executed on every request    │
   │ - seo, analytics                                   │
   │ ✓ Dynamic, can be enabled/disabled                 │
   │ ✓ Cached for performance                           │
   │ ⚠ Small overhead (~5-10ms per plugin)             │
   └────────────────────────────────────────────────────┘

3. CLIENT-SIDE (Lazy Load)
   ┌────────────────────────────────────────────────────┐
   │ Plugin components loaded when slot renders         │
   │ - comments, livechat, forms                        │
   │ ✓ Only loads when needed                           │
   │ ✓ Doesn't block initial render                     │
   │ ✓ Automatic code splitting                         │
   └────────────────────────────────────────────────────┘

4. CLIENT-SIDE (Preload)
   ┌────────────────────────────────────────────────────┐
   │ Critical plugins preloaded in <head>               │
   │ - analytics (for immediate tracking)               │
   │ ✓ Ready when page loads                            │
   │ ⚠ Adds to initial bundle size                      │
   └────────────────────────────────────────────────────┘
```

## Key Advantages

### ✅ Automatic Integration
- Enable plugin → Features appear immediately
- No manual code changes needed
- No frontend rebuild required (dev mode)

### ✅ Type Safety
- TypeScript throughout
- IDE autocomplete for slot names
- Compile-time slot validation

### ✅ Performance
- SSR for SEO-critical features
- Lazy loading for interactive components
- Automatic code splitting

### ✅ Developer Experience
- Clear extension points (slots)
- Simple API for plugin authors
- Hot reload in development

### ✅ User Experience
- Seamless integration
- No page reloads needed
- Progressive enhancement

## Example: Adding a New Feature

```typescript
// Scenario: Add live chat to your site

// 1. Install plugin
$ fromcode plugins install @fromcode/livechat

// 2. Enable in admin panel
// (One click in UI)

// 3. DONE! 🎉
// - Chat widget appears on all pages
// - Chat icon in bottom-right corner
// - Admin panel has chat dashboard
// - Analytics tracks chat engagement

// Zero code written!
// Zero config needed!
// Just works! ™️
```
