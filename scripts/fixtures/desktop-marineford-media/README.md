# Generated media transport fixtures

These tiny synthetic files live under `scripts/fixtures` for media transport QA.
WAV and blue MP4/WebM were generated in the same-session Android package QA.
WOFF was generated with FontTools from `.notdef`, space and a triangle A glyph.
Its family is `PO Media Fixture`.

`desktop_marineford_media_qa.js` checks their SHA-verified local transport, MIME,
HEAD and Range behavior. Current Marineford uses images, WebAudio and system
fonts. Its package builder enumerates programme and media under `public`.
