# Changelog

All notable changes to the Fromcode framework, one section per release, newest first.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/). Every section is built from
the commits between two release tags (`npm run changelog:write`), and the build fails a release whose
version has no section (`npm run check:changelog`). To say more about a change, say it in the PR title.

## [0.2.318] - 2026-10-03

### Fixed

- **frontend**: retire a site's old render world before trimming to the cap ([#714](https://github.com/fromcode119/framework/pull/714))
- **core**: a plugin update swaps its directory in whole ([#713](https://github.com/fromcode119/framework/pull/713))
- **admin**: Bulgarian console text uses standard Cyrillic letterforms ([#711](https://github.com/fromcode119/framework/pull/711))

### Performance

- datasource prefetch asks for cards and the block's filters; media hydrates in one lookup ([#710](https://github.com/fromcode119/framework/pull/710))

## [0.2.317] - 2026-10-03

### Fixed

- **frontend**: retire the render world a site leaves after an update ([#708](https://github.com/fromcode119/framework/pull/708))

## [0.2.316] - 2026-10-03

### Fixed

- **plugins**: an approval to reach any host covers a plugin that narrows to named hosts ([#706](https://github.com/fromcode119/framework/pull/706))

## [0.2.315] - 2026-10-03

### Added

- **plugins**: approving a plugin means seeing what it can do, and it runs with only that ([#703](https://github.com/fromcode119/framework/pull/703))

## [0.2.314] - 2026-10-03

### Added

- **api**: a collection read rule can compare, not only match ([#701](https://github.com/fromcode119/framework/pull/701))

## [0.2.313] - 2026-10-03

### Fixed

- **plugins**: the upload dialogs say what an install would replace ([#694](https://github.com/fromcode119/framework/pull/694))
- **themes**: a theme's runtime modules never reach the console and never replace the platform's ([#699](https://github.com/fromcode119/framework/pull/699))

## [0.2.312] - 2026-10-03

### Fixed

- **core**: a hot plugin update creates the default pages it requires ([#697](https://github.com/fromcode119/framework/pull/697))
- **admin**: plugin settings tabs wrap instead of running out of reach ([#696](https://github.com/fromcode119/framework/pull/696))

## [0.2.311] - 2026-10-03

### Fixed

- **api**: harden the generic collection reads ([#692](https://github.com/fromcode119/framework/pull/692))

## [0.2.310] - 2026-10-03

### Fixed

- **core**: a plugin updated in place refreshes its field definitions ([#690](https://github.com/fromcode119/framework/pull/690))

## [0.2.309] - 2026-10-03

### Fixed

- **core**: the related-records panel's title and empty hint are translated ([#689](https://github.com/fromcode119/framework/pull/689))

## [0.2.308] - 2026-10-03

### Fixed

- **api**: plugins offered to a site are named in the console's language ([#687](https://github.com/fromcode119/framework/pull/687))
- **core**: a select option declared with an Enum member stores its string ([#686](https://github.com/fromcode119/framework/pull/686))
- **admin**: framework fields, role names and the records panel read in the console's language ([#685](https://github.com/fromcode119/framework/pull/685))

## [0.2.307] - 2026-10-02

### Fixed

- **react**: a site theme's stylesheet no longer restyles the admin ([#678](https://github.com/fromcode119/framework/pull/678))

### Performance

- **database**: prepare repeated reads once per connection; keep idle connections ([#682](https://github.com/fromcode119/framework/pull/682))
- **api**: route a plugin request straight to its own plugin's routes ([#680](https://github.com/fromcode119/framework/pull/680))

## [0.2.306] - 2026-10-02

### Fixed

- **admin**: the theme state badge reads in the console's language ([#681](https://github.com/fromcode119/framework/pull/681))

## [0.2.305] - 2026-10-02

### Fixed

- **admin**: a theme layout's name and description may be given per language ([#676](https://github.com/fromcode119/framework/pull/676))
- **versions**: history entries the framework writes read in the console's language ([#675](https://github.com/fromcode119/framework/pull/675))

## [0.2.304] - 2026-10-02

### Fixed

- **core**: a field one plugin adds to another's collection is translated by the plugin that added it ([#673](https://github.com/fromcode119/framework/pull/673))
- **react**: a late translation answer for another locale no longer wins ([#672](https://github.com/fromcode119/framework/pull/672))
- **sources**: the Add Source form says why a repository could not be read ([#671](https://github.com/fromcode119/framework/pull/671))

## [0.2.303] - 2026-10-02

### Fixed

- **plugins**: a package from another vendor cannot install over a plugin with the same slug ([#669](https://github.com/fromcode119/framework/pull/669))

## [0.2.302] - 2026-10-02

### Fixed

- **core**: judge a plugin's table access by the table the call reaches ([#667](https://github.com/fromcode119/framework/pull/667))
- **api**: a console request speaks the reader's console language ([#666](https://github.com/fromcode119/framework/pull/666))

### Performance

- **core**: hand an isolated plugin's query rows over as the JSON Postgres writes ([#665](https://github.com/fromcode119/framework/pull/665))

## [0.2.301] - 2026-10-02

### Fixed

- **default-pages**: title a created page in the site's language ([#662](https://github.com/fromcode119/framework/pull/662))

## [0.2.300] - 2026-10-02

### Fixed

- **deploy**: additive core migrations no longer force a restart deploy ([#660](https://github.com/fromcode119/framework/pull/660))

### Performance

- **core**: cut per-request work on isolated plugin routes; refuse SQL in limit/offset ([#661](https://github.com/fromcode119/framework/pull/661))

## [0.2.299] - 2026-10-01

### Added

- **storefront**: a one-time notice a redirect hands the storefront ([#657](https://github.com/fromcode119/framework/pull/657))

## [0.2.298] - 2026-10-01

### Added

- **notifications**: web push, texts through provider plugins, and the console's own notifications ([#645](https://github.com/fromcode119/framework/pull/645))

## [0.2.297] - 2026-10-01

### Performance

- **api**: /system/frontend keeps each site's parts per content revision ([#653](https://github.com/fromcode119/framework/pull/653))

## [0.2.296] - 2026-10-01

### Fixed

- **frontend**: releasing an unread response never waits on its cancel ([#654](https://github.com/fromcode119/framework/pull/654))

## [0.2.295] - 2026-10-01

### Added

- **infrastructure**: the api's database connection limit is a setting, and the pool warns only on real shortages ([#651](https://github.com/fromcode119/framework/pull/651))

### Fixed

- **frontend**: every server-side fetch releases a response it does not read ([#649](https://github.com/fromcode119/framework/pull/649))

## [0.2.294] - 2026-10-01

### Fixed

- **monitoring**: probe a couple of sites at a time ([#647](https://github.com/fromcode119/framework/pull/647))

## [0.2.293] - 2026-10-01

### Fixed

- **database**: a nested scope gives back the outer scope's connection before taking its own ([#646](https://github.com/fromcode119/framework/pull/646))

### Performance

- **database**: typed-table writes assembled by our own query layer ([#636](https://github.com/fromcode119/framework/pull/636))

## [0.2.292] - 2026-10-01

### Added

- **realtime**: live events to a room a plugin admitted a browser to ([#640](https://github.com/fromcode119/framework/pull/640))

### Fixed

- **frontend**: storefront api calls release what they skip, and a slow call says why ([#642](https://github.com/fromcode119/framework/pull/642))

### Performance

- **database**: whole-table reads assembled by our own query layer ([#632](https://github.com/fromcode119/framework/pull/632))

## [0.2.291] - 2026-10-01

### Added

- **email**: plugins can read a mailbox — context.email.inbox ([#633](https://github.com/fromcode119/framework/pull/633))

### Fixed

- **deploy**: the frontend warm-up keeps Next's own hostname (re-lands #629) ([#637](https://github.com/fromcode119/framework/pull/637))

### Reverted

- a new frontend warms every site before it takes visitors (#629) ([#635](https://github.com/fromcode119/framework/pull/635))

## [0.2.290] - 2026-10-01

### Added

- **core**: a site's plugin can no longer reach into its own site ([#630](https://github.com/fromcode119/framework/pull/630))

### Fixed

- **deploy**: a new frontend warms every site before it takes visitors ([#629](https://github.com/fromcode119/framework/pull/629))

## [0.2.289] - 2026-10-01

### Performance

- **api**: cheaper collection reads — no whole-settings read per request, outgoing fields worked out once ([#621](https://github.com/fromcode119/framework/pull/621))

## [0.2.288] - 2026-10-01

### Fixed

- **monitoring**: say when email alerts are only logged ([#626](https://github.com/fromcode119/framework/pull/626))
- **monitoring**: UptimeRobot monitors carry the operator's answer timeout ([#624](https://github.com/fromcode119/framework/pull/624))

## [0.2.287] - 2026-10-01

### Fixed

- **monitoring**: UptimeRobot creates monitors through its v3 API ([#622](https://github.com/fromcode119/framework/pull/622))

## [0.2.286] - 2026-10-01

### Fixed

- **monitoring**: UptimeRobot monitors on the free plan; say when nothing delivers alerts ([#617](https://github.com/fromcode119/framework/pull/617))

## [0.2.285] - 2026-10-01

### Fixed

- **frontend**: default sign-up, verification and password pages are styled ([#616](https://github.com/fromcode119/framework/pull/616))
- **api**: storefront reads the sign-in switches the way the api applies them ([#615](https://github.com/fromcode119/framework/pull/615))

## [0.2.284] - 2026-10-01

### Fixed

- **api**: integrations save in platform scope ([#613](https://github.com/fromcode119/framework/pull/613))

## [0.2.283] - 2026-10-01

### Added

- **plugins**: context.memo — answers a plugin keeps per site until the site changes ([#601](https://github.com/fromcode119/framework/pull/601))
- **api**: run the api as several processes sharing one set of plugin processes ([#611](https://github.com/fromcode119/framework/pull/611))

### Fixed

- **admin**: list row actions honour disableCreate and disableEdit ([#609](https://github.com/fromcode119/framework/pull/609))
- **frontend**: default sign-up, verification and password pages send the CSRF token ([#607](https://github.com/fromcode119/framework/pull/607))

## [0.2.282] - 2026-10-01

### Fixed

- **core**: no error for an integration nobody set up; no boot wait for a missing sandbox; refuse out-of-range limits ([#605](https://github.com/fromcode119/framework/pull/605))
- **email**: the site's email logo stays readable in a dark-mode inbox ([#603](https://github.com/fromcode119/framework/pull/603))

## [0.2.281] - 2026-10-01

### Fixed

- **admin**: a platform-only integration link opened in a site says where it lives ([#604](https://github.com/fromcode119/framework/pull/604))

## [0.2.280] - 2026-10-01

### Performance

- **core**: less per-call work in the api's hot paths ([#597](https://github.com/fromcode119/framework/pull/597))
- **plugin-host**: a plugin keeps its settings reads per site and revision ([#596](https://github.com/fromcode119/framework/pull/596))

## [0.2.279] - 2026-10-01

### Added

- **monitoring**: an api error alert names the routes that failed ([#599](https://github.com/fromcode119/framework/pull/599))

### Fixed

- **deploy**: the api owns plugins/tenants, where sites' uploads go ([#598](https://github.com/fromcode119/framework/pull/598))

## [0.2.278] - 2026-10-01

### Added

- **core**: run plugins sites upload in a sandbox of their own ([#593](https://github.com/fromcode119/framework/pull/593))

### Fixed

- **react**: the storefront config no longer replaces the admin's collections ([#592](https://github.com/fromcode119/framework/pull/592))

## [0.2.277] - 2026-10-01

### Added

- **monitoring**: the platform watches itself, and outside services can watch it too ([#590](https://github.com/fromcode119/framework/pull/590))

## [0.2.276] - 2026-10-01

### Added

- **core**: hold site plugins to a disk and a process limit ([#588](https://github.com/fromcode119/framework/pull/588))

## [0.2.275] - 2026-10-01

### Fixed

- **plugin-host**: a newer plugin process's route declaration takes effect ([#586](https://github.com/fromcode119/framework/pull/586))
- **plugin-host**: keep each site's peer snapshot apart in the guest ([#585](https://github.com/fromcode119/framework/pull/585))

## [0.2.274] - 2026-10-01

### Fixed

- **plugins**: context.email is typed as what it really is ([#579](https://github.com/fromcode119/framework/pull/579))
- **auth**: a logout that cannot revoke its session is logged, not swallowed ([#583](https://github.com/fromcode119/framework/pull/583))

### Performance

- **plugins**: anonymous response cache, path-scoped plugin middleware, less per-request work ([#578](https://github.com/fromcode119/framework/pull/578))

## [0.2.273] - 2026-10-01

### Fixed

- **deps**: upgrade packages with known critical and high vulnerabilities ([#575](https://github.com/fromcode119/framework/pull/575))
- **security**: send the security headers the api and storefront were missing ([#580](https://github.com/fromcode119/framework/pull/580))
- **api**: an origin CORS refuses gets no allow headers, not a 500 ([#577](https://github.com/fromcode119/framework/pull/577))

## [0.2.272] - 2026-09-30

### Added

- **core**: hold site plugins to a share of the machine; context.fetch reaches only the public internet ([#576](https://github.com/fromcode119/framework/pull/576))

## [0.2.271] - 2026-09-30

### Added

- **api**: once-only boot and background work across api workers ([#573](https://github.com/fromcode119/framework/pull/573))
- **api**: one rate limit across every api worker ([#572](https://github.com/fromcode119/framework/pull/572))
- **core**: tell every api process when a cached copy is stale ([#569](https://github.com/fromcode119/framework/pull/569))

## [0.2.270] - 2026-09-30

### Fixed

- **auth**: social sign-in joins a site only where its registration is open ([#571](https://github.com/fromcode119/framework/pull/571))
- **admin**: a many-file media field keeps every file, and each can be removed ([#550](https://github.com/fromcode119/framework/pull/550))
- **pages**: a default page's owner values are read during its own activation ([#553](https://github.com/fromcode119/framework/pull/553))

## [0.2.269] - 2026-09-30

### Added

- **auth**: social sign-in with Google, Microsoft, GitHub and OpenID ([#565](https://github.com/fromcode119/framework/pull/565))

### Fixed

- **cli**: theme pack runs the real pack pipeline ([#566](https://github.com/fromcode119/framework/pull/566))

## [0.2.268] - 2026-09-30

### Added

- **sources**: build only commits GitHub merged ([#562](https://github.com/fromcode119/framework/pull/562))

### Performance

- **database**: remember converted column names ([#563](https://github.com/fromcode119/framework/pull/563))

## [0.2.267] - 2026-09-30

### Fixed

- **plugins**: the schema proxy exposes no raw SQL on the owner connection ([#560](https://github.com/fromcode119/framework/pull/560))

## [0.2.266] - 2026-09-30

### Performance

- **plugins**: read an isolated plugin's settings once per invocation ([#558](https://github.com/fromcode119/framework/pull/558))
- **plugins**: reuse one site-bound connection per isolated plugin invocation ([#556](https://github.com/fromcode119/framework/pull/556))

## [0.2.265] - 2026-09-30

### Fixed

- **security**: run every plugin isolated, and give the admin a script CSP ([#554](https://github.com/fromcode119/framework/pull/554))

## [0.2.264] - 2026-09-30

### Fixed

- **plugins**: plugin migrations run on the plugin's schema proxy, not the owner connection ([#552](https://github.com/fromcode119/framework/pull/552))

## [0.2.263] - 2026-09-30

### Added

- **plugins**: named schema repairs for plugin migrations ([#549](https://github.com/fromcode119/framework/pull/549))

### Performance

- **database**: stop asking the catalog before every Postgres read ([#548](https://github.com/fromcode119/framework/pull/548))

## [0.2.262] - 2026-09-30

### Fixed

- **frontend**: apply plugin content transformers in the server render ([#544](https://github.com/fromcode119/framework/pull/544))

### Performance

- **api**: remove the request-path costs a load test found ([#538](https://github.com/fromcode119/framework/pull/538))

## [0.2.261] - 2026-09-30

### Added

- **pages**: a plugin's default page can be switched on per site by one of its settings ([#542](https://github.com/fromcode119/framework/pull/542))

### Fixed

- **react**: the @fromcode119/react runtime module declares each export once ([#539](https://github.com/fromcode119/framework/pull/539))
- **admin**: a structured field's key names are translated like the rest of the field ([#536](https://github.com/fromcode119/framework/pull/536))
- **dev**: the dev containers mount the storefront's i18n and the admin's public folder ([#535](https://github.com/fromcode119/framework/pull/535))
- **security**: contain site-uploaded and platform extensions ([#541](https://github.com/fromcode119/framework/pull/541))
- **plugins**: an update to a plugin in error replaces its process ([#543](https://github.com/fromcode119/framework/pull/543))

## [0.2.260] - 2026-09-30

### Fixed

- **tenancy**: harden site isolation — site roles, shared accounts, verified tenant binding ([#537](https://github.com/fromcode119/framework/pull/537))

## [0.2.259] - 2026-09-30

### Fixed

- **admin**: preferences saved in the platform scope persist ([#532](https://github.com/fromcode119/framework/pull/532))

## [0.2.258] - 2026-09-30

### Fixed

- **sites**: the first site takes effect by itself, and moving a site keeps its files ([#530](https://github.com/fromcode119/framework/pull/530))

## [0.2.257] - 2026-09-30

### Added

- **admin**: Infrastructure shows the IP-location switch, the installed database and its credit ([#528](https://github.com/fromcode119/framework/pull/528))
- **geo**: an IP-location database the operator switches on, and context.geo for plugins ([#527](https://github.com/fromcode119/framework/pull/527))
- **database**: aggregate — distinct counts, sums, averages and time buckets in SQL ([#526](https://github.com/fromcode119/framework/pull/526))

### Fixed

- **plugins**: a plugin gets the visitor address from the platform, and no client-written private header ([#525](https://github.com/fromcode119/framework/pull/525))

## [0.2.256] - 2026-09-30

### Fixed

- **admin**: drag dashboard widgets with the pointer — anywhere on the widget, mouse or touch ([#522](https://github.com/fromcode119/framework/pull/522))

## [0.2.255] - 2026-09-29

### Fixed

- **admin**: media and people say a site is needed instead of failing with no site ([#520](https://github.com/fromcode119/framework/pull/520))

## [0.2.254] - 2026-09-29

### Added

- **sdk**: DashboardWidgetCard for plugin dashboard widgets ([#518](https://github.com/fromcode119/framework/pull/518))

## [0.2.253] - 2026-09-29

### Added

- **admin**: a dashboard each person arranges, with widgets plugins declare ([#516](https://github.com/fromcode119/framework/pull/516))

## [0.2.252] - 2026-09-29

### Fixed

- **admin**: tidy the account menu and the media grid tiles ([#514](https://github.com/fromcode119/framework/pull/514))

## [0.2.251] - 2026-09-29

### Added

- **admin**: drop the top header; its controls live in the account menu ([#512](https://github.com/fromcode119/framework/pull/512))
- **core**: archive and restore records of any collection ([#510](https://github.com/fromcode119/framework/pull/510))

## [0.2.250] - 2026-09-29

### Fixed

- **frontend**: storefront pages hydrate cleanly and speak the site's language ([#489](https://github.com/fromcode119/framework/pull/489))

## [0.2.249] - 2026-09-29

### Added

- **core**: default page content names the site it is created for ([#508](https://github.com/fromcode119/framework/pull/508))

## [0.2.248] - 2026-09-29

### Added

- **admin**: the console speaks each reader's own language ([#506](https://github.com/fromcode119/framework/pull/506))

## [0.2.247] - 2026-09-29

### Fixed

- **email**: a theme logo picked as the email logo reaches the emails ([#503](https://github.com/fromcode119/framework/pull/503))
- **admin**: General settings saves only what changed ([#504](https://github.com/fromcode119/framework/pull/504))

## [0.2.246] - 2026-09-29

### Added

- **email**: one email logo per site, on every email it sends ([#501](https://github.com/fromcode119/framework/pull/501))

## [0.2.245] - 2026-09-28

### Added

- **admin**: the whole console in the chosen language ([#487](https://github.com/fromcode119/framework/pull/487))

### Fixed

- **admin**: a picked media field previews a site's file on the site's host ([#499](https://github.com/fromcode119/framework/pull/499))

## [0.2.244] - 2026-09-28

### Fixed

- **frontend**: a site without its own favicon gets the framework mark, not an empty 204 ([#497](https://github.com/fromcode119/framework/pull/497))

## [0.2.243] - 2026-09-28

### Added

- **release**: CHANGELOG.md rebuilt from the release history, and kept current ([#495](https://github.com/fromcode119/framework/pull/495))

### Fixed

- **admin**: the Security screen saves only what the operator changed ([#494](https://github.com/fromcode119/framework/pull/494))

## [0.2.242] - 2026-09-28

### Added

- **storefront**: hide email addresses and phone numbers from harvesters ([#492](https://github.com/fromcode119/framework/pull/492))

## [0.2.241] - 2026-09-28

### Fixed

- **frontend**: give themed native routes their page's head ([#488](https://github.com/fromcode119/framework/pull/488))
- **certificates**: show what happens after a token save or host switch ([#486](https://github.com/fromcode119/framework/pull/486))

## [0.2.240] - 2026-09-28

### Fixed

- **plugins**: decrypt secret settings on read; export TokenEmailPreferencesPanel to plugin bundles ([#472](https://github.com/fromcode119/framework/pull/472))

## [0.2.239] - 2026-09-28

### Fixed

- **admin**: a user without user management can open and edit their own account ([#483](https://github.com/fromcode119/framework/pull/483))

## [0.2.238] - 2026-09-28

### Fixed

- **plugins**: settings hooks of an isolated plugin no longer 500, and a refused save says why ([#480](https://github.com/fromcode119/framework/pull/480))

## [0.2.237] - 2026-09-28

### Fixed

- **admin**: plugin actions on a collection screen follow the plugin's permission ([#479](https://github.com/fromcode119/framework/pull/479))

## [0.2.236] - 2026-09-28

### Fixed

- **admin**: a site's person opened with no site selected says where it lives ([#477](https://github.com/fromcode119/framework/pull/477))

## [0.2.235] - 2026-09-28

### Added

- **roles**: per-collection permissions a role editor can actually grant ([#475](https://github.com/fromcode119/framework/pull/475))

## [0.2.234] - 2026-09-28

### Fixed

- **admin**: deleting a person asks in the admin's confirmation dialog ([#473](https://github.com/fromcode119/framework/pull/473))
- **arch-guard**: the peer-surface guard checks every class a publicAPI map draws on ([#471](https://github.com/fromcode119/framework/pull/471))

## [0.2.233] - 2026-09-28

### Fixed

- **sources**: build appearances instead of copying their source ([#469](https://github.com/fromcode119/framework/pull/469))

## [0.2.232] - 2026-09-28

### Fixed

- **core**: tenant-import upserts _system_meta so a site owns its own settings ([#467](https://github.com/fromcode119/framework/pull/467))
- **plugins**: a site's own plugin reaches only an allowlisted runtime surface ([#466](https://github.com/fromcode119/framework/pull/466))

## [0.2.231] - 2026-09-28

### Fixed

- **deploy**: plugin processes cannot read platform secrets ([#464](https://github.com/fromcode119/framework/pull/464))

## [0.2.230] - 2026-09-27

### Added

- **auth**: a read-only inspector role ([#462](https://github.com/fromcode119/framework/pull/462))

## [0.2.229] - 2026-09-27

### Fixed

- **deploy**: plugin processes can read the site's uploads and theme assets again ([#460](https://github.com/fromcode119/framework/pull/460))

## [0.2.228] - 2026-09-27

### Fixed

- **api**: the console never reuses another site's frontend metadata ([#458](https://github.com/fromcode119/framework/pull/458))
- **sdk**: a theme's @fromcode119/sdk/admin imports resolve in the admin ([#457](https://github.com/fromcode119/framework/pull/457))
- **admin**: a switch's label toggles it, and its className applies ([#456](https://github.com/fromcode119/framework/pull/456))

## [0.2.227] - 2026-09-27

### Fixed

- **admin**: a refused save says why in the save bar ([#454](https://github.com/fromcode119/framework/pull/454))
- **arch-guard**: block-field-conformance reads renderers the way they are written ([#453](https://github.com/fromcode119/framework/pull/453))
- **admin**: the records hub follows the admin's dark mode ([#452](https://github.com/fromcode119/framework/pull/452))
- **admin**: fact grids collapse to one column in narrow containers ([#449](https://github.com/fromcode119/framework/pull/449))

## [0.2.226] - 2026-09-27

### Added

- **api**: a record guard hook, and bulk deletes fire beforeDelete ([#446](https://github.com/fromcode119/framework/pull/446))

## [0.2.225] - 2026-09-27

### Added

- **plugins**: a site may upload plugins of its own, isolated and bounded ([#444](https://github.com/fromcode119/framework/pull/444))

## [0.2.224] - 2026-09-27

### Added

- **admin**: built-in HtmlEditor field with sandboxed live preview ([#441](https://github.com/fromcode119/framework/pull/441))

### Fixed

- **settings**: the site theme upload limits are visible and editable ([#440](https://github.com/fromcode119/framework/pull/440))
- no deployment-specific values in the framework ([#439](https://github.com/fromcode119/framework/pull/439))
- **arch-guard**: a contract beside a class fails the build, exported or not ([#442](https://github.com/fromcode119/framework/pull/442))

## [0.2.223] - 2026-09-27

### Added

- **plugins**: the platform offers plugins to sites; a site switches them on for itself ([#436](https://github.com/fromcode119/framework/pull/436))

### Fixed

- **marketplace**: extension kinds and offer origin come from enums, never guessed ([#437](https://github.com/fromcode119/framework/pull/437))

## [0.2.222] - 2026-09-27

### Added

- **themes**: a site adds a marketplace theme to itself ([#434](https://github.com/fromcode119/framework/pull/434))
- **admin**: PersonField — pick a person from People; People search finds everyone ([#433](https://github.com/fromcode119/framework/pull/433))

## [0.2.221] - 2026-09-27

### Fixed

- **themes**: a site's own themes are its own, and a site can upload one ([#431](https://github.com/fromcode119/framework/pull/431))

## [0.2.220] - 2026-09-27

### Added

- **admin**: menu items can require a permission; site-scoped role edits for plugins ([#428](https://github.com/fromcode119/framework/pull/428))

## [0.2.219] - 2026-09-27

### Added

- **plugins**: replace the extension-host without a gap ([#426](https://github.com/fromcode119/framework/pull/426))

### Fixed

- **admin**: a plugin's raw definition is the platform's, and its dialog covers the page ([#427](https://github.com/fromcode119/framework/pull/427))
- **storefront**: a plugin install no longer restarts the frontend ([#425](https://github.com/fromcode119/framework/pull/425))

## [0.2.218] - 2026-09-27

### Fixed

- **plugins**: a plugin process reads theme overrides through the host ([#423](https://github.com/fromcode119/framework/pull/423))

## [0.2.217] - 2026-09-27

### Fixed

- **plugins**: a relaunched plugin runs its per-site data work ([#421](https://github.com/fromcode119/framework/pull/421))
- **plugins**: installing a plugin no longer freezes the api ([#419](https://github.com/fromcode119/framework/pull/419))

## [0.2.216] - 2026-09-27

### Fixed

- **core**: plugin templates use the site's theme, not the platform's ([#418](https://github.com/fromcode119/framework/pull/418))

## [0.2.215] - 2026-09-27

### Fixed

- **sources**: one build per source at a time ([#416](https://github.com/fromcode119/framework/pull/416))
- **local**: plugin code loads this checkout's built packages ([#415](https://github.com/fromcode119/framework/pull/415))

## [0.2.214] - 2026-09-27

### Fixed

- **local**: the local stack runs its own extension-host ([#413](https://github.com/fromcode119/framework/pull/413))
- **plugins**: a paused plugin is not asked about plugins:ready ([#411](https://github.com/fromcode119/framework/pull/411))

## [0.2.213] - 2026-09-27

### Added

- **emails**: framework emails from data, per site theme, in the site's language ([#409](https://github.com/fromcode119/framework/pull/409))
- **core**: plugins read the current site's theme variables ([#406](https://github.com/fromcode119/framework/pull/406))

### Fixed

- **deploy**: use every compose file the box declares ([#410](https://github.com/fromcode119/framework/pull/410))

## [0.2.212] - 2026-09-27

### Fixed

- **deploy**: a gateway's redirect to https counts as up ([#407](https://github.com/fromcode119/framework/pull/407))

## [0.2.211] - 2026-09-27

### Fixed

- **deploy**: see the edge, and require the platform to answer publicly ([#404](https://github.com/fromcode119/framework/pull/404))

## [0.2.210] - 2026-09-27

### Added

- **gateway**: replace the gateway without dropping a request ([#402](https://github.com/fromcode119/framework/pull/402))

## [0.2.209] - 2026-09-27

### Fixed

- **plugins**: a replaced plugin process leaves no middleware behind ([#400](https://github.com/fromcode119/framework/pull/400))

## [0.2.208] - 2026-09-27

### Added

- **plugins**: collection hooks can ask who is acting ([#393](https://github.com/fromcode119/framework/pull/393))

### Fixed

- **admin**: the deploy mode says what happens to the extension-host ([#399](https://github.com/fromcode119/framework/pull/399))
- **admin**: inside a site, the plugins area offers only the site's own part ([#398](https://github.com/fromcode119/framework/pull/398))
- **admin,api**: the Process card tells the truth about extension-host; page lookups skip unreadable collections ([#396](https://github.com/fromcode119/framework/pull/396))
- **plugins**: an older extension-host does not stop plugins from starting ([#395](https://github.com/fromcode119/framework/pull/395))

## [0.2.207] - 2026-09-26

### Added

- **plugins**: a new api takes over running plugin processes ([#392](https://github.com/fromcode119/framework/pull/392))
- **plugins**: record what a plugin declares to the api ([#391](https://github.com/fromcode119/framework/pull/391))

## [0.2.206] - 2026-09-26

### Added

- **plugins**: start plugin processes in an optional extension-host container ([#389](https://github.com/fromcode119/framework/pull/389))
- **deploy**: a deploy brings the box's compose files to the release's ([#388](https://github.com/fromcode119/framework/pull/388))

## [0.2.205] - 2026-09-26

### Added

- **plugins**: version handshake, and a plugin process that accepts a second api ([#385](https://github.com/fromcode119/framework/pull/385))

## [0.2.204] - 2026-09-26

### Fixed

- **frontend**: plugin-declared root files (.txt/.xml) are actually served ([#384](https://github.com/fromcode119/framework/pull/384))

## [0.2.203] - 2026-09-26

### Added

- **plugins**: replace a plugin's process without a gap ([#382](https://github.com/fromcode119/framework/pull/382))

### Fixed

- **plugins**: saving a plugin's memory and timeout limits works again ([#381](https://github.com/fromcode119/framework/pull/381))

## [0.2.202] - 2026-09-26

### Fixed

- **email**: the SMTP sender survives the provider's second normalize ([#379](https://github.com/fromcode119/framework/pull/379))

## [0.2.201] - 2026-09-26

### Fixed

- **core**: keep an external image URL at the root of its host ([#377](https://github.com/fromcode119/framework/pull/377))

## [0.2.200] - 2026-09-26

### Fixed

- **core**: refuse the platform mail fallback when the platform only has the mock ([#370](https://github.com/fromcode119/framework/pull/370))
- **email**: plugin mail is sent from the configured From Address ([#371](https://github.com/fromcode119/framework/pull/371))

## [0.2.199] - 2026-09-26

### Added

- **plugins**: each plugin process records what it registered; the admin shows its process ([#374](https://github.com/fromcode119/framework/pull/374))

### Fixed

- **plugins**: isolated plugins' middleware runs, and survives a restart ([#373](https://github.com/fromcode119/framework/pull/373))

## [0.2.198] - 2026-09-26

### Added

- **deploy**: rolling deploys without the 45 s outage, chosen in the admin ([#367](https://github.com/fromcode119/framework/pull/367))

### Fixed

- **core**: seed a new site with only the plugins it runs ([#364](https://github.com/fromcode119/framework/pull/364))

### Performance

- **sdk**: a plugin process no longer loads the whole api ([#369](https://github.com/fromcode119/framework/pull/369))

## [0.2.197] - 2026-09-26

### Fixed

- **admin**: the permalink box and a theme's Open Site name the site's own address ([#366](https://github.com/fromcode119/framework/pull/366))

## [0.2.196] - 2026-09-26

### Fixed

- **admin**: open Preview on the site's own storefront, not the console ([#361](https://github.com/fromcode119/framework/pull/361))

## [0.2.195] - 2026-09-26

### Performance

- **plugins**: a plugin process no longer loads drizzle, the database package or node-cron at boot ([#362](https://github.com/fromcode119/framework/pull/362))

## [0.2.194] - 2026-09-26

### Performance

- **runtime**: serve the lucide-react namespace module as a static asset ([#359](https://github.com/fromcode119/framework/pull/359))

## [0.2.193] - 2026-09-26

### Performance

- **frontend**: hydrate the storefront as a transition ([#357](https://github.com/fromcode119/framework/pull/357))

## [0.2.192] - 2026-09-26

### Performance

- **frontend**: inline the layout stylesheet in the storefront document ([#355](https://github.com/fromcode119/framework/pull/355))

## [0.2.191] - 2026-09-26

### Fixed

- **api**: room for one process per plugin ([#352](https://github.com/fromcode119/framework/pull/352))
- **frontend**: a tap made before the storefront runtime boots is not lost ([#349](https://github.com/fromcode119/framework/pull/349))

### Performance

- **frontend**: anonymous visitors get the rendered page from a cache ([#353](https://github.com/fromcode119/framework/pull/353))

## [0.2.190] - 2026-09-25

### Fixed

- **frontend**: the islands document loads every plugin bundle again ([#350](https://github.com/fromcode119/framework/pull/350))

## [0.2.189] - 2026-09-25

### Performance

- **frontend**: every storefront serves the islands document ([#347](https://github.com/fromcode119/framework/pull/347))

## [0.2.188] - 2026-09-25

### Fixed

- **frontend**: inlined theme css keeps its fonts when the api URL has no origin ([#343](https://github.com/fromcode119/framework/pull/343))
- **admin**: stop the site form promising that an "api." alias becomes the api ([#345](https://github.com/fromcode119/framework/pull/345))
- **people**: the admin can give a person an email ([#333](https://github.com/fromcode119/framework/pull/333))

## [0.2.187] - 2026-09-25

### Fixed

- **admin**: give "What each host serves" its own row on the site overview ([#338](https://github.com/fromcode119/framework/pull/338))

## [0.2.186] - 2026-09-25

### Fixed

- admin writes take effect without an api restart ([#336](https://github.com/fromcode119/framework/pull/336))

## [0.2.185] - 2026-09-25

### Fixed

- **tenancy**: a site's address takes its scheme from any app the deployment declares ([#339](https://github.com/fromcode119/framework/pull/339))
- **admin**: the edit header offers no status a field declares read-only ([#337](https://github.com/fromcode119/framework/pull/337))
- **api**: a cookie is set on the request's own domain, never on a public suffix ([#332](https://github.com/fromcode119/framework/pull/332))

## [0.2.184] - 2026-09-25

### Fixed

- **integrations**: a site's saved mail settings take effect without a restart ([#334](https://github.com/fromcode119/framework/pull/334))

### Performance

- **arch-guard**: stop repeating framework-only work in every extension's guard run ([#331](https://github.com/fromcode119/framework/pull/331))

## [0.2.183] - 2026-09-25

### Fixed

- **schema**: drop the NOT NULL of a plugin column nothing declares ([#326](https://github.com/fromcode119/framework/pull/326))
- **admin**: a source that cannot be saved says why, inside its dialog ([#327](https://github.com/fromcode119/framework/pull/327))

## [0.2.182] - 2026-09-25

### Fixed

- **plugins**: a plugin updated in place gets its new columns ([#323](https://github.com/fromcode119/framework/pull/323))

## [0.2.181] - 2026-09-25

### Fixed

- **storefront**: an account section opened directly renders the account page ([#320](https://github.com/fromcode119/framework/pull/320))

## [0.2.180] - 2026-09-25

### Fixed

- form webhooks keep their bytes; a new plugin can be activated ([#313](https://github.com/fromcode119/framework/pull/313))

## [0.2.179] - 2026-09-24

### Fixed

- **auth**: a site's own auth settings, name and address win on its requests ([#314](https://github.com/fromcode119/framework/pull/314))
- **arch-guard**: scoped plugin-ui-types checks its scope; seed content is not a boundary break ([#311](https://github.com/fromcode119/framework/pull/311))

## [0.2.178] - 2026-09-24

### Fixed

- **auth**: a login on a site's storefront enters that site ([#309](https://github.com/fromcode119/framework/pull/309))
- **api**: scope the users collection to the selected site's members ([#310](https://github.com/fromcode119/framework/pull/310))

## [0.2.177] - 2026-09-24

### Fixed

- **admin**: name no extension in SiteScopeGate's comments ([#307](https://github.com/fromcode119/framework/pull/307))
- **admin**: a site's page opened in platform scope says so, not "not found" ([#306](https://github.com/fromcode119/framework/pull/306))
- **ci**: detect a call from an extension by its inputs, not event_name ([#305](https://github.com/fromcode119/framework/pull/305))

## [0.2.176] - 2026-09-24

### Fixed

- **admin**: a record opened through /collections moves to its plugin's route ([#303](https://github.com/fromcode119/framework/pull/303))

## [0.2.175] - 2026-09-24

### Fixed

- **admin**: the colour picker opens above its button when there is no room below ([#301](https://github.com/fromcode119/framework/pull/301))

## [0.2.174] - 2026-09-24

### Added

- **auth**: each site edits its own sign-up email in Settings → General ([#296](https://github.com/fromcode119/framework/pull/296))

### Fixed

- **admin,api**: a saved record comes back as the server stored it ([#298](https://github.com/fromcode119/framework/pull/298))
- **core**: a reply to a request whose plugin channel closed is dropped ([#297](https://github.com/fromcode119/framework/pull/297))

## [0.2.173] - 2026-09-24

### Added

- **database**: a plugin data migration can reach every site's rows ([#284](https://github.com/fromcode119/framework/pull/284))

### Fixed

- **api**: record hooks get camelCase rows and the row before the write ([#294](https://github.com/fromcode119/framework/pull/294))
- **runtime**: a theme's static JSX children no longer read as an unkeyed list ([#292](https://github.com/fromcode119/framework/pull/292))
- **themes**: structured theme settings, working save, and a real per-site default layout ([#271](https://github.com/fromcode119/framework/pull/271))
- **api**: saving a record updates its updatedAt ([#291](https://github.com/fromcode119/framework/pull/291))
- **admin**: an empty localized field names the value the site shows instead ([#290](https://github.com/fromcode119/framework/pull/290))
- **admin**: the layout picker loads after a remount, and never warns while loading ([#287](https://github.com/fromcode119/framework/pull/287))
- **frontend**: storefront pages hydrate instead of falling back on plugin markup ([#280](https://github.com/fromcode119/framework/pull/280))

## [0.2.172] - 2026-09-23

### Fixed

- **storefront**: a page-wide overlay slot, rendered beside the theme layout ([#288](https://github.com/fromcode119/framework/pull/288))

## [0.2.171] - 2026-09-23

### Added

- **plugins**: context.i18n.siteClock() — the site's timezone and 12/24-hour clock ([#285](https://github.com/fromcode119/framework/pull/285))

## [0.2.170] - 2026-09-23

### Fixed

- **plugins**: an isolated plugin's migration sees the database dialect ([#282](https://github.com/fromcode119/framework/pull/282))

## [0.2.169] - 2026-09-23

### Added

- **settings**: a site's time format — follow the language, 12- or 24-hour ([#279](https://github.com/fromcode119/framework/pull/279))

## [0.2.168] - 2026-09-23

### Fixed

- **database**: every timestamp carries its time zone ([#278](https://github.com/fromcode119/framework/pull/278))
- **admin**: the page editor names the plugin whose design fills a page ([#274](https://github.com/fromcode119/framework/pull/274))

## [0.2.167] - 2026-09-23

### Fixed

- **storefront**: a blank contract page renders its plugin's design ([#270](https://github.com/fromcode119/framework/pull/270))
- **database**: a datetime field is stored as a point in time ([#275](https://github.com/fromcode119/framework/pull/275))
- **api**: the resolve cache is keyed per site ([#269](https://github.com/fromcode119/framework/pull/269))

## [0.2.166] - 2026-09-23

### Fixed

- **database**: a collection that claims createdAt keeps its timestamp default ([#272](https://github.com/fromcode119/framework/pull/272))

## [0.2.165] - 2026-09-23

### Added

- **core**: context.signing — plugins sign links on the host, never holding the key ([#266](https://github.com/fromcode119/framework/pull/266))

### Fixed

- **tenants**: a site import does not carry a signing root this deployment cannot open ([#267](https://github.com/fromcode119/framework/pull/267))

## [0.2.164] - 2026-09-23

### Fixed

- **sources**: Check Updates says what it found ([#264](https://github.com/fromcode119/framework/pull/264))
- **api**: an access refusal on a REST read is not logged as an error ([#263](https://github.com/fromcode119/framework/pull/263))
- **core**: the saved-secret mask follows the product name ([#248](https://github.com/fromcode119/framework/pull/248))

## [0.2.163] - 2026-09-23

### Fixed

- **integrations**: a saved provider keeps the namespace of the plugin that registered it ([#261](https://github.com/fromcode119/framework/pull/261))
- **plugins**: each site's settings screen reads and saves that site's settings ([#260](https://github.com/fromcode119/framework/pull/260))
- **core**: context.i18n.defaultLocale() answers the site's language ([#259](https://github.com/fromcode119/framework/pull/259))
- **admin**: a page's save cannot land in another tab's site ([#258](https://github.com/fromcode119/framework/pull/258))

## [0.2.162] - 2026-09-23

### Added

- **core**: one platform country every module inherits ([#251](https://github.com/fromcode119/framework/pull/251))

### Fixed

- **users**: inside a site, roles are the site membership's ([#256](https://github.com/fromcode119/framework/pull/256))
- **dashboard**: a site's setup card describes that site; disk measured with df ([#255](https://github.com/fromcode119/framework/pull/255))
- **api**: give a site's uploads a URL on the site, not the platform api ([#254](https://github.com/fromcode119/framework/pull/254))
- **admin**: resolve a localized value that arrives as a JSON string ([#249](https://github.com/fromcode119/framework/pull/249))
- **admin**: an import's dropped columns are fields that are not carried, not settings ([#253](https://github.com/fromcode119/framework/pull/253))
- **deploy**: the gateway's 96M limit is below what it needs to boot ([#250](https://github.com/fromcode119/framework/pull/250))
- site creation, blank localized fields, and the storefront white frame ([#247](https://github.com/fromcode119/framework/pull/247))

## [0.2.161] - 2026-09-22

### Fixed

- **admin**: the saved-secret mask — typed controls lost on save, and a legacy default ([#245](https://github.com/fromcode119/framework/pull/245))

## [0.2.160] - 2026-09-22

### Fixed

- **core**: resolve a prefixed collection reference inside its own plugin ([#243](https://github.com/fromcode119/framework/pull/243))

## [0.2.159] - 2026-09-22

### Changed

- Scoped unlock grants, one panel vocabulary, and read-only fields that read as values ([#241](https://github.com/fromcode119/framework/pull/241))

## [0.2.158] - 2026-09-22

### Fixed

- **admin**: read-only fields stop nesting frames, and a value stops being stranded ([#239](https://github.com/fromcode119/framework/pull/239))

## [0.2.157] - 2026-09-22

### Fixed

- **structured-field**: one table, not a table inside a table ([#237](https://github.com/fromcode119/framework/pull/237))

## [0.2.156] - 2026-09-22

### Added

- **plugin-health**: say when the installed version is not the one running ([#233](https://github.com/fromcode119/framework/pull/233))

### Fixed

- **structured-field**: a recorded value reads as admin, not as a debug dump ([#235](https://github.com/fromcode119/framework/pull/235))
- **records-hub**: a record with a document is still reachable ([#234](https://github.com/fromcode119/framework/pull/234))

## [0.2.155] - 2026-09-22

### Fixed

- **extension-builder**: a local database beside the source no longer ships ([#231](https://github.com/fromcode119/framework/pull/231))

## [0.2.154] - 2026-09-22

### Added

- **arch-guard**: a peer-callable method must be in the map that exposes it ([#229](https://github.com/fromcode119/framework/pull/229))
- **arch-guard**: no runnable script is committed to the platform source ([#228](https://github.com/fromcode119/framework/pull/228))
- **arch-guard**: an extension carries no scripts/ directory ([#227](https://github.com/fromcode119/framework/pull/227))
- **core**: let a plugin ask what relates to a subject ([#226](https://github.com/fromcode119/framework/pull/226))
- **core**: point a relationship at an entity, not at another plugin's collection ([#224](https://github.com/fromcode119/framework/pull/224))
- **core**: ask entity records about any record, not only about a person ([#223](https://github.com/fromcode119/framework/pull/223))

### Fixed

- **api**: actually dispatch beforeDelete and afterDelete ([#225](https://github.com/fromcode119/framework/pull/225))
- **admin**: honor collection admin.disableCreate and admin.disableEdit ([#222](https://github.com/fromcode119/framework/pull/222))

## [0.2.153] - 2026-09-21

### Fixed

- **admin**: take the console's mount from configuration, not from the word 'admin' ([#220](https://github.com/fromcode119/framework/pull/220))

## [0.2.152] - 2026-09-21

### Fixed

- **tenants**: a site's declared admin host pins that site, like a workspace's does ([#218](https://github.com/fromcode119/framework/pull/218))

## [0.2.151] - 2026-09-21

### Added

- **tenants**: declare what each host serves, instead of reading it from the name ([#215](https://github.com/fromcode119/framework/pull/215))

## [0.2.150] - 2026-09-21

### Fixed

- **certificates**: backfill the owning site on certificate rows created without one ([#213](https://github.com/fromcode119/framework/pull/213))

## [0.2.149] - 2026-09-21

### Fixed

- **certificates**: show a host as covered when a wildcard already serves it ([#211](https://github.com/fromcode119/framework/pull/211))
- **certificates**: show certificates for hosts the platform does not route ([#210](https://github.com/fromcode119/framework/pull/210))
- **deploy**: mount private storage, or its files vanish on the next upgrade ([#209](https://github.com/fromcode119/framework/pull/209))

## [0.2.148] - 2026-09-21

### Added

- **certificates**: per-site Cloudflare DNS token, platform as fallback ([#204](https://github.com/fromcode119/framework/pull/204))

### Fixed

- **certificates**: a wildcard certificate now serves the subdomains it covers ([#207](https://github.com/fromcode119/framework/pull/207))
- **deploy**: publish the gateway's TLS listener so GATEWAY_TLS_PORT is reachable ([#206](https://github.com/fromcode119/framework/pull/206))
- **frontend**: load the plugin bundles the server render mounted before hydrating ([#205](https://github.com/fromcode119/framework/pull/205))

## [0.2.147] - 2026-09-21

### Changed

- Time picker for the admin, and stop advertising pages that do not exist ([#202](https://github.com/fromcode119/framework/pull/202))

## [0.2.146] - 2026-09-21

### Fixed

- **tenancy**: a boot-time meta write can no longer blank every tenant ([#200](https://github.com/fromcode119/framework/pull/200))

## [0.2.145] - 2026-09-21

### Fixed

- **plugins**: an isolated plugin's public API must survive the portable view ([#198](https://github.com/fromcode119/framework/pull/198))

## [0.2.144] - 2026-09-21

### Fixed

- **plugins**: the peer snapshot reports each peer's function count ([#196](https://github.com/fromcode119/framework/pull/196))

## [0.2.143] - 2026-09-21

### Fixed

- **plugins**: the peer signature must cover a peer's function names ([#194](https://github.com/fromcode119/framework/pull/194))

## [0.2.142] - 2026-09-20

### Fixed

- **plugins**: refresh a guest's peer snapshot before each forwarded request ([#192](https://github.com/fromcode119/framework/pull/192))

## [0.2.141] - 2026-09-20

### Fixed

- **plugins**: the peer snapshot says how many plugins it walked ([#190](https://github.com/fromcode119/framework/pull/190))

## [0.2.140] - 2026-09-20

### Fixed

- **plugins**: never hide a peer refusal, including 'exposes no public API' ([#188](https://github.com/fromcode119/framework/pull/188))

## [0.2.139] - 2026-09-20

### Fixed

- **plugins**: split the guest peer namespace out, restoring the file-size guard ([#186](https://github.com/fromcode119/framework/pull/186))
- **plugins**: a guest says which peers it actually holds when a lookup misses ([#185](https://github.com/fromcode119/framework/pull/185))

## [0.2.138] - 2026-09-20

### Fixed

- **plugins**: say why a peer was withheld from a guest ([#183](https://github.com/fromcode119/framework/pull/183))

### Changed

- Restore a site from the admin; empty the scripts directory ([#182](https://github.com/fromcode119/framework/pull/182))

## [0.2.137] - 2026-09-20

### Added

- **tenant**: a row belonging to nobody can no longer be written ([#177](https://github.com/fromcode119/framework/pull/177))
- **tenant**: an import keeps the id map it built ([#173](https://github.com/fromcode119/framework/pull/173))

### Fixed

- **tenant**: refuse to remove isolation while several sites still own data ([#178](https://github.com/fromcode119/framework/pull/178))
- **tenant**: put back the ON DELETE actions an earlier migration dropped ([#176](https://github.com/fromcode119/framework/pull/176))
- **tenant**: widen only the tables that can take the key, and keep what the references do ([#175](https://github.com/fromcode119/framework/pull/175))
- **arch-guard**: refuse a scope that resolves to nothing ([#172](https://github.com/fromcode119/framework/pull/172))
- **sdk**: plugin stylesheets have not built since the admin config became TypeScript ([#171](https://github.com/fromcode119/framework/pull/171))

### Changed

- Each site gets its own id space, so an import keeps the ids it arrives with ([#174](https://github.com/fromcode119/framework/pull/174))

## [0.2.136] - 2026-09-20

### Added

- **tenant**: seal archives from the admin, and delete a site from a shell ([#168](https://github.com/fromcode119/framework/pull/168))
- **admin**: say what an import will do, in the words of someone who runs a shop ([#167](https://github.com/fromcode119/framework/pull/167))

### Fixed

- **tenant**: ask whether the archive's secrets open here, instead of assuming they do not ([#165](https://github.com/fromcode119/framework/pull/165))

## [0.2.135] - 2026-09-19

### Added

- **tenant**: let a json field declare where ids live inside its document ([#162](https://github.com/fromcode119/framework/pull/162))

### Fixed

- **tenant**: re-point references whose target table the row itself names ([#160](https://github.com/fromcode119/framework/pull/160))

## [0.2.134] - 2026-09-19

### Fixed

- **admin**: one heading for the things to check, and no jargon in a caption that is always visible ([#158](https://github.com/fromcode119/framework/pull/158))

## [0.2.133] - 2026-09-19

### Fixed

- **admin**: the framework's own kinds are not the shop's, and the tick follows the sentence ([#156](https://github.com/fromcode119/framework/pull/156))

## [0.2.132] - 2026-09-19

### Fixed

- **admin**: the import headline names things, not telemetry ([#153](https://github.com/fromcode119/framework/pull/153))

## [0.2.131] - 2026-09-19

### Added

- **tenants**: the migration CLIs carry the transit passphrase, and a guide says how ([#148](https://github.com/fromcode119/framework/pull/148))
- **tenants**: the archive carries its secrets, and says whether it can ([#146](https://github.com/fromcode119/framework/pull/146))
- **security**: a secret can travel between deployments without ever being at rest in the clear ([#145](https://github.com/fromcode119/framework/pull/145))
- **arch-guard**: guard copy rendered from .tsx instead of i18n ([#140](https://github.com/fromcode119/framework/pull/140))

### Fixed

- **admin**: the import screen reads like a shop, not a database ([#150](https://github.com/fromcode119/framework/pull/150))
- **tenants**: an older schema's flat columns fold into the field that replaced them ([#144](https://github.com/fromcode119/framework/pull/144))
- **tenants**: imported content points at the renamed upload, not the original name ([#142](https://github.com/fromcode119/framework/pull/142))

## [0.2.130] - 2026-09-19

### Fixed

- **tenants**: the import says when a secret arrives unreadable ([#138](https://github.com/fromcode119/framework/pull/138))

## [0.2.129] - 2026-09-19

### Fixed

- **admin**: a wrapped field label no longer drops its control below the row ([#136](https://github.com/fromcode119/framework/pull/136))

### Changed

- Redesign import plan 'What the import will do' to lead with arrivals ([#135](https://github.com/fromcode119/framework/pull/135))

## [0.2.128] - 2026-09-18

### Added

- **admin**: structured read-only and address field components ([#131](https://github.com/fromcode119/framework/pull/131))

### Fixed

- **extension-builder**: the migration step looks where migrations actually live ([#132](https://github.com/fromcode119/framework/pull/132))

## [0.2.127] - 2026-09-18

### Fixed

- **tenants**: explain the empty group, label rows, separate export notes ([#125](https://github.com/fromcode119/framework/pull/125))
- **cli**: plugin dev records what the BUILD stamped, not a later edit ([#129](https://github.com/fromcode119/framework/pull/129))
- **frontend**: the two site status bars stack instead of covering each other ([#127](https://github.com/fromcode119/framework/pull/127))
- **core**: a peer whose process is down is absent, not broken ([#126](https://github.com/fromcode119/framework/pull/126))

## [0.2.126] - 2026-09-18

### Fixed

- **cli**: plugin build produces a real bundle instead of exiting 0 ([#113](https://github.com/fromcode119/framework/pull/113))
- **tenants**: the import preview says what it means, not what it does ([#123](https://github.com/fromcode119/framework/pull/123))

## [0.2.125] - 2026-09-18

### Changed

- arch-guard: single-export-module guard + interface-in-class-file fix ([#120](https://github.com/fromcode119/framework/pull/120))

## [0.2.124] - 2026-09-18

### Fixed

- **core**: keep the operator's sandbox and plugin config across a hot install ([#117](https://github.com/fromcode119/framework/pull/117))

## [0.2.123] - 2026-09-18

### Added

- **react**: add an error boundary at every plugin/theme mount point ([#114](https://github.com/fromcode119/framework/pull/114))

### Fixed

- **core**: an empty string survives import in every character column, not two of them ([#115](https://github.com/fromcode119/framework/pull/115))
- **core**: the framework names no extension, not even in a fixture ([#116](https://github.com/fromcode119/framework/pull/116))

## [0.2.122] - 2026-09-18

### Fixed

- **core**: resolve plugin ui/migrations layout on hot install ([#110](https://github.com/fromcode119/framework/pull/110))
- **core**: stop tenant import writing JSON text columns as arrays ([#111](https://github.com/fromcode119/framework/pull/111))
- **core**: forward an isolated plugin's i18n registrations to the host ([#106](https://github.com/fromcode119/framework/pull/106))

## [0.2.121] - 2026-09-18

### Fixed

- **admin**: make the Sources list readable, and let its actions sit on the row ([#108](https://github.com/fromcode119/framework/pull/108))
- **core**: rate limit settings are platform-scoped, not per-site ([#107](https://github.com/fromcode119/framework/pull/107))

## [0.2.120] - 2026-09-18

### Fixed

- **frontend**: find the runtime manifest from the package, not the cwd ([#103](https://github.com/fromcode119/framework/pull/103))
- **cli**: theme dev ignores the entry file the compiler writes ([#102](https://github.com/fromcode119/framework/pull/102))

## [0.2.119] - 2026-09-18

### Fixed

- **cli**: theme build/dev drive the real Vite pipeline ([#100](https://github.com/fromcode119/framework/pull/100))

## [0.2.118] - 2026-09-18

### Added

- **arch-guard**: an extension may import only what the SDK import map publishes ([#97](https://github.com/fromcode119/framework/pull/97))

### Fixed

- **frontend**: the storefront had no dev loop ([#96](https://github.com/fromcode119/framework/pull/96))

## [0.2.117] - 2026-09-18

### Fixed

- **react**: the storefront SDK map was missing CookieSameSite ([#94](https://github.com/fromcode119/framework/pull/94))

## [0.2.116] - 2026-09-17

### Fixed

- **admin**: name the UI contracts a plugin has to satisfy ([#91](https://github.com/fromcode119/framework/pull/91))

## [0.2.115] - 2026-09-17

### Fixed

- **core**: mint a site preview grant bound to the site, not the platform ([#87](https://github.com/fromcode119/framework/pull/87))
- **core**: split settings-registry file, stop naming Cloudflare in generic settings code ([#86](https://github.com/fromcode119/framework/pull/86))

### Changed

- Every framework arch-guard at zero — no baselines, no allowlists ([#89](https://github.com/fromcode119/framework/pull/89))

## [0.2.114] - 2026-09-16

### Fixed

- **security**: real visitor IP through Cloudflare + Cloudflare provider organization ([#84](https://github.com/fromcode119/framework/pull/84))

## [0.2.113] - 2026-09-16

### Added

- **core**: platform-owned wildcard certificates via Cloudflare DNS-01 ([#81](https://github.com/fromcode119/framework/pull/81))

## [0.2.112] - 2026-09-16

### Changed

- A platform admin standing in a site sees that site only ([#80](https://github.com/fromcode119/framework/pull/80))

## [0.2.111] - 2026-09-16

### Fixed

- **files**: private file shares belong to the site that sent them ([#78](https://github.com/fromcode119/framework/pull/78))
- **admin**: a platform screen refuses to render inside a site ([#77](https://github.com/fromcode119/framework/pull/77))

## [0.2.110] - 2026-09-16

### Fixed

- **admin**: stepping into a site leaves the platform's own screens behind ([#74](https://github.com/fromcode119/framework/pull/74))

## [0.2.109] - 2026-09-16

### Fixed

- **sources**: the update button works, and the version panel is usable ([#72](https://github.com/fromcode119/framework/pull/72))

## [0.2.108] - 2026-09-16

### Fixed

- **core**: an isolated plugin can ask for its site's base URLs ([#70](https://github.com/fromcode119/framework/pull/70))

## [0.2.107] - 2026-09-16

### Fixed

- **storage**: a site's uploads are written to, and served from, its own directory ([#68](https://github.com/fromcode119/framework/pull/68))

## [0.2.106] - 2026-09-16

### Added

- **core**: a site's own absolute URL, for every link that leaves the platform ([#66](https://github.com/fromcode119/framework/pull/66))

## [0.2.105] - 2026-09-16

### Added

- **sources**: show which version is running, and go back to an older one ([#64](https://github.com/fromcode119/framework/pull/64))

### Fixed

- **settings**: one marketplace_url for the platform and every site ([#63](https://github.com/fromcode119/framework/pull/63))
- **sources**: the update switch says what it depends on ([#62](https://github.com/fromcode119/framework/pull/62))
- **marketplace**: say which entries this installation built itself ([#61](https://github.com/fromcode119/framework/pull/61))
- **core**: context.users answers by site membership, inside the site, for every lookup ([#60](https://github.com/fromcode119/framework/pull/60))

## [0.2.104] - 2026-09-16

### Fixed

- a site sees only its own, across fourteen more surfaces ([#58](https://github.com/fromcode119/framework/pull/58))

## [0.2.103] - 2026-09-15

### Added

- **api**: a site gets its own marketplace and health, scoped to itself ([#55](https://github.com/fromcode119/framework/pull/55))
- a site can upload and remove its own theme ([#56](https://github.com/fromcode119/framework/pull/56))
- **core**: a theme or plugin can belong to one site instead of the platform ([#53](https://github.com/fromcode119/framework/pull/53))

## [0.2.102] - 2026-09-15

### Fixed

- **api**: scope plugin, theme and appearance listings to the bound tenant ([#49](https://github.com/fromcode119/framework/pull/49))

## [0.2.101] - 2026-09-15

### Fixed

- **core**: re-point id references a collection schema declares, not just plain columns ([#47](https://github.com/fromcode119/framework/pull/47))

## [0.2.100] - 2026-09-15

### Fixed

- **tenants**: an export carries every uploaded file, not only media-linked ones ([#44](https://github.com/fromcode119/framework/pull/44))

### Changed

- The framework names no extension, and no product's word for the admin ([#46](https://github.com/fromcode119/framework/pull/46))

## [0.2.99] - 2026-09-15

### Fixed

- **admin**: downloads from the console, and a banner that hid the navigation ([#42](https://github.com/fromcode119/framework/pull/42))

## [0.2.98] - 2026-09-15

### Added

- **auth**: show what the browser sent and was told on a tenant switch ([#40](https://github.com/fromcode119/framework/pull/40))

## [0.2.97] - 2026-09-15

### Fixed

- **tenancy**: a stale session cookie must not shadow the new one ([#38](https://github.com/fromcode119/framework/pull/38))
- **telemetry**: a digest that could not read the log says so ([#34](https://github.com/fromcode119/framework/pull/34))

### Changed

- Say when a switch did not reach the session row ([#37](https://github.com/fromcode119/framework/pull/37))
- A refused site switch says why ([#36](https://github.com/fromcode119/framework/pull/36))

## [0.2.96] - 2026-09-15

### Fixed

- **telemetry**: the weekly digest reports every site, not only the platform ([#32](https://github.com/fromcode119/framework/pull/32))

## [0.2.95] - 2026-09-15

### Fixed

- **tenancy**: deleting the site you are in must not lock you out ([#29](https://github.com/fromcode119/framework/pull/29))
- **plugins**: a peer that did not resolve is not a failed call ([#28](https://github.com/fromcode119/framework/pull/28))
- **plugins**: ask one question about whether a peer is resolvable ([#27](https://github.com/fromcode119/framework/pull/27))

## [0.2.94] - 2026-09-15

### Added

- **tenants**: import a site from a path, without a browser ([#25](https://github.com/fromcode119/framework/pull/25))
- **admin**: make the site import screen readable and stop it lying ([#22](https://github.com/fromcode119/framework/pull/22))
- **people**: own the erasure policy in the framework ([#21](https://github.com/fromcode119/framework/pull/21))

### Fixed

- **users**: a user created for a site belongs to that site ([#24](https://github.com/fromcode119/framework/pull/24))

### Changed

- Find columns nothing declares, and propose them for review ([#23](https://github.com/fromcode119/framework/pull/23))

## [0.2.93] - 2026-09-15

### Added

- **people**: own the personal-data register in the framework ([#19](https://github.com/fromcode119/framework/pull/19))
- **database**: reconcile a NOT NULL the schema no longer declares ([#18](https://github.com/fromcode119/framework/pull/18))

### Fixed

- erase EVERY person row for the subject, not the first one found

## [0.2.92] - 2026-09-15

### Added

- **schema**: create a unique that a field declares on an existing column ([#12](https://github.com/fromcode119/framework/pull/12))

### Fixed

- **dev**: mount the sdk dist, so plugins run the SDK you just built

## [0.2.91] - 2026-09-14

### Fixed

- **marketplace**: install a locally built package from disk, not from a dead URL

## [0.2.90] - 2026-09-14

### Added

- **tenancy**: a site can be marked non-production so nothing leaves it

### Fixed

- a plugin's own admin page loads that plugin's UI
- a self-deleted account is erased as thoroughly as a DSAR one

## [0.2.89] - 2026-09-14

### Added

- **sdk**: one helper for a plugin's DSAR row work, and self-delete stops duplicating core
- **core**: the framework can answer for its own personal data

### Fixed

- **ci**: the attribution guard blocked its own commit

## [0.2.88] - 2026-09-14

### Added

- **core**: retention for the audit trail, with a floor it will not cross

## [0.2.87] - 2026-09-14

### Fixed

- **api**: restore BaseController binding on plugin lifecycle and upload controllers

## [0.2.86] - 2026-09-14

### Fixed

- **core**: log retention pruned the platform's own rows and never a site's ([#40](https://github.com/fromcode119/framework/pull/40))

## [0.2.85] - 2026-09-14

### Added

- **database**: MySQL installs — 23 migrations, five driver bugs, and a backup handler
- **setup**: SQLite and MySQL are listed with why they cannot be picked; fix migration 039
- **setup**: configure the database from the browser, so a first install sets nothing

### Fixed

- **admin**: every settings page answers for its own scope, and the URLs stop lying
- **admin**: a Select's clear control was a button inside a button
- **admin**: settings save in platform scope, and scope decides the screen
- **platform**: the api refuses indexing by header, not only robots.txt
- **admin**: restore next-env.d.ts to the build variant
- **repo**: stop tracking the generated admin proxy binding
- **setup**: the founding administrator is the platform owner
- **test**: the integration suite never ran
- **setup**: say why MySQL cannot be installed, accurately
- **deploy**: run the bundled install for real, and stop claiming an unbuilt design
- **database**: SQLite can complete an install
- **deploy**: leave nothing in .env for a first install to fill in
- **copy**: a host is a domain, not an address
- **deploy**: make a first install actually startable from the shipped compose
- **admin**: stop counting the setup steps in prose

## [0.2.84] - 2026-09-14

### Fixed

- **gateway**: keep looking for the shared secret until it appears

## [0.2.83] - 2026-09-14

### Fixed

- **gateway**: share the generated internal secret with the api
- **api**: never fill a site's url onto the platform row

## [0.2.82] - 2026-09-14

_No user-facing changes._

## [0.2.81] - 2026-09-14

### Added

- **admin**: confirm the console address as the last step of setup
- **core**: let an unclaimed platform be reached, once, narrowly
- **core**: generate the bootstrap secrets when nobody supplied them
- **core**: make the api URL a setting, like the other platform hosts

### Fixed

- **admin**: drop the last 'console' from the setup copy
- **admin**: call it the admin, not the console, in operator-facing copy
- **api**: fill an EMPTY setting row from its declared default
- **frontend**: never bake a server-side address into a visitor's page
- **api**: accept a page calling the host it was served from
- **core**: the browser calls the api on its own origin, always

## [0.2.80] - 2026-09-13

### Added

- **admin**: say which settings are platform-wide, in tenant mode
- **core**: declare setting scope once, as a type-checked registry

### Fixed

- **core**: declare the two remaining platform-read settings, and guard the list
- **core**: declare admin_search_indexing a platform setting

## [0.2.79] - 2026-09-13

### Added

- **api**: answer robots.txt on the platform's own hosts

## [0.2.78] - 2026-09-13

_No user-facing changes._

## [0.2.77] - 2026-09-13

### Added

- **admin**: platform scope — leave a site, and narrow the nav to it

### Fixed

- **certificates**: stop claiming a served host cannot use HTTPS
- **certificates**: let tenants claim their own host before the platform
- **admin**: re-derive the session instead of a one-shot snapshot
- **admin**: preserve every Set-Cookie through the same-origin /api proxy

## [0.2.76] - 2026-09-13

### Changed

- Release 0.2.76
- Let a site's own people see it before it is published

## [0.2.75] - 2026-09-13

### Changed

- Release 0.2.75
- Suggest the platform's addresses instead of asking the operator to type them

## [0.2.74] - 2026-09-13

### Changed

- Release 0.2.74
- Follow redirects in the challenge pre-flight, as a validator does

## [0.2.73] - 2026-09-13

### Changed

- Release 0.2.73
- Obtain certificates automatically, and never before it can work

## [0.2.72] - 2026-09-13

### Changed

- Release 0.2.72
- Require the gateway's internal secret, and stop publishing it on port 80
- Install @testing-library/dom so the admin DOM tests can load
- Store and serve TLS certificates from the platform

## [0.2.71] - 2026-09-12

_No user-facing changes._

## [0.2.70] - 2026-09-12

_No user-facing changes._

## [0.2.69] - 2026-09-12

_No user-facing changes._

## [0.2.68] - 2026-09-12

_No user-facing changes._

## [0.2.67] - 2026-09-12

_No user-facing changes._

## [0.2.66] - 2026-09-12

_No user-facing changes._

## [0.2.65] - 2026-09-12

_No user-facing changes._

## [0.2.64] - 2026-09-12

### Fixed

- give the api the storefront url, or every theme asset is refused by CORS

## [0.2.63] - 2026-09-12

_No user-facing changes._

## [0.2.62] - 2026-09-12

_No user-facing changes._

## [0.2.61] - 2026-09-12

_No user-facing changes._

## [0.2.60] - 2026-09-12

_No user-facing changes._

## [0.2.59] - 2026-09-12

_No user-facing changes._

## [0.2.58] - 2026-09-12

_No user-facing changes._

## [0.2.57] - 2026-09-12

_No user-facing changes._

## [0.2.56] - 2026-09-12

_No user-facing changes._

## [0.2.55] - 2026-09-12

_No user-facing changes._

## [0.2.54] - 2026-09-12

_No user-facing changes._

## [0.2.53] - 2026-09-12

_No user-facing changes._

## [0.2.52] - 2026-09-12

_No user-facing changes._

## [0.2.51] - 2026-09-12

### Added

- **admin**: the loading line changes while you wait

### Fixed

- **admin**: the account row gets the selector icon
- **admin**: loading says something again, in plain words and light weight
- **admin**: plain loading copy, a bounded site list, a chevron on the account row
- **admin**: the Sources header sits flat, like every other screen's

## [0.2.50] - 2026-09-12

### Fixed

- **admin**: the Sources counters become one strip, not four panels

## [0.2.49] - 2026-09-12

### Fixed

- **admin**: the Sources screen stops inventing its own card

## [0.2.48] - 2026-09-12

_No user-facing changes._

## [0.2.47] - 2026-09-12

_No user-facing changes._

## [0.2.46] - 2026-09-12

_No user-facing changes._

## [0.2.45] - 2026-09-12

_No user-facing changes._

## [0.2.44] - 2026-09-12

### Fixed

- Settings → General could never be saved

## [0.2.43] - 2026-09-11

_No user-facing changes._

## [0.2.42] - 2026-09-11

_No user-facing changes._

## [0.2.41] - 2026-09-11

_No user-facing changes._

## [0.2.40] - 2026-09-11

_No user-facing changes._

## [0.2.39] - 2026-09-11

_No user-facing changes._

## [0.2.38] - 2026-09-11

_No user-facing changes._

## [0.2.37] - 2026-09-11

_No user-facing changes._

## [0.2.36] - 2026-09-11

_No user-facing changes._

## [0.2.35] - 2026-09-11

### Fixed

- **deploy**: give the api a writable backups directory
- install a locally built theme from where it actually is

## [0.2.34] - 2026-09-11

_No user-facing changes._

## [0.2.33] - 2026-09-11

_No user-facing changes._

## [0.2.32] - 2026-09-11

_No user-facing changes._

## [0.2.31] - 2026-09-11

### Added

- a plugin can do work that belongs to every site
- Sources is part of the framework, not a plugin

### Fixed

- per-site plugin setup happens automatically, with no plugin change
- boot-time writes to tenant-scoped tables were refused, on every boot
- an isolated plugin was told a disabled plugin was there
- a plugin's scheduled task could not reach tenant data

## [0.2.30] - 2026-09-11

### Fixed

- the parity test was scanning the whole monorepo

## [0.2.29] - 2026-09-11

### Fixed

- the theme build hit the same npm-cache wall, in its own copy of the code

## [0.2.28] - 2026-09-11

### Added

- a catalogue anything can contribute to

### Fixed

- building a source could never work in a container — four separate reasons

## [0.2.27] - 2026-09-11

### Added

- appearances build with the CLI — the last shell script is gone

### Fixed

- a stopped extension said it was never installed

## [0.2.26] - 2026-09-11

### Fixed

- the action column wrapped onto a second line

## [0.2.25] - 2026-09-11

### Added

- say when the installation cannot store credentials

## [0.2.24] - 2026-09-11

### Added

- context.secrets — credentials at rest belong to the framework

## [0.2.23] - 2026-09-11

### Fixed

- ship CA certificates — git could not open a single HTTPS repository

## [0.2.22] - 2026-09-11

### Fixed

- ship git — the Sources screen could not work without it

## [0.2.21] - 2026-09-11

### Fixed

- build extension-builder with tsmi, so its ESM half resolves its own aliases

## [0.2.20] - 2026-09-11

### Reverted

- bundling the ESM artifacts — it broke the frontend build

## [0.2.19] - 2026-09-11

### Fixed

- a bundled extension is not a plugin, and two shipped artifacts nobody loaded

## [0.2.18] - 2026-09-11

### Fixed

- a plugin screen could not be named anything but its slug

## [0.2.17] - 2026-09-11

### Fixed

- an update button that could never work, a grid nobody could read, and a version with no changelog

## [0.2.16] - 2026-09-11

### Fixed

- every plugin admin screen was blank on a split-host deployment

## [0.2.15] - 2026-09-11

### Fixed

- the update check read releases this repository does not publish
- a bundled extension is never installed at runtime, and the account menu opens beside the rail

## [0.2.14] - 2026-09-11

### Fixed

- wrong destinations, invisible icons, and an update check that could only fail
- deploy targets are local configuration, never committed

## [0.2.13] - 2026-09-11

### Added

- a deploy that proves itself and cleans up after itself

### Fixed

- the configuration width cap was an arbitrary Tailwind value, so it never existed
- the dashboard's section rules and stretched rows
- the bundled build server shipped as three files and no code

## [0.2.12] - 2026-09-11

### Added

- the build server ships WITH the framework, always on

## [0.2.11] - 2026-09-11

### Fixed

- **builder**: one module location that works in BOTH outputs

## [0.2.10] - 2026-09-11

### Fixed

- **builder**: the CLI could not run at all under ESM, and plugins had nowhere to write

## [0.2.9] - 2026-09-11

### Fixed

- **admin**: stop telling single-site installs to create a site

## [0.2.8] - 2026-09-11

### Added

- **admin**: the two dashboard faces, and an account menu that stands alone

## [0.2.7] - 2026-09-11

### Added

- **admin**: where you left off
- **admin**: a dashboard that leads with what needs doing
- **admin**: show what the machine is doing, and what runs next
- **admin**: account card at the foot of the sidebar, and a rail that fits

## [0.2.6] - 2026-09-11

### Fixed

- a fresh install could not complete setup, and its menus were white

## [0.2.5] - 2026-09-11

### Added

- **admin**: guided first-run setup, in the operator's language

### Fixed

- **admin**: show the version this build actually is

## [0.2.4] - 2026-09-11

### Fixed

- **admin**: serve /api on the admin's own origin

## [0.2.3] - 2026-09-10

### Added

- **extension-builder**: theme packing reaches parity
- **extension-builder**: build theme bundles; state plainly what is unported
- **extension-builder**: parity harness, and three bugs it caught
- **extension-builder**: generate the vite/tailwind config glue
- **cli**: build, pack and checksum commands for every extension kind
- **extension-builder**: the source-provider contract, plus archives
- **extension-builder**: reach the builder from plugins via context.extensions
- **extension-builder**: build pipeline with typed step results
- **extension-builder**: pack cleaning and the double integrity stamp
- **extension-builder**: minify and precompress built assets
- **extension-builder**: compile plugin UI styles
- **extension-builder**: build theme seeds
- **extension-builder**: compile the theme head script
- **extension-builder**: layout-agnostic workspace resolution
- **extension-builder**: scaffold the package with collected tests
- **deploy**: move HTML->PDF rendering to an opt-in sidecar

### Fixed

- **docker**: a failing npm install must fail the build
- keep runtime state out of the image, and stop the CLI loading the builder
- build-time tools are devDependencies, not production ones
- **extension-builder**: no plugin or UI-library names in framework source
- **extension-builder**: verify parity claims instead of exempting files
- **extension-builder**: write the built theme seed to dist, not into the theme
- **extension-builder**: scope parity exceptions to the extension they were seen in
- **extension-builder**: the browser require shim, and the UI step that never ran
- **core**: stop a devDep peer graph failing a plugin at boot

### Performance

- **docker**: drop platform binaries for the libc the image cannot use
- **docker**: drop the C++ toolchain from the runtime images
- **extension-builder**: minify chunks concurrently

## [0.2.2] - 2026-09-10

### Fixed

- generate the icon data before build:libs, not after

## [0.2.1] - 2026-09-10

### Fixed

- unpin marketplace-client so a version bump cannot break the image build

## [0.2.0] - 2026-09-10

### Added

- restructure collection interfaces and update imports
- Introduce new plugin context interfaces for improved structure and organization
- **theme**: add ThemePackageLayout for managing theme build outputs and update ThemeHeadModel to utilize it
- **frontend**: enhance theme loading with inlined boot script and module preload links
- **auth**: refactor authentication logic by introducing AuthTokenService for JWT handling
- **plugin**: refactor lifecycle service and introduce boot health reporter and seed runner
- **api**: Refactor server API utilities and paths
- **api**: add SystemWebhooksController for webhook management
- **database**: enhance Postgres and SQLite read operations with JSON pattern matching
- **auth**: implement host-scoped session cookies and update CSRF token handling
- **media**: enhance media asset handling with detailed info dialog and size reporting
- **scim**: enhance SCIM service with tenant resolution and scoped user access
- **auth**: add role-based permission checks and enhance permission handling
- add site access, exports, and grant dialog components
- enhance site management with export archives and storefront page handling
- implement multi-tenant role management and enhance plugin seed handling
- enhance site management with inventory handling and page rebuilding capabilities
- **queue**: add Bull and Local queue adapters with job management capabilities
- enhance plugin guest and host communication
- **webhook**: enhance webhook path handling and add tests for WebhookRouteUtils
- add integration provider and config field types to core exports
- integrate PluginUsageTracker in Override component

### Changed

- Refactor import paths across multiple packages to use absolute paths for better readability and maintainability

## [0.1.88] - 2026-08-22

### Added

- **email**: implement FrameworkEmailSender and FrameworkEmailSenderService for configurable email sending
- **auth**: disabling 2FA requires a current TOTP or unused recovery code — a bare session no longer suffices
- **plugin-manager**: integrate StorefrontRendererRefreshService for plugin installation and updates feat(theme-ssr): add support for plugin default styles in ThemeSsrMarkup and ThemeSsrHeadView test(plugin-manager): add tests for storefront renderer refresh on plugin operations test(theme-ssr): implement tests for lifting plugin default styles in ThemeSsrMarkup
- add StorefrontRendererRefreshService and integrate with ThemeManager for theme installation and activation
- **page-doc-prefetcher**: enhance slug extraction to handle localized fields and nested paths
- **database**: enhance SQLite column normalization to handle TEXT affinity and add tests for number roundtrip
- **docker**: unify appearance directory handling across services and update usage instructions
- **mcp**: deploy.ssrStatus — ask the FRONTEND what it can see
- **mcp**: restart any app of the deployment, not just the api
- enhance restart service row with detailed description and URL display

### Fixed

- **archor**: sdk-boundary versioned-path rule ignores absolute third-party URLs
- **ssr**: fail loudly when the active theme ships no server bundle
- **theme build**: server bundle must be self-contained, and the framework must not name a UI library

## [0.1.87] - 2026-08-19

### Added

- implement internal service authentication and restart functionality
- prevent copying of public assets in SSR build configuration

## [0.1.86] - 2026-08-19

### Added

- implement structured data handling and batch update services for plugins

## [0.1.85] - 2026-08-19

### Added

- enhance head-data handling and optimize timestamp comparisons in Postgres dialect

## [0.1.84] - 2026-08-18

### Added

- enhance resolution service and audit logging
- add file share feature with translations and styling

## [0.1.83] - 2026-08-13

### Added

- **database**: introduce SchemaKeyField to manage primary key declarations
- **hooks**: implement owner-scoped handler registration and cleanup to prevent duplicates
- **i18n**: implement layered translation registration for plugins and themes
- **core**: context.email.buildPreferencesUrl
- **frontend**: global /unsubscribe page
- **api**: token-authenticated email preference endpoints
- **core**: framework-owned email preferences token

### Fixed

- **api**: seed the platform locale before plugins register
- **core**: materialized pages were served as 404s
- **core**: derive singleton page slug from the whole path

## [0.1.82] - 2026-08-10

### Added

- **email**: implement email suppression service and preferences management
- enhance NamingStrategy to correctly handle Enum serialization and add tests for ScheduleType resolution
- improve raw-SQL where clause handling and add tests for unsupported shapes
- enhance plugin package validation and scaffolding

## [0.1.81] - 2026-08-07

### Added

- implement plugin settings key migration service to reconcile legacy keys with current schema
- enhance collection access policy checks and improve block field conformance logic
- add block field conformance checks and JSON view for collection editing
- Update button and input styles to use consistent radius variable for UI components
- Refactor imports to use runtime-utils and add EnumValueCoercion for better type handling
- Add build scripts for tooling, runtime, and libraries in package.json; update .dockerignore and .gitignore to include dist-packages
- Update plugin UI entry files to use global context for injected variables
- Add environment variables for themes and plugins in frontend service

### Fixed

- **build**: suppress untyped lucide deep import; drop redundant admin css-imports.d.ts

## [0.1.80] - 2026-08-03

### Changed

- Refactor code structure for improved readability and maintainability

## [0.1.79] - 2026-07-17

### Added

- Introduce AssetCacheHeaderService for managing asset cache headers and update related components

### Changed

- Add tests for PageDocPrefetcher and SsrContentShellService, enhance template matching and rendering logic

## [0.1.78] - 2026-07-16

_No user-facing changes._

## [0.1.77] - 2026-07-16

### Added

- **plugin-health**: implement plugin health notification system

## [0.1.76] - 2026-07-08

### Added

- Implement admin search service and notification inbox service

## [0.1.75] - 2026-07-05

_No user-facing changes._

## [0.1.74] - 2026-07-05

### Added

- Implement API access control with AccessLevel and ApiAccessGate

## [0.1.73] - 2026-06-26

_No user-facing changes._

## [0.1.71] - 2026-06-23

### Added

- implement admin-triggered password reset functionality and update related interfaces

## [0.1.70] - 2026-06-23

### Added

- update version to 0.1.70 and enhance boolean handling in CollectionFieldGuard
- update package versions to 0.1.69 and add sync script for version consistency

## [0.1.69] - 2026-06-23

### Added

- update version to 0.1.69 and add MeasurementSystemUtils for unit conversions
- add appearance management features

## [0.1.68] - 2026-06-20

### Added

- **media**: add list and count methods to MediaContextProxy for enhanced media record management
- **rest**: enhance export functionality to filter records by selected IDs
- **plugin**: implement stripping of host-provided dependencies from package manifest
- **database**: add isolation enforcement for forbidden table access in DatabaseContextProxy

## [0.1.67] - 2026-06-19

### Fixed

- **auth**: ensure security notifications do not block critical actions and handle errors gracefully

## [0.1.66] - 2026-06-19

### Added

- add checks for database find/count options and enforce plugin architecture

## [0.1.65] - 2026-06-10

### Added

- implement country and system locale field components with registration and utility enhancements

## [0.1.64] - 2026-06-10

### Fixed

- **data-processor**: handle UNIQUE field coercion from empty string to null

## [0.1.63] - 2026-06-10

### Added

- add marketplace URL settings and enhance plugin integrity handling

## [0.1.62] - 2026-06-09

### Added

- **account**: add account management features including translations, profile, security, and sessions panels

### Fixed

- safelist plugin arbitrary Tailwind values for production Docker builds

## [0.1.61] - 2026-06-05

### Added

- implement column management features in CollectionList and enhance error handling in form components

## [0.1.60] - 2026-06-04

_No user-facing changes._

## [0.1.59] - 2026-06-04

### Added

- add user interfaces and enhance admin component context
- **scripts**: add check-theme-override-boundary enforcement (warn mode) (Plan 2 Task 6)
- update framework to version 0.1.59 and enhance resolution contract handling
- enhance PluginLoader to validate plugin collection metadata before replacing collections
- enhance LifecycleService to clear stale error state on successful enable and add test for runtime materialization without pages collection

### Fixed

- **runtime**: expose ThemeOverrideRegistrar in the frontend react bridge (was missing → theme cms-block registrar crashed)
- **scripts**: theme-override check must not flag theme-internal overrides/ refs as plugin source

### Changed

- Refactor UI components to class-based structure for hook-free plugin compatibility

## [0.1.58] - 2026-05-25

### Added

- update package version to 0.1.58 and enhance EntityFormDataService with read-only system field extraction
- Enhance core types and interfaces for improved plugin and entity management

## [0.1.56] - 2026-05-18

### Added

- update package version to 0.1.56 and implement InteractiveCanvas context with related interfaces and components

## [0.1.55] - 2026-05-16

### Added

- enhance collection management with nested entity routes, duplicate functionality, and timezone utilities tests
- **date-time-picker**: adjust Date constructor for correct UTC handling and enhance button styles

## [0.1.54] - 2026-05-15

### Added

- update package version to 0.1.54 and enhance FieldRenderer and CollectionFieldGuard with read-only override logic

## [0.1.53] - 2026-05-14

### Added

- update package version to 0.1.53 and enhance DateTimePicker component with improved month navigation and styling
- **auth**: implement email infrastructure for verification and notifications

## [0.1.52] - 2026-05-14

### Added

- **collection-list**: implement collection list functionalities including table, row actions, and relationship cell rendering

## [0.1.51] - 2026-05-13

### Added

- update package version to 0.1.51 and enhance locale storage key handling

## [0.1.50] - 2026-05-13

### Added

- update localization handling and introduce LocalizedField component

## [0.1.49] - 2026-05-13

### Added

- update version, enhance locale handling, and implement plugin injection rendering

## [0.1.48] - 2026-05-13

### Added

- **settings**: add notification email settings and enhance telemetry recipient handling

## [0.1.47] - 2026-05-13

### Added

- **plugin**: implement PluginContextFileReader for improved file reading and management

## [0.1.46] - 2026-05-13

### Added

- **i18n**: enhance translation methods with scoped key resolution and locale normalization feat(paths): add methods for resolving current plugin root and reading templates feat(utils): extend PluginManagerInterface with theme manager support

## [0.1.45] - 2026-05-13

### Added

- update version and enhance collection preview handling with utility methods

## [0.1.44] - 2026-05-12

### Added

- **i18n**: add translateOrFallback method for improved translation handling

## [0.1.43] - 2026-05-12

### Added

- **api**: implement ApiBootstrapService for server initialization and plugin management
- add support for multiple active providers in integration configuration
- add instantiateWithConfig method to PluginContext for integration resolution
- enhance collection edit and list pages with form data handling and search optimization
- increase restart recovery timeout and improve error handling in plugin version wait service
- enhance plugin installation process with version handling and error management
- implement version handling for plugin installation and updates across services
- enhance plugin detail page with version refresh logic and marketplace version display
- refactor plugin installation process to use PluginInstallOperationService

### Fixed

- add validation to exclude specific file types in path checks
- update plugin installation endpoint to use correct base path

## [0.1.42] - 2026-05-10

### Added

- update plugin settings to encrypt sensitive fields and validate writable settings keys

### Fixed

- update plugin state service to include version in loaded plugin state

### Changed

- encrypt and mask plugin password-type settings like integrations ([#39](https://github.com/fromcode119/framework/pull/39))

## [0.1.41] - 2026-05-10

### Added

- add integration secret service for encrypting and decrypting sensitive data
- **frontend**: inject LCP image preload from theme prefetch data
- implement ThemeDataPrefetcher for server-side theme data prefetching
- update import paths for core module to use client-specific exports

### Performance

- target Chrome/Firefox/Safari >= 109/109/16 to eliminate polyfills

## [0.1.40] - 2026-05-05

### Added

- Enhance theme asset loading and improve performance

## [0.1.39] - 2026-05-02

### Added

- enhance plugin and theme installation with new archive handling and management capabilities

## [0.1.38] - 2026-05-01

### Added

- implement VersionComparisonService for enhanced version comparison logic across plugin components

## [0.1.37] - 2026-05-01

### Added

- add PluginFailureIsolationService for improved error handling during plugin registration

## [0.1.36] - 2026-04-30

### Added

- update asset caching and proxy handling in API routes, enhance theme asset loading
- **media**: add WebP optimization for images

## [0.1.35] - 2026-04-29

### Added

- implement rollback mechanism for failed plugin registration and add unregister method in PluginDefaultPageContractRegistryService

## [0.1.34] - 2026-04-29

### Added

- update plugin error handling and display in InstalledPluginsView and InstalledPluginCard chore: bump version to 0.1.34 in package.json
- implement PluginRuntimeWaitService for framework recovery and enhance plugin installation flow

### Fixed

- improve error handling during plugin initialization in LifecycleService

## [0.1.33] - 2026-04-29

_No user-facing changes._

## [0.1.32] - 2026-04-28

### Added

- update MarketplacePage to refresh installed plugins after installation and adjust useEffect dependencies
- remove Traefik label from gateway service in docker-compose
- update docker-compose to use COOLIFY_RESOURCE_UUID for Traefik network configuration
- update install route to use installOrUpdateFromMarketplace; add tests for MarketplaceRouter
- update INSTALL endpoint in AdminConstants and ApiConfig to use ApiPathUtils for path filling
- enhance MarketplacePage to display plugin features; add isFeatured, isVerified, and isTrending indicators
- adjust Traefik network configuration for gateway service; ensure proper network attachment for external requests
- add Traefik labels to services in docker-compose for network configuration
- enhance admin access control for system collections; add AsyncDataController and related interfaces; update docker-compose with new URLs
- add SectionCard and DayRangeToggle components; enhance PluginStatsList with new StatCard structure
- enhance session management with verification and improved unauthorized handling
- update marketplace URL handling and add new constants for marketplace operations
- integrate AI_ENABLED flag to control AI features across components
- add default public storage URL to request surface exclusion list
- update external proxy network name to 'coolify' in docker-compose
- add shims for React and admin components with updated .gitignore rules
- add path mapping for admin components in tsconfig
- add comments to pass-through wrappers for admin and react components
- update build script for incremental compilation and add database reference in tsconfig
- enhance plugin discovery and installation services
- implement chunked import and upload session for backups and themes
- support .tar.gz archives for plugin and theme uploads
- enhance backup import process with progress tracking and improved upload handling
- add import progress tracking to backup import functionality
- enhance backup import functionality with drag-and-drop support and error handling
- consolidate imports in system router and backup service for improved readability
- implement backup import functionality with file upload support
- add translateBaseUrlToApp method to ApplicationUrlUtils and export it in SDK index
- implement runtime location utilities for admin path handling and enhance favicon route with internal API fetching
- **api**: enhance theme asset management with public asset serving and routing
- Add context bridge hooks and provider for plugin management
- **api**: restructure middleware imports and add validation middleware
- **api**: add plugin and theme routers with CRUD operations
- add backup management for admin and database dialects
- **platform**: implement PlatformBrandingService for dynamic platform name resolution fix(env): update app version and codename in AppEnv fix(api): adjust default limit for settings collection in RESTController feat(updates): enhance UpdatesPage to display installed and latest versions accurately fix(sidebar): update branding in Sidebar component to use dynamic platform name
- **frontend**: replace unicode glyphs with inline SVG icons in StarterHero
- **frontend**: redesign StarterHero with dark Atlantis aesthetic
- **ai**: forge AI runtime updates ([#19](https://github.com/fromcode119/framework/pull/19))
- add docker-compose configuration for full-stack deployment (API, Admin, Frontend) ([#7](https://github.com/fromcode119/framework/pull/7))
- add LICENSE and SECURITY.md files with open source policy and security guidelines
- enhance API and assistant functionalities
- add ApplicationUrlUtils for URL handling and update related components
- enhance admin services and plugin loading with caching and improved error handling
- update collection utilities and components to support multi-target relations and enhance UI interactions
- enhance collection key utilities to support multiple relation targets and update related components
- enhance collection resolution logic to support global collections and aliases
- enhance collection editing with permalink functionality, normalize form data, and improve UI components
- add default page contract types and interfaces
- implement sidebar and settings layout components, add tests for sidebar and settings page, and enhance admin metadata service with system navigation metadata
- implement security settings fetching and error boundary for custom fields, enhance media relation field with improved URL handling
- add seed theme script, enhance collection services, and remove deprecated API routes
- update collection properties to use 'displayName' for consistency and add local build artifacts to .gitignore
- rename 'name' to 'displayName' in RecordVersions and Collection interfaces for consistency
- add theme assets prefix and webhooks route
- implement dynamic field options service and integrate with settings page
- enhance layout component with user ID checks and refs; update assistant preview tests for utility methods
- enhance collection management and API efficiency
- Enhance PluginsProvider with BrowserStateClient and plugin API management
- conditionally render create button in CollectionListHeader and enhance DatabaseFactory with new table methods
- update layout and field renderer for improved responsiveness and value handling
- refactor ContextRuntimeBridge and introduce builders for modular export handling
- implement SeederCallableResolver for improved seed module handling and add related tests
- add exports for admin module in SDK package
- add hook for rendering shortcodes in SystemController
- add EditPageSectionNav component for improved navigation in collection edit page refactor: update LayoutContent to use overflow-x-clip for better layout handling fix: enhance EditHeader with data attribute for easier targeting
- update slot names to use unprefixedSlug for consistency in collection handling
- implement client-safe stubs and exports for server-only packages in SDK and frontend
- add base classes for plugin/theme extension in index.ts
- add marketplace interfaces and types for plugins and themes
- Add IconToggleGroup component for customizable toggle options
- Implement core extension system with capability registry
- add forge routes and assistant controller integration
- Refactor admin page components to use AdminPageFooter for consistency
- enhance README with development instructions and script details
- update routing in LayoutContent and AdminPage to use Next.js router, enhance SQLite migration error handling, and improve environment variable management
- add frontend-only docker-compose configuration
- add export/import/reset functionality to PluginSettingsForm and integrate with PluginDetailPage
- **dialect**: apply toSnakeCase for column names in order and where clauses
- enhance PluginSettingsForm with state change handling and export/import functionality
- add resolveRelationValue function to handle relationship field values
- add collection queries and system shortcodes support
- **auth**: add password verification endpoint and controller logic
- enhance TagField component with dynamic placeholder and suggestions label
- add plugin dashboard components and dependency dialog
- enhance plugin management with loading states and not found handling
- add refresh functionality for plugin listing and enhance boolean parsing utility
- Enhance plugin management and settings UI
- update UI components for improved styling and consistency
- implement navigation utilities for path normalization and matching refactor: update Sidebar component to utilize new navigation utilities fix: change default group for NewPermissionPage from Management to Structure refactor: enhance CollectionEditPage layout and improve field rendering logic fix: adjust FieldRenderer component styles for better consistency fix: update Input and Select components to use rounded-xl styling feat: add drag-and-drop functionality to ArrayField component fix: update group names in API settings from system to Settings fix: refine data processing logic in DataProcessorService
- normalize view names and improve layout handling in various components
- remove FieldRenderer, MediaPicker, and PermalinkInput components
- add SystemController, MigrationManager, QueueAdapterFactory, and database dialects for MySQL and SQLite
- refactor and enhance scheduler service
- enhance routing and API handling with auto-detection and normalization improvements
- add routing settings page with permalink structure and homepage target configuration
- implement plugin system with registry and table resolution for enhanced database interactions
- improve content fetching and layout rendering in Home component
- enhance dynamic content fetching and add seed file support for themes and plugins
- enhance GlobalInitializer for browser compatibility and improve theme layout handling in various components
- add theme update checking functionality and enhance theme installation process
- enhance plugin installation process with loading state and optimistic UI updates
- add pluginSettings to various components and enhance media fetching logic
- enhance permalink handling with plugin settings and improve media picker functionality
- refactor getCollectionPrefix function for improved clarity and reuse in generatePreviewUrl
- add pluginSettings parameter to generatePreviewUrl and previewPrefixSettingsKey to Collection interface
- Enhance UI components and improve data handling
- **theme**: add additional external dependencies for theme build process
- **docker**: update docker-compose configuration for improved service networking and environment variable management feat(admin): refactor runtimeModules handling in ClientLayout for better performance feat(marketplace): enhance fetchCatalog method with error handling and logging feat(plugin): extend database method compatibility and improve Redis proxy handling in createPluginContext feat(icons): add Orbit icon to FrameworkIcons for expanded icon library feat(react): optimize PluginsProvider for stability and performance with new stable references
- **database**: add return types to PostgresDatabaseManager methods for improved type safety
- **api**: enhance getEvents method for improved SSE handling and connection stability
- **database**: enhance SQL query construction for dynamic where and orderBy conditions
- update package.json dependencies and enhance tsconfig references for marketplace and scheduler packages
- **types**: add 'group' field type and update Field interface to support nested fields
- **api**: enhance response structure in marketplace route and improve header flushing in SystemController
- **auth**: implement self-healing mechanism for expired tokens in AuthManager
- Implement Webhook Service for event handling and processing
- **cache**: enhance RedisCacheDriver with error handling and connection options
- add plugin settings management API and frontend integration
- enhance plugin build process with detailed logging for UI and backend compilation
- enhance plugin management with settings registration and retrieval functionality
- remove AuthContext export from index.ts to streamline component exports
- consolidate component exports in index.ts and update external dependencies in bin.ts
- integrate new scheduler package and enhance core functionality
- Add ArrayField component for handling array data in forms and update CORS setup for improved configuration
- Update FrameworkIcons with additional icons for enhanced UI representation
- Add Box and Download icons to FrameworkIcons for enhanced UI representation
- Add Terminal icon to FrameworkIcons for enhanced UI representation
- Enhance collection middleware with slug validation and improved error handling
- Refactor API and plugin handling for improved modularity and flexibility
- Enhance plugin management with auto-enable feature, improved error handling, and new API methods
- Enhance API versioning and expand plugin API methods for improved flexibility
- Rename page components for consistency and clarity across the admin app
- Enhance RuntimeService to auto-discover Lucide icons and update IconRegistry for unified access
- Update external module handling in CLI and RuntimeService for improved plugin support
- Enhance theme manager to support runtime module overrides
- Refactor system routes and add new services
- enhance user experience and functionality across various components
- Enhance plugin collection handling and UI components
- Refactor Input and StatCard components for improved styling and error handling
- Enhance plugin installation process with improved logging and state management
- Add translation support in CLI and frontend, enhance PluginContext for default values
- Update package dependencies and improve type safety in CLI and core packages
- Define Registry and RegistryCore interfaces for improved type safety in registry responses
- **cli**: add CLI command for running the Fromcode framework
- Enhance theme management with new methods for fetching, activating, installing, and deleting themes

### Fixed

- revert version number in package.json to 0.1.32
- **api**: use primary-key-aware upsert for collection creates
- **api**: upsert on collections with non-id primary key to prevent duplicate key errors
- **api**: allow setting read-only fields on record creation (POST)
- **frontend**: defeat light theme white bleed in StarterHero — lock html/body to dark, clear inner div backgrounds
- **frontend**: force dark background on StarterHero to defeat light theme overrides
- **frontend**: neutralize default starter branding ([#36](https://github.com/fromcode119/framework/pull/36))
- **deploy**: add docker-compose.yml at repo root for Coolify Public Repository detection ([#33](https://github.com/fromcode119/framework/pull/33))
- **runtime**: bind next production servers to 0.0.0.0 ([#30](https://github.com/fromcode119/framework/pull/30))
- **docker**: require react before ai build ([#29](https://github.com/fromcode119/framework/pull/29))
- **deploy**: add missing ai/mcp/create/plugins package.json to COPY layer ([#24](https://github.com/fromcode119/framework/pull/24))
- **deploy**: split builder into 3 separate RUN steps, reduce heap to 768 MB ([#23](https://github.com/fromcode119/framework/pull/23))
- **deploy**: add shared builder stage to serialize all tsc/next builds ([#22](https://github.com/fromcode119/framework/pull/22))
- **ai**: add index signature to ToolMetadata to satisfy McpToolDefinition ([#21](https://github.com/fromcode119/framework/pull/21))
- **deploy**: remove base-stage tsc -b, let each target compile its own deps ([#15](https://github.com/fromcode119/framework/pull/15))
- **deploy**: use ./node_modules/.bin/tsc -b in Dockerfile base stage (tsc not in shell PATH) ([#14](https://github.com/fromcode119/framework/pull/14))
- **deploy**: pass NEXT_PUBLIC_API_URL build arg per target, fix base stage build, add postgres password default ([#13](https://github.com/fromcode119/framework/pull/13))
- prevent TypeError when ContextHooks data URL module evaluates before bridge
- restore SDK exports in context-runtime-bridge for proper module resolution
- update registerCoreCollection call for _system_record_versions to use collection property
- correct import path for HeadInjection and SSRContext in index.ts
- update API_URL variable in environment files and adjust package.json main entry points
- export parseBoolean from core and complete APIServer.bootstrap() plugin initialization
- update resolveAlias paths in next.config.js for admin and frontend packages
- update import path for routes in next-env.d.ts files
- resolve near 'ilike' syntax error on SQLite by using dialect-aware LIKE operator
- include admin and frontend dependencies in package.json and remove from create script
- resolve duplicate column error in database dialects and ensure core collections are synced
- **admin/frontend**: move tailwindcss/postcss/autoprefixer to dependencies for local execution
- **admin**: remove all TS syntax from icons.tsx and add self-transpilation to next config
- **admin**: move typescript to dependencies and soften icons syntax for better compatibility
- **admin**: fix vitest setup path and improve revert script
- **admin**: restore @/ aliases with webpack resolution fix for consumer apps
- **admin**: relativize all internal aliases for consumer compatibility
- **api**: update tsconfig and jest config for new core shared export
- **core**: remove node-only request-context from shared module and mock async_hooks in browser
- **admin**: move core imports to shared to avoid browser bundle pollution
- explicit shared entry point for core to prevent side-effect leaks to browser
- remove tsconfig extends in admin/frontend to fix runtime compilation
- **create**: include typescript and react types in scaffold to prevent next.js auto-install 404s
- restrict plugin/them search to project root unless in dev mode
- **create**: clarify authentication instructions in scaffolder
- **build**: resolve casing inconsistencies and fix frontend turbopack config
- **build**: use centralized build strategy & fix envPaths reference
- regenerate lock file after @fromcode→@fromcode119 rename; bump CI to Node 22
- display dynamic source unavailable message in TagField component
- update import path for routes type definitions in next-env.d.ts

### Changed

- update plugin logic after uploading
- update media with image optimization
- update import map and jsx
- change seeder path
- update theme seed errors
- updating system settings
- updating theme manager, system store and plugin manager
- updating theme page
- add log sanitaize
- adding COOLIFY_RESOURCE_UUID
- Feature/atlantis branding refresh ([#37](https://github.com/fromcode119/framework/pull/37))
- Feature/atlantis branding refresh ([#35](https://github.com/fromcode119/framework/pull/35))
- Fix/dockerfile split build steps ([#34](https://github.com/fromcode119/framework/pull/34))
- Fix/dockerfile split build steps ([#32](https://github.com/fromcode119/framework/pull/32))
- Fix/dockerfile split build steps ([#31](https://github.com/fromcode119/framework/pull/31))
- Fix/dockerfile split build steps ([#28](https://github.com/fromcode119/framework/pull/28))
- Fix/dockerfile split build steps ([#27](https://github.com/fromcode119/framework/pull/27))
- Fix/dockerfile split build steps ([#26](https://github.com/fromcode119/framework/pull/26))
- Fix/dockerfile split build steps ([#25](https://github.com/fromcode119/framework/pull/25))
- Fix/ai build via api reference ([#18](https://github.com/fromcode119/framework/pull/18))
- Fix/build ai pkg and datetime migration ([#17](https://github.com/fromcode119/framework/pull/17))
- Fix/dockerfile build memory limits ([#16](https://github.com/fromcode119/framework/pull/16))
- Deploy/coolify env simplify ([#12](https://github.com/fromcode119/framework/pull/12))
- Deploy/coolify env simplify ([#11](https://github.com/fromcode119/framework/pull/11))
- Deploy/coolify production ([#10](https://github.com/fromcode119/framework/pull/10))
- Fix/update compose ([#9](https://github.com/fromcode119/framework/pull/9))
- Add Buy Me a Coffee funding option
- Refactor database migrations to use BaseMigration class
- Refactor SDK and Core Dependencies
- Release v2.0.0 - Class-Based Architecture Migration Complete
- Fix schema sync for core collections (0.1.19)
- Make frontend default in scaffolding (0.1.18)
- Synchronize version to 0.1.17 and update bump script
- Add GITHUB_TOKEN to environment variables for package publishing step
- Enhance CI workflows with workflow_dispatch triggers and set LOG_LEVEL for testing; improve import fixer to handle directory paths and provide feedback on fixes
- Add import fixing script and update package.json exports for consistency
- Update workspace references to @fromcode119 in Dockerfile, docker-compose, and vitest config; implement shutdown methods in APIServer, PluginManager, and SchedulerService
- Update workspace references in Docker Compose files to use @fromcode119
- Refactor imports and enhance API server error handling; add API version prefix to tests
- Fix url-generation and media-controller test failures
- Remove duplicate action bar from plugin-settings-form
- Fix plugin-settings-form tests: add usePlugins mock and missing UI elements
- Fix missing @fromcode119/plugins module mapping in API jest config
- Fix plugin-settings-form tests and integration test DATABASE_URL issue
- Rename all PascalCase source files to lowercase for consistent naming
- Fix TypeScript module resolution errors due to case sensitivity on Linux
- Add pending work documentation for upcoming phases and features
- Refactor marketplace plugin and theme types
- Restored Core features: Collection Management UI and Runtime ESM Bridge System. Updated CLI to bundle icons for stability.

## [0.1.1] - 2026-01-28

### Added

- Add GitHub Actions workflow for automatic version tagging and update package version to 0.1.1
- Update package.json for @fromcode/api with dependencies and scripts
- Refactor BackupService and SystemUpdateService to dynamically determine project root for improved path handling
- Exclude hidden git files from update process in moveDir method
- Implement smart update mechanism with file hash comparison
- Refactor dialog components to use Portal for improved accessibility and styling
- Enhance plugin and theme management
- update API endpoint to include versioning in the URL

### Changed

- Refactor code structure for improved readability and maintainability. Adding redis, queue, system settings and maintenance mode
- Init commit with framework

---

<!-- Entries below predate the tagged v0.x releases and were written by hand. -->

## [2.0.0] - 2026-03-08

### 🎉 Major Release: Class-Based Architecture

This release completes the migration to a fully class-based architecture, removing all deprecated function-based patterns. This is a **breaking change** for code still using legacy APIs.

### 💥 BREAKING CHANGES

#### Removed Router Setup Functions
All legacy router setup functions have been removed. Use Router classes instead:

**Removed**:
- `setupAuthRoutes()` → Use `AuthRouter` class
- `setupPluginRoutes()` → Use `PluginRouter` class  
- `setupThemeRoutes()` → Use `ThemeRouter` class
- `setupSystemRoutes()` → Use `SystemRouter` class
- `setupMediaRoutes()` → Use `MediaRouter` class
- `setupCollectionRoutes()` → Use `CollectionRouter` class
- `setupBaseCollectionRoutes()` → Use `BaseCollectionRouter` class

**Migration**:
```typescript
// ❌ OLD (removed in v2.0)
import { setupAuthRoutes } from '@fromcode119/api/routes';
app.use('/auth', setupAuthRoutes(manager, auth));

// ✅ NEW (v2.0+)
import { AuthRouter } from '@fromcode119/api/routes';
const authRouter = new AuthRouter(authController, authManager);
app.use('/auth', authRouter.router);
```

#### Removed Middleware Factories
Middleware factory functions have been removed. Use Middleware classes instead:

**Removed**:
- `createCollectionMiddleware()` → Use `CollectionMiddleware` class

**Migration**:
```typescript
// ❌ OLD (removed in v2.0)
import { createCollectionMiddleware } from '@fromcode119/api/middlewares';
const middleware = createCollectionMiddleware(manager);

// ✅ NEW (v2.0+)
import { CollectionMiddleware } from '@fromcode119/api/middlewares';
const middleware = new CollectionMiddleware(manager);
router.get('/:slug', middleware.middleware(), handler);
```

#### Removed Admin Utility Functions
Loose utility functions have been removed. Use `AdminServices` singleton instead:

**Removed**:
- `formatSize()` → `AdminServices.getInstance().formatter.formatSize()`
- `formatDate()` → `AdminServices.getInstance().formatter.formatDate()`
- `formatCurrency()` → `AdminServices.getInstance().formatter.formatCurrency()`
- `resolveMediaUrl()` → `AdminServices.getInstance().media.resolveMediaUrl()`
- `resolveLabelText()` → `AdminServices.getInstance().localization.resolveLabelText()`
- `capitalize()` → `AdminServices.getInstance().string.capitalize()`
- `normalizeString()` → `AdminServices.getInstance().string.normalize()`
- `getNestedValue()` → `AdminServices.getInstance().validation.getNestedValue()`
- `evaluateCondition()` → `AdminServices.getInstance().validation.evaluateCondition()`

**Migration**:
```typescript
// ❌ OLD (removed in v2.0)
import { formatSize, formatDate, resolveMediaUrl } from '@fromcode119/admin';

const size = formatSize(1024);
const date = formatDate(new Date());
const url = resolveMediaUrl('/path/to/image.jpg');

// ✅ NEW (v2.0+)
import { AdminServices } from '@fromcode119/admin';

const services = AdminServices.getInstance();
const size = services.formatter.formatSize(1024);
const date = services.formatter.formatDate(new Date());
const url = services.media.resolveMediaUrl('/path/to/image.jpg');
```

#### Deleted Files
The following legacy files have been removed from the codebase:

**API Package**:
- `packages/api/src/routes/auth.ts` (duplicate of AuthRouter)
- `packages/api/src/routes/themes.ts` (duplicate of ThemeRouter)
- `packages/api/src/routes/system.ts` (duplicate of SystemRouter)
- `packages/api/src/routes/media.ts` (duplicate of MediaRouter)
- `packages/api/src/routes/collections.ts` (duplicate of CollectionRouter)
- `packages/api/src/middlewares/collection.ts` (duplicate of CollectionMiddleware)

These were legacy duplicates maintained for backward compatibility. All functionality exists in the class-based equivalents.

### ✨ Added

#### AdminServices Singleton
- Centralized access to all admin utilities via `AdminServices.getInstance()`
- Namespaced services: `formatter`, `string`, `media`, `validation`, `localization`  
- Full TypeScript auto-complete support
- Consistent API across all utility functions

#### CoreServices Singleton
- Centralized access to all core services via `CoreServices.getInstance()`
- Services: `collection`, `localization`, `menu`, `content`
- Singleton pattern ensures consistent service instances

### 🔧 Changed

#### Architecture Improvements
- **Router Classes**: All routes now use class-based Router pattern with dependency injection
- **Middleware Classes**: All middleware now extends `BaseMiddleware` with typed `handle()` method
- **Service Singletons**: All utilities consolidated into service classes with singleton access

#### Code Quality
- **175 service tests** passing with 100% success rate (156ms execution)
- **Zero deprecated code** remaining in framework packages
- **150+ lines of deprecated code removed** across 16 files
- **6 duplicate legacy files deleted** (all functionality preserved in classes)

### 📚 Documentation

- Added comprehensive the class-based architecture migration guide with step-by-step examples
- Updated DEPRECATION_AUDIT.md with Phase 8 completion details
- Added JSDoc deprecation notices to all removed functions (in v1.x releases)

### 🐛 Fixed

- Fixed orphaned return statement in `CollectionRouter.ts` after deprecated function removal
- Improved TypeScript types for all Router and Middleware classes
- Standardized error handling across all service classes

### ⚡ Performance

- Reduced `packages/admin/lib/utils.ts` from 154 lines → 27 lines (83% reduction)
- Eliminated duplicate code across 6 legacy files
- Improved bundle size through tree-shaking (unused legacy functions removed)

### 🔒 Security

- No security-related changes in this release
- All security standards maintained from v1.x

### 🧪 Testing

- ✅ 175/175 service tests passing (100% pass rate)
- ✅ LocalizationService: 31 tests  
- ✅ MenuService: 33 tests  
- ✅ ContentService: 48 tests  
- ✅ CoreServices: 23 tests  
- ✅ CollectionService: 40 tests
- Architecture check passes with no new violations

### 📦 Migration Statistics

**Phase 8 Summary** (Complete Deprecation Removal):
- **Files Modified**: 30+ files across framework
- **Files Deleted**: 6 legacy route/middleware files
- **Functions Removed**: 16 deprecated functions (6 router + 1 middleware + 9 admin utilities)
- **Lines Removed**: ~150 lines of deprecated code
- **Tests Passing**: 175/175 (100%)
- **Breaking Changes**: Well-documented with migration paths
- **Plugins Migrated**: 7 plugins

### 🚀 Upgrade Guide

**For Plugin Developers**:
1. Read the class-based architecture migration guide
2. Replace all router setup functions with Router classes
3. Replace all middleware factories with Middleware classes  
4. Replace all loose utilities with `AdminServices.getInstance()`
5. Run tests to verify migrations
6. Update plugin version to v2.0.0 compatibility

**For Theme Developers**:
- No breaking changes for themes in v2.0
- Themes using AdminServices are unaffected

**Estimated Migration Time**:
- Small plugin (1-5 files): 15-30 minutes
- Medium plugin (5-15 files): 1-2 hours  
- Large plugin (15+ files): 2-4 hours

### 📋 Checklist for v2.0 Migration

- [ ] Replace all `setupAuthRoutes()` → `AuthRouter` class
- [ ] Replace all `setupPluginRoutes()` → `PluginRouter` class
- [ ] Replace all `setupThemeRoutes()` → `ThemeRouter` class
- [ ] Replace all `setupSystemRoutes()` → `SystemRouter` class
- [ ] Replace all `setupMediaRoutes()` → `MediaRouter` class
- [ ] Replace all `setupCollectionRoutes()` → `CollectionRouter` class
- [ ] Replace all `createCollectionMiddleware()` → `CollectionMiddleware` class
- [ ] Replace all `formatSize()` → `AdminServices.getInstance().formatter.formatSize()`
- [ ] Replace all `formatDate()` → `AdminServices.getInstance().formatter.formatDate()`
- [ ] Replace all `resolveMediaUrl()` → `AdminServices.getInstance().media.resolveMediaUrl()`
- [ ] Run full test suite
- [ ] Check for TypeScript compilation errors
- [ ] Verify plugin functionality in development

### 🔗 Links

- Migration Guide (removed — see git history)
- Deprecation Audit
- [Contributing & Architecture Rules](./CONTRIBUTING.md)

---

## [1.0.31] - 2026-03-07

### ⚠️ Deprecation Notices (Pre-v2.0)

Added deprecation warnings for all legacy functions scheduled for removal in v2.0:

- Router setup functions deprecated (use Router classes)
- Middleware factory functions deprecated (use Middleware classes)
- Loose utility functions deprecated (use AdminServices/CoreServices)

### Added

- AdminServices singleton for centralized utility access
- CoreServices singleton for centralized service access
- Comprehensive JSDoc deprecation notices
- DEPRECATION_AUDIT.md tracking document

---

## [1.0.0] - 2026-01-15

Initial release of the Fromcode framework.

### Features

- Plugin architecture with hot-reloading
- Theme system with dynamic loading
- The first domain plugins
- Admin dashboard with React + Next.js
- PostgreSQL database with Drizzle ORM
- API server with Express
- Docker-based development environment

---

## Legend

- 💥 Breaking Change
- ✨ New Feature
- 🔧 Changed/Improved
- 🐛 Bug Fix
- ⚡ Performance
- 🔒 Security
- 📚 Documentation
- 🧪 Testing
- 📦 Dependencies
