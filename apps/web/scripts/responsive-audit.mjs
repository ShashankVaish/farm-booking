/*
  Responsive audit.

  Loads every page at phone, tablet and desktop widths in a real browser and
  reports two things CSS review cannot tell you:

  1. Horizontal overflow — `documentElement.scrollWidth > clientWidth`. This is
     the objective definition of a broken responsive layout: the page scrolls
     sideways. It also names the widest offending elements, which is what makes
     the failure fixable rather than just visible.
  2. Touch targets under 44x44 CSS px on the phone viewport, the WCAG 2.5.8
     minimum for a control you are expected to tap.

  Run against a dev server that is already up:
    node scripts/responsive-audit.mjs [baseUrl]
*/
import { chromium } from 'playwright';

const BASE = process.argv[2] ?? 'http://localhost:3000';

const VIEWPORTS = [
  { name: 'phone', width: 375, height: 812 },
  { name: 'phone-lg', width: 414, height: 896 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'tablet-lg', width: 1024, height: 1366 },
  { name: 'desktop', width: 1440, height: 900 },
];

const PAGES = [
  '/',
  '/explore',
  '/map',
  '/stays',
  '/events',
  '/experiences',
  '/properties/doggy-farm-099e3e',
  '/auth/login',
  '/auth/register',
  '/terms',
  '/terms/guest',
  '/terms/host',
  '/host',
  '/host/properties/new',
  '/dashboard',
  '/design-system',
];

/** Elements that stick out past the viewport, worst first. */
const FIND_OVERFLOW = `() => {
  const docWidth = document.documentElement.clientWidth;
  const offenders = [];
  for (const el of document.querySelectorAll('body *')) {
    const style = getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') continue;
    // A fixed overlay is allowed to sit off-screen while closed.
    if (style.position === 'fixed' && parseFloat(style.opacity) === 0) continue;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) continue;
    const overhang = Math.round(rect.right - docWidth);
    if (overhang > 1) {
      offenders.push({
        overhang,
        tag: el.tagName.toLowerCase(),
        cls: (el.className && String(el.className).slice(0, 60)) || '',
        text: (el.textContent || '').trim().slice(0, 40),
      });
    }
  }
  return offenders.sort((a, b) => b.overhang - a.overhang).slice(0, 6);
}`;

const FIND_SMALL_TARGETS = `() => {
  const MIN = 44;
  const found = [];
  const selector = 'a[href], button, input, select, textarea, [role="button"], [role="tab"]';
  for (const el of document.querySelectorAll(selector)) {
    const style = getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') continue;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) continue;
    if (rect.width < MIN || rect.height < MIN) {
      found.push({
        tag: el.tagName.toLowerCase(),
        size: Math.round(rect.width) + 'x' + Math.round(rect.height),
        cls: (el.className && String(el.className).slice(0, 44)) || '',
        text: (el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 30),
      });
    }
  }
  return found.slice(0, 8);
}`;

const browser = await chromium.launch();
let failures = 0;
const smallTargets = new Map();

for (const viewport of VIEWPORTS) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    isMobile: viewport.width < 768,
    hasTouch: viewport.width < 768,
    deviceScaleFactor: 2,
  });
  console.log(`\n=== ${viewport.name} (${viewport.width}px) ===`);

  for (const path of PAGES) {
    const page = await context.newPage();
    try {
      const response = await page.goto(`${BASE}${path}`, {
        waitUntil: 'domcontentloaded',
        timeout: 45000,
      });
      // Let CSS settle and any client component mount.
      await page.waitForTimeout(700);

      const status = response?.status() ?? 0;
      const metrics = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      const overflow = metrics.scrollWidth - metrics.clientWidth;

      if (overflow > 1) {
        failures += 1;
        const offenders = await page.evaluate(`(${FIND_OVERFLOW})()`);
        console.log(`  ✗ ${path}  [${status}]  overflows by ${overflow}px`);
        for (const item of offenders) {
          console.log(`      +${item.overhang}px  <${item.tag}> ${item.cls} ${item.text ? '· ' + item.text : ''}`);
        }
      } else {
        console.log(`  ✓ ${path}  [${status}]`);
      }

      if (viewport.name === 'phone') {
        const small = await page.evaluate(`(${FIND_SMALL_TARGETS})()`);
        if (small.length > 0) smallTargets.set(path, small);
      }
    } catch (error) {
      failures += 1;
      console.log(`  ! ${path}  ${error.message.split('\n')[0]}`);
    } finally {
      await page.close();
    }
  }
  await context.close();
}

if (smallTargets.size > 0) {
  console.log('\n=== touch targets under 44x44 on phone ===');
  for (const [path, items] of smallTargets) {
    console.log(`  ${path}`);
    for (const item of items) {
      console.log(`      ${item.size}  <${item.tag}> ${item.cls} ${item.text ? '· ' + item.text : ''}`);
    }
  }
}

/*
  The reported navbar bug, tested directly.

  It was not an overflow — the menu was nested inside a header carrying
  `backdrop-filter`, which made that header the containing block for its
  fixed-position child. The menu therefore laid out inside a strip one header
  tall, painted no background, and its links appeared on top of the page. The
  assertions below are exactly what that failure violates: real height, and an
  opaque background.
*/
console.log('\n=== mobile menu overlay (375px) ===');
{
  const context = await browser.newContext({
    viewport: { width: 375, height: 812 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  await page.goto(`${BASE}/explore`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForTimeout(600);

  await page.getByRole('button', { name: /open menu/i }).click();
  await page.waitForTimeout(400);

  const result = await page.evaluate(`(() => {
    const menu = document.getElementById('mobile-menu');
    if (!menu) return { found: false };
    const rect = menu.getBoundingClientRect();
    const style = getComputedStyle(menu);
    // Sample a point inside the menu but below its links, where the page behind
    // would show through if the overlay were transparent.
    const probe = document.elementFromPoint(188, window.innerHeight - 140);
    return {
      found: true,
      height: Math.round(rect.height),
      width: Math.round(rect.width),
      viewportHeight: window.innerHeight,
      background: style.backgroundColor,
      position: style.position,
      // Whether the topmost element at that point belongs to the menu.
      coversPage: Boolean(probe && (menu === probe || menu.contains(probe))),
    };
  })()`);

  const opaque = result.found && !/rgba\(.*,\s*0\)/.test(result.background);
  const tallEnough = result.found && result.height > result.viewportHeight * 0.5;

  if (!result.found) {
    failures += 1;
    console.log('  ✗ menu did not open');
  } else {
    console.log(`  menu box: ${result.width}x${result.height} (viewport ${result.viewportHeight}) · ${result.position} · ${result.background}`);
    if (!tallEnough) {
      failures += 1;
      console.log(`  ✗ menu is only ${result.height}px tall — it is being contained by an ancestor`);
    } else {
      console.log('  ✓ menu fills the viewport');
    }
    if (!opaque) {
      failures += 1;
      console.log(`  ✗ menu background is transparent (${result.background}) — the page shows through`);
    } else {
      console.log('  ✓ menu background is opaque');
    }
    if (!result.coversPage) {
      failures += 1;
      console.log('  ✗ page content is on top of the menu');
    } else {
      console.log('  ✓ menu is above the page content');
    }
  }
  await context.close();
}

await browser.close();
console.log(`\n${failures === 0 ? 'PASS — no horizontal overflow at any width, and the mobile menu overlays correctly.' : failures + ' problem(s) found.'}`);
process.exit(failures === 0 ? 0 : 1);
