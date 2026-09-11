import type { Metadata } from 'next';
import { DM_Serif_Display, DM_Serif_Text } from 'next/font/google';
import { AppProviders } from '@/components/providers/app-providers';
import { brand } from '@/lib/config/brand';
import { buildPageMetadata } from '@/lib/seo/build-metadata';
import './globals.css';

/*
  The site is set in DM Serif throughout, in its two cuts.

  DM Serif Text is the body cut: the same design drawn with a larger x-height,
  looser spacing and sturdier hairlines so it survives at 14–16px. It fills the
  role Inter used to, including inside buttons, inputs and tables.

  DM Serif Display is the tighter, higher-contrast cut for headings and the
  wordmark, where the finer strokes read as deliberate rather than fragile.

  Both ship a single weight (400) plus an italic. There is no 500/600/700 to
  load, so the weight tokens in tokens.css resolve to a synthesised bold drawn
  by the browser. That is why hierarchy here leans on size and colour rather
  than on weight.
*/
const sans = DM_Serif_Text({
  subsets: ['latin'],
  weight: '400',
  style: ['normal', 'italic'],
  variable: '--font-sans-family',
  display: 'swap',
});

const display = DM_Serif_Display({
  subsets: ['latin'],
  weight: '400',
  style: ['normal', 'italic'],
  variable: '--font-display-family',
  display: 'swap',
});

export const metadata: Metadata = {
  ...buildPageMetadata({
    title: brand.name,
    description: brand.shortDescription,
    path: '/',
  }),
  metadataBase: process.env.NEXT_PUBLIC_SITE_URL ? new URL(process.env.NEXT_PUBLIC_SITE_URL) : undefined,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    /*
      The font variable classes belong on <html>, not on <body>.

      tokens.css composes its stacks at :root — `--font-sans: var(--font-sans-family), …`.
      A custom property is substituted at the element where it is declared, so
      with the classes on <body> the :root declaration resolved against a
      `--font-sans-family` that did not exist there, making `--font-sans`
      guaranteed-invalid. That invalid value then inherited down, and every
      `font-family: var(--font-sans)` in the app silently fell through to the
      last item in the UA's serif fallback — the whole site rendered in Times
      New Roman, which is why no font change appeared to take effect.
    */
    <html lang="en-IN" className={`${sans.variable} ${display.variable}`}>
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
