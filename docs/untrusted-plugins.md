# Running plugins you do not fully trust

The failure every site owner has seen on other platforms: someone installs a plugin, the plugin is
malicious or simply broken, and within hours the site sends spam, every other site on the same server
is defaced, and the hosting account belongs to someone else. This guide is about making sure that
cannot happen on an Atlantis deployment — what the platform does on its own, what you as the operator
must do, and what no platform can do for you.

The goal is simple to state: **a bad plugin breaks at most the site that installed it.** It must not
reach other sites, the platform, the server, or the outside world.

## Two kinds of plugin, two levels of trust

| | Platform plugins | Plugins a site uploads |
|---|---|---|
| Installed by | A platform administrator | A site's own administrator |
| Typical source | Your own repositories, a marketplace you trust | Anyone the site owner hired or downloaded from |
| Treated as | Reviewed code — part of the platform | The least trusted code on the server |
| Default | Available | **Uploads are off** until a platform admin turns them on |

Everything below about "site plugins" applies to the second column. A platform plugin is code you
chose to run with the platform's privileges: review it as you would any change to the platform itself.

## What the platform does on its own

None of this needs configuring; it holds for every plugin a site uploads.

**It cannot reach other sites or the platform.**

- Every plugin runs in its own operating-system process, under its own user, with an empty
  environment — no database password, no API keys, no secrets of any kind.
- A site's plugin may call only a short list of SDK methods. It has no database access, no access to
  people or users, no email, no cache or queue beyond its own keys, and no way to call other plugins.
  Everything else is refused by the host before it runs.
- Every database call the platform makes for it is bound to its own site, and PostgreSQL row-level
  security enforces the same boundary underneath the application.
- It can import only the public SDK — never the framework's internals, by package name or by path.

**It cannot send anything out.**

- Its process has no network of its own: the kernel refuses every connection it opens, DNS included.
  It cannot send email, call home, or join a botnet.
- When the platform does make an HTTP request on a plugin's behalf, the request may reach only public
  internet addresses — never the database, the cache, the platform's own API, or a cloud provider's
  metadata address — checked on the address the connection actually uses and again on every redirect.

**It cannot get between its own site and that site's visitors.**

- It answers only on its own routes. It cannot register middleware, so it never sees a request meant
  for anything else on its site — the sign-in form, checkout, account pages or another plugin.
- It hears what happens on its site but cannot change it, and does not learn who it happened to. When
  the platform or another plugin raises an event (an order about to be saved, a page about to render,
  someone signing in), a site's plugin receives a copy with every secret (passwords, tokens, keys,
  session ids) and every piece of personal data (emails, phone numbers, people's names, street
  addresses, postcodes, dates of birth, IP addresses, tax and bank numbers) replaced by `[redacted]`.
  Its answer is discarded, and the platform does not wait for it, so a slow or failing plugin cannot
  hold up the site. Only for events it raises itself (`<its-slug>:…`) does its answer count.
- It puts no code into the site's pages. No storefront script, stylesheet, `<head>` entry or root file
  (`/promo.txt`) — the upload is refused, and the platform strips them even from one already
  installed. Code in the site's own pages could read everything a visitor types and hand it to the
  plugin's routes to collect later; no browser policy can stop that, because those routes are on the
  same site.
- It appears on the storefront only as a **widget**: a frame in a theme slot, declared in its
  manifest, showing one of its own routes:

  ```json
  "ui": { "widgets": [{ "slot": "product.after", "path": "/widget", "height": 240, "title": "Reviews" }] }
  ```

  The frame is sandboxed into an origin of its own. It cannot see or touch the page around it, the
  visitor's cookies or storage, or anything typed outside the widget, and it is not told which page it
  is on. It may call its own routes, without the visitor's credentials. Widgets appear only on the
  storefront, never in the admin.
- It serves a page only into its widget. Opened directly, an HTML (or SVG or XML) answer from a
  site's plugin is refused, so it cannot put a sign-in or payment form on the site's own address.

**It cannot take over the admin or its visitors.**

