import type { ReactNode } from 'react';

/*
  A template, unlike a layout, is re-mounted on every navigation, which is what
  lets each new page play its entrance animation.
*/
export default function SiteTemplate({ children }: { children: ReactNode }) {
  return <div className="page-enter">{children}</div>;
}
