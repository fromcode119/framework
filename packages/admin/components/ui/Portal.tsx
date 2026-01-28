"use client";

import { useEffect, useState, ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface PortalProps {
  children: ReactNode;
  containerId?: string;
}

export function Portal({ children, containerId = 'portal-root' }: PortalProps) {
  const [container, setContainer] = useState<HTMLElement | null>(null);

  useEffect(() => {
    let element = document.getElementById(containerId);
    let created = false;

    if (!element) {
      element = document.createElement('div');
      element.id = containerId;
      document.body.appendChild(element);
      created = true;
    }

    setContainer(element);

    return () => {
      if (created && element && element.parentNode) {
        element.parentNode.removeChild(element);
      }
    };
  }, [containerId]);

  if (!container) return null;

  return createPortal(children, container);
}
