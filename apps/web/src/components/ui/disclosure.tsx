'use client';

import { useId, useState, type ReactNode } from 'react';
import styles from './ui.module.css';

export function Dropdown({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const menuId = useId();

  return (
    <div className={styles.menu}>
      <button
        type="button"
        className={styles.menuItem}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((value) => !value)}
      >
        {label}
      </button>
      {open ? (
        <div id={menuId} role="menu" className={styles.menuList}>
          {children}
        </div>
      ) : null}
    </div>
  );
}

export function DropdownItem({
  children,
  onSelect,
}: {
  children: ReactNode;
  onSelect?: () => void;
}) {
  return (
    <button type="button" role="menuitem" className={styles.menuItem} onClick={onSelect}>
      {children}
    </button>
  );
}

export function Tooltip({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const tooltipId = useId();

  return (
    <span
      className={styles.tooltipWrap}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      <span aria-describedby={open ? tooltipId : undefined}>{children}</span>
      {open ? (
        <span role="tooltip" id={tooltipId} className={styles.tooltip}>
          {label}
        </span>
      ) : null}
    </span>
  );
}

export function Tabs({
  tabs,
}: {
  tabs: Array<{ id: string; label: string; panel: ReactNode }>;
}) {
  const [active, setActive] = useState(tabs[0]?.id);

  return (
    <div>
      <div className={styles.tabs} role="tablist">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={tab.id === active}
            className={tab.id === active ? `${styles.tab} ${styles.tabActive}` : styles.tab}
            onClick={() => setActive(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {tabs.map((tab) =>
        tab.id === active ? (
          <div key={tab.id} role="tabpanel" style={{ paddingTop: '1rem' }}>
            {tab.panel}
          </div>
        ) : null,
      )}
    </div>
  );
}