- It cannot inject scripts into the admin or the storefront: the admin runs under a strict
  Content-Security-Policy, and anything a site plugin serves is sandboxed and stripped of cookies and
  credentials. Root files any plugin serves (`llms.txt`, a feed) are sandboxed too.
- It cannot write to another site's files, another plugin's files, or the platform's.

**It cannot exhaust the server.** Each limit is a setting under **Settings → Infrastructure → Plugin
Isolation**, with the default shown in the field:

| Limit | Default | What happens past it |
|---|---|---|
| CPU | 50% of one core, averaged over 30 s | Stopped and restarted |
| Memory | 384 MB in total, heap and everything outside it | Stopped and restarted |
| Disk | 100 MB, or 100,000 files, everywhere its user can write | Stopped and restarted |
| Processes and threads | 64 | The kernel refuses more |
| Time per request | 30 s | The request fails and the process restarts |

A plugin stopped three times in a row is switched off, and the reason is shown to the site's admin on
its Plugins page. Opening that page does not restart it; uploading a fixed version does. A plugin's
manifest may lower its own limits, never raise them.

**It cannot slip code into the build.** When the platform builds plugins and themes from a Git
repository, it builds only commits GitHub itself merged through a pull request. A commit pushed around
review — with a leaked token, or by rewriting a branch — is refused and the admin says why.

## What you must do

The platform's isolation runs on top of your server's kernel. The kernel is the one thing every
plugin process shares, so it is where most of the remaining risk lives.

1. **Keep the server's kernel and packages patched.** Turn on automatic security updates
   (`unattended-upgrades` on Debian and Ubuntu) and reboot when a kernel update asks for it. An
   unpatched kernel is the most common way out of any container.
2. **Run site plugins under a sandboxing runtime.** Site plugins run in their own container,
   `site-extension-host`, which has no network and holds only the sites' plugins and their data. On a
   server where you can install [gVisor](https://gvisor.dev), run that container under it: gVisor puts a
   user-space kernel between the plugin and yours, so a kernel flaw the plugin finds is a flaw in the
   sandbox, not on your server. Register the runtime with Docker with `--host-uds=all` (the plugins and
   the API talk over Unix sockets) and set `SITE_PLUGIN_RUNTIME` to its name in the deployment's `.env`.
   The plugin's page in the admin says which kernel its sandbox runs on, so you can see that it worked.
3. **Leave site uploads off unless a site needs them.** They are off by default. Turn them on for the
   deployment only when you mean to host plugins your customers write.
4. **Install platform plugins only from sources you trust.** A platform plugin is not held to the limits
   above and is not sandboxed. Treat installing one like merging code into the platform.
5. **Protect the repositories you build from.** Require pull requests and review on the default branch,
   restrict who can merge, and keep "Build commits not merged through GitHub" off.
6. **Give every credential the least it needs.** Database roles, API keys and payment keys belong to the
   platform's settings, never to a plugin; rotate any that may have been exposed.
7. **Keep backups and test restoring them.** Isolation limits what a bad plugin can reach; a backup is
   what recovers the site it was installed on.
8. **Watch the logs.** A plugin stopped for a limit, a refused SDK call, or a refused network address is
   logged with the plugin's name. Repeated refusals from one plugin are worth a look.

## What no platform can do for you

- **A plugin can still misbehave inside its own widget and its own data.** It can show wrong or
  offensive content in its widget, ask visitors to type things into it, or lose the settings it keeps.
  It cannot reach the rest of the site's pages, its customers' details or anyone's sign-in. Install
  site plugins you can account for, and keep backups per site.
- **Code you merged is code you run.** Build provenance proves GitHub merged a commit, not that the
  commit is safe. Review is the control.
- **Isolation is not a substitute for patching.** Users, containers and even gVisor have had flaws. Each
  layer narrows what one flaw can do; an unpatched server undoes all of them.
- **Limits act within seconds, not instantly.** A plugin can briefly go past a disk or CPU limit before
  it is stopped; the overshoot is bounded and cleaned up, but it is not zero.

See also: [Configuration](configuration.md) for every setting, and [SECURITY.md](../SECURITY.md) for
reporting a vulnerability.
