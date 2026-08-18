# Email templates

One folder per language. `en/` is the source of truth and must contain every template; a language
folder holds only the files that have actually been translated.

```
templates/
  en/                       ← every template lives here
    file-share.html
    file-share.txt
    file-share.subject.txt
  bg/                       ← only what has been translated
    file-share.html
    file-share.txt
    file-share.subject.txt
```

## Adding a language

Copy `en/` to a new folder named for the language code (`de/`, `fr/`, …) and translate the files. You
can translate one template at a time — anything missing falls back to `en/`, so a half-translated
language still sends readable email rather than failing.

Region suffixes are ignored: a recipient set to `bg-BG` reads `bg/`.

## Which language a recipient gets

The person's own `people.preferred_locale` when the platform knows them, otherwise the platform's
default locale. Recipients of a shared file often have no account, so their preference is the only
per-person signal available.

## Placeholders

`{{name}}` is substituted; `{{#if name}}…{{/if}}` includes a block only when the value is present. Keep
the placeholder names exactly as they appear in `en/` — they are supplied by code, not by the
translator.
