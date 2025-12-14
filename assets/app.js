/* WPWM Theme Variation Display (colors + fonts) */
(function () {
  console.log('WPWM-TVD: Script loaded', new Date().toISOString());

  const cfg = (window.__WPWM_TVD__) || {};
  const apiBase = cfg.pluginRestBase;

  console.log('WPWM-TVD: Config', cfg);

  // Constants
  const MAX_FONT_SAMPLES = 2;
  const DEFAULT_WHITE_RGB = [255, 255, 255];
  const DEFAULT_BLACK_RGB = [0, 0, 0];
  const DEFAULT_LIGHT_TEXT = '#000';
  const DEFAULT_DARK_TEXT = '#fff';

  // Global state
  let allVariations = [];
  let currentVariationSlug = null;

  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text) n.textContent = text;
    return n;
  }

  // --- Color helpers for reliable contrast decisions ---
  function parseRgbString(s) {
    const m = (s || '').match(/rgba?\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?/i);
    if (!m) return null;
    const r = parseInt(m[1], 10), g = parseInt(m[2], 10), b = parseInt(m[3], 10);
    const a = typeof m[4] !== 'undefined' ? Math.max(0, Math.min(1, parseFloat(m[4]))) : 1;
    return [r, g, b, a];
  }
  function rgbToLuminance([r, g, b]) {
    const [sr, sg, sb] = [r / 255, g / 255, b / 255];
    const lin = [sr, sg, sb].map(v => v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
    return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
  }
  function contrastRatioRGB(a, b) {
    const La = rgbToLuminance(a);
    const Lb = rgbToLuminance(b);
    const bright = Math.max(La, Lb);
    const dark = Math.min(La, Lb);
    return (bright + 0.05) / (dark + 0.05);
  }
  function colorStringToRgb(colorStr) {
    // Try hex
    const colorString = (colorStr || '').trim();
    if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(colorString)) {
      const hex = colorString.length === 4
        ? '#' + colorString[1] + colorString[1] + colorString[2] + colorString[2] + colorString[3] + colorString[3]
        : colorString;
      const n = parseInt(hex.slice(1), 16);
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    }
    // Else let the browser resolve it
    const tmp = document.createElement('div');
    tmp.style.color = colorString;
    document.body.appendChild(tmp);
    const rgb = getComputedStyle(tmp).color;
    tmp.remove();
    const parsed = parseRgbString(rgb);
    return parsed ? parsed.slice(0, 3) : DEFAULT_BLACK_RGB;
  }

  function compositeRGBAoverRGB(fgRGBA, bgRGB) {
    const [fr, fg, fb, fa = 1] = fgRGBA;
    const [br, bgGreen, bb] = bgRGB;
    const a = fa;
    const outR = Math.round(fr * a + br * (1 - a));
    const outG = Math.round(fg * a + bgGreen * (1 - a));
    const outB = Math.round(fb * a + bb * (1 - a));
    return [outR, outG, outB];
  }

  function whenStylesScreenReady(cb) {
    console.log('WPWM-TVD: Waiting for Site Editor styles screen...');
    const { subscribe } = wp.data;
    let attempts = 0;
    const maxAttempts = 100; // Try for ~10 seconds

    const unsub = subscribe(() => {
      attempts++;

      // Try multiple possible selectors for different WordPress versions
      const host = document.querySelector(
        '.edit-site-style-variations, ' +
        '.edit-site-style-variations__list, ' +
        '.edit-site-sidebar__panel-tabs, ' +
        '.edit-site-global-styles-sidebar, ' +
        '.interface-complementary-area'
      );

      if (host) {
        console.log('WPWM-TVD: Site Editor styles screen found!', host.className);
        unsub();
        cb(host);
      } else if (attempts >= maxAttempts) {
        console.log('WPWM-TVD: Site Editor styles screen not found after', attempts, 'attempts');
        unsub();
      }
    });
  }

  async function fetchVariations() {
    try {
      // apiFetch expects a path relative to /wp-json, e.g. 'wpwm-tvd/v1/variations'
      let relBase = 'wpwm-tvd/v1';
      try {
        const u = new URL(apiBase, window.location.origin);
        // Strip everything up to and including '/wp-json/'
        relBase = u.pathname.replace(/^\/?/, '').replace(/^.*?wp-json\//, '');
      } catch (_e) { /* fallback to default relBase */ }
      const path = relBase.replace(/\/?$/, '') + '/variations';
      const res = await window.wp.apiFetch({ path });
      return res.variations || [];
    } catch (e) { console.error('WPWM-TVD fetch error', e); return []; }
  }

  async function getCurrentVariation() {
    try {
      // Try Site Editor API first (only available in Site Editor context)
      if (window.wp && window.wp.data && window.wp.data.select) {
        const coreSel = window.wp.data.select('core');
        if (coreSel && coreSel.getEditedEntityRecord) {
          const currentGlobalStylesId = coreSel.__experimentalGetCurrentGlobalStylesId
            ? coreSel.__experimentalGetCurrentGlobalStylesId()
            : null;
          if (currentGlobalStylesId) {
            const globalStyles = coreSel.getEditedEntityRecord('root', 'globalStyles', currentGlobalStylesId);
            if (globalStyles && globalStyles.title) {
              // Try to match title to a variation slug
              const matchedVar = allVariations.find(v =>
                normalizeSlug(v.title) === normalizeSlug(globalStyles.title) ||
                normalizeSlug(v.slug) === normalizeSlug(globalStyles.title)
              );
              return matchedVar ? normalizeSlug(matchedVar.slug || matchedVar.title) : null;
            }
          }
        }
      }
    } catch (e) {
      console.log('WPWM-TVD: Site Editor API not available for current variation detection');
    }

    // Fallback: Use REST API (works in admin context)
    try {
      let relBase = 'wpwm-tvd/v1';
      try {
        const u = new URL(apiBase, window.location.origin);
        relBase = u.pathname.replace(/^\/?/, '').replace(/^.*?wp-json\//, '');
      } catch (_e) { /* fallback */ }
      const path = relBase.replace(/\/?$/, '') + '/current';
      const response = await window.wp.apiFetch({ path });
      console.log('WPWM-TVD: Current variation from REST API:', response);
      return response.current;
    } catch (e) {
      console.log('WPWM-TVD: Could not detect current variation via REST API', e);
    }
    return null;
  }

  function createPanelStructure() {
    const panel = el('div', '', '');
    panel.id = 'wpwm-tvd-panel';
    const header = el('div', 'wpwm-tvd-header');
    const note = el('div', 'wpwm-tvd-note', 'Variable-accurate preview (colors & fonts). Use Select to apply if available.');
    header.appendChild(note);
    panel.appendChild(header);
    const grid = el('div', 'wpwm-tvd-grid');
    panel.appendChild(grid);
    return panel;
  }

  function mountPanel(afterEl) {
    let panel = document.getElementById('wpwm-tvd-panel');
    if (!panel) {
      panel = createPanelStructure();
      afterEl.parentElement.insertBefore(panel, afterEl.nextSibling);
    }
    return panel.querySelector('.wpwm-tvd-grid');
  }

  function mountPanelInContainer(container) {
    let panel = document.getElementById('wpwm-tvd-panel');
    if (!panel) {
      panel = createPanelStructure();
      container.appendChild(panel);
    }
    return panel.querySelector('.wpwm-tvd-grid');
  }

  function normalizeSlug(slugString) {
    return (slugString || '').toString().toLowerCase().trim().replace(/[^a-z0-9-_]+/g, '-').replace(/^-+|-+$/g, '');
  }

  function rewriteAndSanitizeCss(css, scopeClass) {
    if (!css) return '';
    try {
      // Scope common roots to the card-specific class
      let out = css
        .replace(/:root\s*,\s*\.editor-styles-wrapper/g, '.' + scopeClass)
        .replace(/:root(?![\w-])/g, '.' + scopeClass)
        .replace(/\.editor-styles-wrapper/g, '.' + scopeClass);
      // Drop self-referential variable assignments like: --x: var(--x)
      out = out.replace(/(--[a-z0-9-_]+)\s*:\s*var\(\s*\1\s*\)\s*;?/gi, '');
      return out;
    } catch (_e) { return css; }
  }

  function createColorSwatch(paletteItem) {
    const sw = document.createElement('div');
    sw.className = 'wpwm-tvd-swatch';
    sw.style.background = (paletteItem.color || 'transparent');
    const colorSlug = (paletteItem.slug || paletteItem.name || '').toString();
    sw.title = colorSlug;
    sw.dataset.slug = colorSlug.toLowerCase();
    const label = document.createElement('div');
    label.className = 'wpwm-tvd-swatch-label';
    label.textContent = colorSlug;
    sw.appendChild(label);
    return sw;
  }

  function renderSwatches(variation) {
    const swWrap = el('div', 'wpwm-tvd-swatches');
    swWrap.style.display = 'flex';
    swWrap.style.height = '100%';
    swWrap.style.width = '100%';
    const varPalette = (((variation.config || {}).settings || {}).color || {}).palette || [];
    if (varPalette.length) {
      varPalette.forEach(paletteItem => {
        if (!paletteItem) return;
        swWrap.appendChild(createColorSwatch(paletteItem));
      });
    }
    return swWrap;
  }

  function renderFontSamples(variation) {
    const fontsBox = el('div', 'wpwm-tvd-fonts');
    const ff = (((variation.config || {}).settings || {}).typography || {}).fontFamilies || [];
    const stylesFF = (((variation.config || {}).styles || {}).typography || {}).fontFamily;
    const hasAnyFonts = (ff && ff.length) || !!stylesFF;
    if (hasAnyFonts) {
      fontsBox.appendChild(el('div', 'wpwm-tvd-fonts-label', 'Fonts:'));
    }
    if (ff.length) {
      const row = el('div', 'font-row');
      ff.slice(0, MAX_FONT_SAMPLES).forEach(fontItem => {
        const fontSample = el('div', 'sample', fontItem.name || fontItem.slug || 'Font');
        const fontFamily = fontItem.fontFamily || (fontItem['font-family']);
        if (fontFamily) fontSample.style.fontFamily = fontFamily;
        row.appendChild(fontSample);
      });
      fontsBox.appendChild(row);
    }
    if (stylesFF) {
      const row = el('div', 'font-row');
      const bodySample = el('div', 'sample', 'Body sample AaBbCc');
      bodySample.style.fontFamily = stylesFF;
      row.appendChild(bodySample);
      fontsBox.appendChild(row);
    }
    return fontsBox;
  }

  function createActionButtons(variation, variationIndex) {
    const actions = el('div', 'wpwm-tvd-actions');
    const btnSelect = el('button', '', 'Select');
    btnSelect.addEventListener('click', () => applyVariation(variation));
    const btnPreview = el('button', 'secondary', 'Preview');
    btnPreview.addEventListener('click', () => showPreviewModal(variationIndex));
    actions.appendChild(btnSelect);
    actions.appendChild(btnPreview);
    return actions;
  }

  function applyContrastAwareLabels(card) {
    requestAnimationFrame(() => {
      try {
        const swatches = card.querySelectorAll('.wpwm-tvd-swatch');
        const style = getComputedStyle(card);
        const lightVarStr = style.getPropertyValue('--text-on-light').trim() || DEFAULT_LIGHT_TEXT;
        const darkVarStr = style.getPropertyValue('--text-on-dark').trim() || DEFAULT_DARK_TEXT;
        const lightRGB = colorStringToRgb(lightVarStr);
        const darkRGB = colorStringToRgb(darkVarStr);
        const cardBgRGB = (() => {
          const cardBg = getComputedStyle(card).backgroundColor;
          const parsedCardBg = parseRgbString(cardBg);
          return parsedCardBg ? parsedCardBg.slice(0, 3) : DEFAULT_WHITE_RGB;
        })();
        swatches.forEach(sw => {
          const swatchBg = getComputedStyle(sw).backgroundColor;
          const label = sw.querySelector('.wpwm-tvd-swatch-label');
          if (!label) return;
          const parsedSwatchBg = parseRgbString(swatchBg);
          let bgRGB;
          if (!parsedSwatchBg) {
            bgRGB = lightRGB;
          } else if (parsedSwatchBg.length === 4 && parsedSwatchBg[3] < 1) {
            bgRGB = compositeRGBAoverRGB(parsedSwatchBg, cardBgRGB);
          } else {
            bgRGB = parsedSwatchBg.slice(0, 3);
          }
          // Compare contrast with both candidates (TOK on light vs TOK on dark)
          const cLight = contrastRatioRGB(bgRGB, lightRGB);
          const cDark = contrastRatioRGB(bgRGB, darkRGB);
          const useDarkText = cDark >= cLight; // choose the higher-contrast text color
          // Set color via CSS custom property on the swatch element
          sw.style.setProperty('--label-color', useDarkText ? darkVarStr : lightVarStr);
        });
      } catch (_e) { /* noop */ }
    });
  }

  function renderCard(grid, v, variationIndex) {
    const slug = normalizeSlug(v.slug || v.title || 'variation');
    const scopeClass = 'wpwm-tvd-var--' + slug;
    const card = el('div', 'wpwm-tvd-card ' + scopeClass);
    card.dataset.variationSlug = slug;

    // Inject scoped CSS variables if provided by variation JSON
    const cssFromJson = (v.config && v.config.styles && v.config.styles.css) ? v.config.styles.css : '';
    const scopedCss = rewriteAndSanitizeCss(cssFromJson, scopeClass);
    if (scopedCss) {
      const styleTag = document.createElement('style');
      styleTag.textContent = scopedCss;
      card.appendChild(styleTag);
    }

    // Media/preview area with color swatches
    const media = el('div', 'wpwm-tvd-media');
    media.style.display = 'flex';
    media.style.alignItems = 'stretch';
    media.style.justifyContent = 'stretch';
    media.appendChild(renderSwatches(v));

    // Body with title, meta, fonts, and actions
    const body = el('div', 'wpwm-tvd-body');
    const titleText = v.title || v.slug;
    const title = el('div', 'wpwm-tvd-title', titleText);

    // Add current indicator if this is the active variation
    if (currentVariationSlug && slug === currentVariationSlug) {
      const currentBadge = el('span', 'wpwm-tvd-current-badge', ' (Current)');
      title.appendChild(currentBadge);
    }

    const fontsBox = renderFontSamples(v);
    const actions = createActionButtons(v, variationIndex);
    body.appendChild(title);
    if (fontsBox.children.length) body.appendChild(fontsBox);
    body.appendChild(actions);

    card.appendChild(media);
    card.appendChild(body);
    grid.appendChild(card);

    // After insertion, compute contrast (WCAG) and set label colors
    applyContrastAwareLabels(card);
  }

  function showPreviewModal(startIndex) {
    let currentIndex = startIndex;
    let isDarkMode = false;

    // Create modal overlay
    const overlay = el('div', 'wpwm-tvd-modal-overlay');
    const modal = el('div', 'wpwm-tvd-modal');

    // Modal header with title and controls
    const header = el('div', 'wpwm-tvd-modal-header');
    const titleEl = el('h2', 'wpwm-tvd-modal-title');
    const controls = el('div', 'wpwm-tvd-modal-controls');

    // Light/Dark toggle
    const themeToggle = el('button', 'wpwm-tvd-theme-toggle', '☀️ Light');
    themeToggle.addEventListener('click', () => {
      isDarkMode = !isDarkMode;
      themeToggle.textContent = isDarkMode ? '🌙 Dark' : '☀️ Light';
      updatePreview();
    });

    // Close button
    const closeBtn = el('button', 'wpwm-tvd-modal-close', '✕');
    closeBtn.addEventListener('click', () => {
      document.body.removeChild(overlay);
    });

    controls.appendChild(themeToggle);
    controls.appendChild(closeBtn);
    header.appendChild(titleEl);
    header.appendChild(controls);

    // Preview content area
    const previewContent = el('div', 'wpwm-tvd-preview-content');

    // Navigation controls
    const nav = el('div', 'wpwm-tvd-modal-nav');
    const prevBtn = el('button', 'wpwm-tvd-nav-btn', '← Previous');
    const nextBtn = el('button', 'wpwm-tvd-nav-btn', 'Next →');
    const counter = el('span', 'wpwm-tvd-counter');

    prevBtn.addEventListener('click', () => {
      currentIndex = (currentIndex - 1 + allVariations.length) % allVariations.length;
      updatePreview();
    });

    nextBtn.addEventListener('click', () => {
      currentIndex = (currentIndex + 1) % allVariations.length;
      updatePreview();
    });

    nav.appendChild(prevBtn);
    nav.appendChild(counter);
    nav.appendChild(nextBtn);

    // Assemble modal
    modal.appendChild(header);
    modal.appendChild(previewContent);
    modal.appendChild(nav);
    overlay.appendChild(modal);

    // Update preview content
    function updatePreview() {
      const v = allVariations[currentIndex];
      const palette = (((v.config || {}).settings || {}).color || {}).palette || [];
      const cssString = (((v.config || {}).styles || {}).css) || '';

      titleEl.textContent = v.title || v.slug;
      counter.textContent = `${currentIndex + 1} / ${allVariations.length}`;

      // Parse CSS variables from the styles.css string
      const cssVars = {};
      if (cssString) {
        // Match CSS variable definitions like: --primary-light: #7ad1ff;
        const varMatches = cssString.matchAll(/--([a-z0-9-]+)\s*:\s*([^;]+);/gi);
        for (const match of varMatches) {
          const varName = match[1];
          let varValue = match[2].trim();
          // Resolve nested var() references
          if (varValue.startsWith('var(')) {
            const nestedVar = varValue.match(/var\(--([a-z0-9-]+)\)/i);
            if (nestedVar && cssVars[nestedVar[1]]) {
              varValue = cssVars[nestedVar[1]];
            }
          }
          cssVars[varName] = varValue;
        }
      }

      // Get color values from palette - resolve var() references to actual colors
      const getColor = (...slugPatterns) => {
        for (const pattern of slugPatterns) {
          const paletteEntry = palette.find(c => c.slug && c.slug.includes(pattern));
          if (paletteEntry) {
            let color = paletteEntry.color;
            // If color is a CSS variable, resolve it
            if (color && color.startsWith('var(')) {
              const varMatch = color.match(/var\(--([a-z0-9-]+)\)/i);
              if (varMatch && cssVars[varMatch[1]]) {
                color = cssVars[varMatch[1]];
              }
            }
            // Return if we have a real color value (not another var)
            if (color && !color.startsWith('var(')) {
              return color;
            }
          }
        }
        return null;
      };

      // Try common WordPress theme slugs and palette generator slugs
      const bgColor = isDarkMode
        ? (getColor('base-dark', 'background-dark', 'base') || '#1a1a1a')
        : (getColor('base-light', 'background-light', 'base', 'background') || '#ffffff');

      const textColor = isDarkMode
        ? (getColor('text-on-dark', 'contrast-dark', 'foreground-dark', 'contrast') || '#e0e0e0')
        : (getColor('text-on-light', 'contrast-light', 'foreground-light', 'contrast', 'foreground') || '#1a1a1a');

      // Headings: primary-dark in light mode, primary-light in dark mode
      const headingColor = isDarkMode
        ? (getColor('primary-light', 'primary') || '#7ad1ff')
        : (getColor('primary-dark', 'primary-darker', 'primary') || '#004f78');

      // Featured section: primary-lighter background with text-on-light text in light mode
      const featuredBg = isDarkMode
        ? (getColor('primary-darker', 'primary-dark') || '#003c5c')
        : (getColor('primary-lighter', 'primary-light') || '#b1e4ff');
      const featuredText = isDarkMode
        ? (getColor('text-on-dark') || '#e0e0e0')
        : (getColor('text-on-light') || '#1a1a1a');

      // For list items, use darker colors in light mode for readability
      const listColor1 = isDarkMode
        ? (getColor('secondary-light', 'secondary') || '#fcbc41')
        : (getColor('secondary-dark', 'secondary-darker', 'secondary') || '#664402');
      const listColor2 = isDarkMode
        ? (getColor('secondary-lighter') || '#fdd891')
        : (getColor('secondary-darker', 'secondary-dark') || '#4e3401');

      const accentDark = getColor('accent-dark', 'accent') || '#d84315';
      const accentDarker = getColor('accent-darker') || '#bf360c';
      const tertiaryLight = getColor('tertiary-light', 'tertiary') || '#fff9c4';
      const tertiaryDark = getColor('tertiary-dark', 'tertiary-darker') || '#f57f17';


      // Build preview HTML with CSS classes
      previewContent.innerHTML = `
        <div class=\"wpwm-preview-page\" style=\"--bg-color: ${bgColor}; --text-color: ${textColor}; --heading-color: ${headingColor}; --featured-bg: ${featuredBg}; --featured-text: ${featuredText}; --list-color-1: ${listColor1}; --list-color-2: ${listColor2}; --accent-dark: ${accentDark}; --accent-darker: ${accentDarker}; --tertiary-light: ${tertiaryLight}; --tertiary-dark: ${tertiaryDark};\">
          <h1 class=\"preview-heading\">Welcome to Your Site</h1>

          <section class=\"preview-featured\">
            <h2>Featured Section</h2>
            <p>This section uses the primary-lighter background to create visual hierarchy and draw attention to important content.</p>
          </section>

          <h3 class=\"preview-subheading\">Key Features</h3>
          <ul class=\"preview-list\">
            <li class=\"list-item-alt\">Beautiful color palettes for every mood</li>
            <li>Carefully crafted design variations</li>
            <li class=\"list-item-alt\">Instant preview and application</li>
            <li>Light and dark mode support</li>
          </ul>

          <blockquote class=\"preview-quote\">
            <p>"This theme variation system makes it incredibly easy to find the perfect color scheme for my website. The preview feature is a game-changer!"</p>
          </blockquote>

          <div class=\"preview-actions\">
            <a href=\"#\" class=\"preview-btn-primary\">Get Started</a>
            <a href=\"#\" class=\"preview-btn-secondary\">Learn More</a>
          </div>
        </div>
      `;
    }

    // Initial render
    updatePreview();

    // Add to page
    document.body.appendChild(overlay);

    // Close on overlay click
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        document.body.removeChild(overlay);
      }
    });

    // Close on Escape key
    const escHandler = (e) => {
      if (e.key === 'Escape') {
        document.body.removeChild(overlay);
        document.removeEventListener('keydown', escHandler);
      }
    };
    document.addEventListener('keydown', escHandler);
  }

  function previewInEditor(variation) {
    // Non-destructive: apply config to current editor session if API exists
    try {
      const editSite = wp.data.dispatch('core/edit-site');
      if (editSite && typeof editSite.setGlobalStylesUserConfig === 'function') {
        editSite.setGlobalStylesUserConfig(variation.config || {});
        return;
      }
    } catch (e) {/* noop */ }
    // Fallback: try clicking the core tile with matching title
    const tiles = document.querySelectorAll('.edit-site-style-variations [role="button"], .edit-site-style-variations button');
    for (const t of tiles) {
      if ((t.getAttribute('aria-label') || '').includes(variation.title) || (t.textContent || '').includes(variation.title)) {
        t.click();
        break;
      }
    }
  }

  async function applyVariation(variation) {
    console.log('WPWM-TVD: ========================================');
    console.log('WPWM-TVD: APPLYING VARIATION');
    console.log('WPWM-TVD: Title:', variation.title);
    console.log('WPWM-TVD: Slug:', variation.slug);
    console.log('WPWM-TVD: Source file:', variation.source || 'unknown');
    console.log('WPWM-TVD: Has config:', !!variation.config);

    // Log palette colors if available
    if (variation.config && variation.config.settings && variation.config.settings.color && variation.config.settings.color.palette) {
      const palette = variation.config.settings.color.palette;
      console.log('WPWM-TVD: Palette structure:', Array.isArray(palette) ? 'flat array' : 'origin-wrapped object');
      console.log('WPWM-TVD: Palette colors:', palette);

      // Log specific colors for debugging
      if (Array.isArray(palette)) {
        const primaryLight = palette.find(c => c.slug && c.slug.includes('primary-light'));
        if (primaryLight) {
          console.log('WPWM-TVD: primary-light color in variation:', primaryLight.color);
        }
      }
    }
    console.log('WPWM-TVD: Full config being applied:', variation.config);
    console.log('WPWM-TVD: ========================================');

    // Try Site Editor API first (only available in Site Editor context)
    try {
      const editSiteDisp = wp.data.dispatch('core/edit-site');
      const coreDisp = wp.data.dispatch('core');
      const coreSel = wp.data.select('core');

      console.log('WPWM-TVD: WordPress data stores available:', {
        hasEditSiteDisp: !!editSiteDisp,
        hasCoreDisp: !!coreDisp,
        hasCoreSel: !!coreSel
      });

      if (editSiteDisp && typeof editSiteDisp.setGlobalStylesUserConfig === 'function') {
        console.log('WPWM-TVD: Using Site Editor API...');

        // Deep clone and ensure arrays remain arrays (WordPress API bug workaround)
        const cleanConfig = JSON.parse(JSON.stringify(variation.config || {}));
        let hasErrors = false;
        const errorLog = [];

        // Validate and fix palette structure
        if (cleanConfig.settings && cleanConfig.settings.color && cleanConfig.settings.color.palette) {
          const palette = cleanConfig.settings.color.palette;

          // Check if palette is a flat array (variation format) vs origin-wrapped (database format)
          if (Array.isArray(palette)) {
            // Flat array format from variation JSON - this is normal, no error
            // WordPress will handle wrapping it in origins during merge
            console.log('WPWM-TVD: Palette is flat array format (normal for variations)');
          } else {
            // Origin-wrapped format - validate each origin
            Object.keys(palette).forEach(origin => {
              if (palette[origin] && typeof palette[origin] === 'object') {
                const isArray = Array.isArray(palette[origin]);

                // Detect object-with-numeric-keys bug
                if (!isArray) {
                  hasErrors = true;
                  errorLog.push({
                    type: 'PALETTE_STRUCTURE_ERROR',
                    origin: origin,
                    issue: 'Palette is an object with numeric keys instead of an array',
                    originalStructure: palette[origin],
                    itemCount: Object.keys(palette[origin]).length
                  });

                  // Fix: Convert to proper array
                  palette[origin] = Object.values(palette[origin]);
                  console.warn('WPWM-TVD: Fixed palette structure for origin:', origin);
                }

                // Validate each palette entry has required fields
                if (Array.isArray(palette[origin])) {
                  palette[origin].forEach((entry, index) => {
                    if (!entry || typeof entry !== 'object') {
                      hasErrors = true;
                      errorLog.push({
                        type: 'PALETTE_ENTRY_ERROR',
                        origin: origin,
                        index: index,
                        issue: 'Entry is not an object',
                        entry: entry
                      });
                    } else if (!entry.slug || !entry.slug.trim()) {
                      hasErrors = true;
                      errorLog.push({
                        type: 'MISSING_SLUG',
                        origin: origin,
                        index: index,
                        issue: 'Palette entry missing slug',
                        entry: entry
                      });
                    } else if (!entry.color) {
                      hasErrors = true;
                      errorLog.push({
                        type: 'MISSING_COLOR',
                        origin: origin,
                        index: index,
                        issue: 'Palette entry missing color',
                        entry: entry
                      });
                    }
                  });
                }
              }
            });
          }
        }

        // Validate fontFamilies structure
        if (cleanConfig.settings && cleanConfig.settings.typography && cleanConfig.settings.typography.fontFamilies) {
          const fontFamilies = cleanConfig.settings.typography.fontFamilies;

          Object.keys(fontFamilies).forEach(origin => {
            if (fontFamilies[origin] && typeof fontFamilies[origin] === 'object') {
              if (!Array.isArray(fontFamilies[origin])) {
                hasErrors = true;
                errorLog.push({
                  type: 'FONT_FAMILIES_STRUCTURE_ERROR',
                  origin: origin,
                  issue: 'fontFamilies is an object with numeric keys instead of an array',
                  itemCount: Object.keys(fontFamilies[origin]).length
                });
                fontFamilies[origin] = Object.values(fontFamilies[origin]);
              }
            }
          });
        }

        // Validate fontSizes structure
        if (cleanConfig.settings && cleanConfig.settings.typography && cleanConfig.settings.typography.fontSizes) {
          const fontSizes = cleanConfig.settings.typography.fontSizes;

          Object.keys(fontSizes).forEach(origin => {
            if (fontSizes[origin] && typeof fontSizes[origin] === 'object') {
              if (!Array.isArray(fontSizes[origin])) {
                hasErrors = true;
                errorLog.push({
                  type: 'FONT_SIZES_STRUCTURE_ERROR',
                  origin: origin,
                  issue: 'fontSizes is an object with numeric keys instead of an array',
                  itemCount: Object.keys(fontSizes[origin]).length
                });
                fontSizes[origin] = Object.values(fontSizes[origin]);
              }
            }
          });
        }

        // Log errors to server if any found
        if (hasErrors) {
          console.error('WPWM-TVD: Validation errors found:', errorLog);

          // Determine source file
          let sourceFile = 'unknown';
          if (variation.source === 'theme') {
            const themeStylesheet = (window.__WPWM_TVD__ && window.__WPWM_TVD__.themeStylesheet) || 'unknown-theme';
            sourceFile = 'wp-content/themes/' + themeStylesheet + '/styles/' + (variation.slug || 'unknown') + '.json';
          } else if (variation.source === 'export') {
            sourceFile = 'wp-content/plugins/wpwm-theme-variation-display/export.json';
          } else if (variation.source) {
            sourceFile = variation.source;
          }

          // Send to server for logging
          try {
            await window.wp.apiFetch({
              path: 'wpwm-tvd/v1/log-error',
              method: 'POST',
              data: {
                variation: variation.title || variation.slug || 'unknown',
                sourceFile: sourceFile,
                errors: errorLog,
                timestamp: new Date().toISOString()
              }
            });
          } catch (logError) {
            console.warn('WPWM-TVD: Could not send error log to server:', logError);
          }

          // Show user-friendly warning
          if (wp.data.dispatch('core/notices') && wp.data.dispatch('core/notices').createWarningNotice) {
            wp.data.dispatch('core/notices').createWarningNotice(
              'Variation data had ' + errorLog.length + ' issue(s) that were automatically fixed. Check browser console for details.',
              { type: 'snackbar', isDismissible: true }
            );
          }
        }

        editSiteDisp.setGlobalStylesUserConfig(cleanConfig);

        const currentGlobalStylesId = coreSel.__experimentalGetCurrentGlobalStylesId
          ? coreSel.__experimentalGetCurrentGlobalStylesId()
          : null;

        console.log('WPWM-TVD: Current global styles ID:', currentGlobalStylesId);

        if (currentGlobalStylesId && coreDisp.saveEditedEntityRecord) {
          console.log('WPWM-TVD: Saving via Site Editor API...');
          try {
            await coreDisp.saveEditedEntityRecord('root', 'globalStyles', currentGlobalStylesId);
            console.log('WPWM-TVD: Save successful!');
            if (wp.data.dispatch('core/notices') && wp.data.dispatch('core/notices').createSuccessNotice) {
              wp.data.dispatch('core/notices').createSuccessNotice(
                'Variation "' + (variation.title || variation.slug) + '" applied successfully.',
                { type: 'snackbar', isDismissible: true }
              );
            } else {
              alert('Variation "' + (variation.title || variation.slug) + '" applied successfully.');
            }
            return;
          } catch (saveError) {
            console.error('WPWM-TVD save error:', saveError);
            alert('Variation set but could not save: ' + (saveError.message || 'Unknown error'));
            return;
          }
        }
      } else {
        console.log('WPWM-TVD: Site Editor API not available, trying REST API...');
      }
    } catch (e) {
      console.warn('WPWM-TVD: Site Editor API failed, trying REST API...', e);
    }

    // Fallback: Use REST API (works in admin context)
    console.log('WPWM-TVD: Using REST API to apply variation...');
    console.log('WPWM-TVD: Sending config to REST API:', variation.config);
    try {
      const response = await window.wp.apiFetch({
        path: 'wpwm-tvd/v1/apply',
        method: 'POST',
        data: variation.config || {}
      });

      console.log('WPWM-TVD: ========================================');
      console.log('WPWM-TVD: REST API RESPONSE');
      console.log('WPWM-TVD: Success:', response.success);
      console.log('WPWM-TVD: Message:', response.message);
      console.log('WPWM-TVD: Post ID:', response.post_id);
      console.log('WPWM-TVD: Full response:', response);
      console.log('WPWM-TVD: ========================================');

      if (response.success) {
        alert('Variation "' + (variation.title || variation.slug) + '" applied successfully!\n\nPost ID: ' + response.post_id + '\n\nRefresh the page to see changes.');
      } else {
        alert('Variation applied but response was unexpected: ' + JSON.stringify(response));
      }
    } catch (restError) {
      console.error('WPWM-TVD: REST API failed:', restError);
      alert('Could not apply variation via REST API: ' + (restError.message || 'Unknown error'));
    }
  }

  // Mount in Site Editor when styles screen is ready
  if (window.wp && window.wp.data) {
    whenStylesScreenReady(async (host) => {
      const grid = mountPanel(host);
      allVariations = await fetchVariations();
      currentVariationSlug = await getCurrentVariation();
      allVariations.forEach((v, index) => renderCard(grid, v, index));
    });
  }

  // Mount in dedicated admin page
  function initAdminPage() {
    console.log('WPWM-TVD: initAdminPage called');
    const root = document.getElementById('wpwm-tvd-root');
    console.log('WPWM-TVD: Root element found:', !!root);
    if (!root) return;

    // Check if root is visible (admin page) or hidden (Site Editor)
    const isVisible = root.offsetParent !== null;
    console.log('WPWM-TVD: Root element is visible:', isVisible);

    if (!isVisible) {
      console.log('WPWM-TVD: Skipping admin page init - in Site Editor context');
      return;
    }

    (async () => {
      console.log('WPWM-TVD: Fetching variations...');
      const grid = mountPanelInContainer(root);
      allVariations = await fetchVariations();
      currentVariationSlug = await getCurrentVariation();
      console.log('WPWM-TVD: Variations loaded:', allVariations.length);
      console.log('WPWM-TVD: Current variation:', currentVariationSlug);
      allVariations.forEach((v, index) => renderCard(grid, v, index));
      console.log('WPWM-TVD: Cards rendered');
    })();
  }

  console.log('WPWM-TVD: Document ready state:', document.readyState);
  if (document.readyState === 'loading') {
    console.log('WPWM-TVD: Waiting for DOMContentLoaded');
    document.addEventListener('DOMContentLoaded', initAdminPage);
  } else {
    console.log('WPWM-TVD: Initializing immediately');
    initAdminPage();
  }
})();
