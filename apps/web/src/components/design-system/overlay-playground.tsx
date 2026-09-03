'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Drawer, Modal } from '@/components/ui/overlays';
import { Dropdown, DropdownItem, Tooltip } from '@/components/ui/disclosure';
import { useToast } from '@/components/providers/toast-provider';

export function OverlayPlayground() {
  const [modalOpen, setModalOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { notify } = useToast();

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
      <Button variant="secondary" onClick={() => setModalOpen(true)}>
        Open modal
      </Button>
      <Button variant="secondary" onClick={() => setDrawerOpen(true)}>
        Open drawer
      </Button>
      <Button variant="ghost" onClick={() => notify('Saved to wishlist')}>
        Show toast
      </Button>
      <Dropdown label="Account menu">
        <DropdownItem>Trips</DropdownItem>
        <DropdownItem>Wishlist</DropdownItem>
      </Dropdown>
      <Tooltip label="Saved stays">
        <Button variant="ghost" size="sm">
          Hover me
        </Button>
      </Tooltip>
      <Modal open={modalOpen} title="Modal foundation" onClose={() => setModalOpen(false)}>
        <p className="t-body-small">Use this for confirmation and short tasks. Keep copy brief.</p>
      </Modal>
      <Drawer open={drawerOpen} title="Filters later" onClose={() => setDrawerOpen(false)}>
        <p className="t-body-small">Mobile filters and menus can reuse this drawer.</p>
      </Drawer>
    </div>
  );
}
