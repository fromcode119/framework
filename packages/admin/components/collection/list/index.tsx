"use client";

import React from 'react';

import { CollectionListPageClient } from './page-client';

export default class CollectionListPage extends React.Component<{ params: Promise<{ pluginSlug: string; slug: string }> }> {
  render(): React.ReactNode {
    return <CollectionListPageClient params={this.props.params} />;
  }
}
