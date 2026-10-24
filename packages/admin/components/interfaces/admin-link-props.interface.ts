import type React from 'react';
import type NextLink from 'next/link';

/** Exactly what `next/link` accepts — `AdminLink` is a drop-in for it. */
export interface IAdminLinkProps extends React.ComponentProps<typeof NextLink> {}
