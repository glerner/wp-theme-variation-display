=== Theme Variation Display by WP Website Mastery ===
Contributors: WP Website Mastery
Tags: site editor, global styles, style variations, palette, colors, fonts, theme.json
Requires at least: 6.7
Tested up to: 6.9
Requires PHP: 8.0
Stable tag: 0.1.1
License: GPLv3 or later
License URI: https://www.gnu.org/licenses/gpl-3.0.html
Donate link: https://wp-website-mastery.com/donate

A preview of WordPress Style Variations (colors & fonts) inside the Site Editor, with quick Select/Preview actions. Works even if the Theme Variation uses CSS variables.

== Description ==

WPWM Theme Variation Display lists available Style Variations for the active theme and renders a compact, variable‑accurate preview for each card:

- Shows swatches for the variation’s palette colors, with color labels.
- Font samples pulled from the variation’s settings when available.
- Preview the Variations, and then Select your preference.

This helps theme authors and site builders evaluate multiple variations quickly without opening each one.

== Features ==

- Uses each variation’s color numbers or CSS variables for accurate color display.
- Contrast‑aware swatch labels (including semi‑transparent colors using RGBA) for legibility.
- Responsive card layout that wraps to your viewport.

> Note: This plugin does not modify your theme or content. It is a visual aid inside Appearance → Theme Variation Display.

Also see my Color Palette Generator (https://wp-website-mastery.com/color-palette) which generates Color Palettes as Theme Variations, with every color adjusted for proper contrast against your near-black or near-white text color, and adds light mode and dark mode to any Block Theme.

The Color Palette Generator and Theme Variation Display plugins work together to create a complete solution for theme authors and site builders.

They are part of my upcoming course, "WordPress Websites: from Overwhelm to Mastery", at WP Website Mastery (https://wp-website-mastery.com).

== Installation ==

1. Upload the plugin folder to `/wp-content/plugins/wpwm-theme-variation-display/` or install via the Plugins screen.
2. Activate the plugin via the Plugins screen.
3. Open Appearance → Theme Variation Display.

== Frequently Asked Questions ==

= Does this change my theme settings? =
No. It renders previews. “Select” applies the chosen variation via existing Site Editor APIs when available; “Preview (temporary)” does not save changes.

= Why do some palettes show fewer labels? =
Only colors defined by the variation are displayed. Base theme colors that are not redefined are intentionally omitted to avoid confusion.

= Does it support transparent colors? =
Yes. RGBA backgrounds are composited against the card background before text contrast is calculated.

== Screenshots ==

1. Variation cards with stripe swatches and font samples.
2. Detail of contrast‑aware labels over swatches.

== Changelog ==

= 0.1.0 =
- Initial public release.

== Upgrade Notice ==

= 0.1.0 =
Initial release.
