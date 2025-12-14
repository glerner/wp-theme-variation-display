# WPWM Theme Variation Display

**Contributors:** lernerconsult \
**Tags:** site editor, global styles, style variations, palette, colors, fonts, theme.json \
**Requires at least:** 6.7 \
**Tested up to:** 6.8.3 \
**Requires PHP:** 8.0 \
**Stable tag:** 0.1.0 \
**License:** GPLv3 or later \
**License URI:** https://www.gnu.org/licenses/gpl-3.0.html \
**Donate link:** https://wp-website-mastery.com/donate

A preview of WordPress Style Variations (colors & fonts) installed on the theme. Use instead of the Site Editor's Browse Styles.

Installs in Appearance → Theme Variation Display

## Description

WPWM Theme Variation Display lists available Style Variations for the active theme and renders a compact, variable‑accurate preview for each card:

- Will show every color in the Style Variation, and the color name (from the theme.json file).
- Font samples pulled from the variation’s settings, when available.
- Will show a "sample page" of the colors, if the colors follow recognized names.
- Works even if the Theme Variation uses CSS variables.

Click the "Select" button to apply the variation to the site.

This helps theme authors and site builders evaluate multiple variations quickly without opening each one.

## Features

- Uses each variation’s own CSS variables for accurate color display.
- Contrast‑aware swatch labels (including semi‑transparent colors using RGBA) for legibility.
- Responsive card layout that wraps to your viewport.

> Note: This plugin does not modify your theme or content. It is a visual aid inside Appearance → Theme Variation Display.

My Color Palette Generator (https://wp-website-mastery.com/color-palette) generates Color Palettes as Theme Variations, with CSS light-dark().

The Color Palette Generator and Theme Variation Display plugins work together to create a complete solution for theme authors and site builders.

They are part of my upcoming course, "WordPress Websites: from Overwhelm to Mastery", at WP Website Mastery (https://wp-website-mastery.com).

## Installation

1. Upload the plugin folder to `/wp-content/plugins/wpwm-theme-variation-display/` or install via the Plugins screen.
- Install the GitHub Updater https://github.com/afragen/github-updater
- Use https://github.com/wpwm/wpwm-theme-variation-display
2. Activate the plugin via the Plugins screen.
3. Open Appearance → Theme Variation Display.

## Frequently Asked Questions

### Does this change my theme settings?

No. It renders previews. “Select” applies the chosen variation via existing Site Editor APIs when available; “Preview” does not save changes.

### Why do some palettes show fewer labels?

Only colors defined by the variation are displayed. Base theme colors that are not redefined are intentionally omitted to avoid confusion.

### Does it support transparent colors?

Yes. RGBA backgrounds are composited against the card background before text contrast is calculated.

## Screenshots

### 1. Variation cards with stripe swatches and font samples.

[missing image]

### 2. Detail of contrast‑aware labels over swatches.

[missing image]


## Changelog

### 0.1.0

- Initial public release.

## Upgrade Notice

### 0.1.0

Initial release.
