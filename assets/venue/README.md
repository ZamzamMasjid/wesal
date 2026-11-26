# Venue photographs

Source files for the landing page gallery. They are compressed copies (long edge
2000px, JPEG q82) of the owner's photographs; the originals stay outside the
repository.

`npm run media:import` copies these files to the upload volume and records them
in `media_asset` in the order listed in `scripts/venue-media.json`. The first
entry becomes the hero; the next seven fill the gallery mosaic; the rest sit
behind the `+N photos` tile.

Re-run with `--replace` to clear the media library first. To change the order,
the alt text or the hero, edit the manifest and run the command again. In
production, use the owner's media editor instead.
