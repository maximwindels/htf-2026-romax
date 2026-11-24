import type { GridNode } from '#/lib/grid.ts';

// x/y are positions on a 0-100 x 0-70 map, used by the network map on the dashboard.
export const NODES: GridNode[] = [
  { id: 'aether-spire', name: 'Aether Spire', region: 'North', x: 18, y: 12 },
  { id: 'runic-vault', name: 'Runic Vault', region: 'North', x: 46, y: 9 },
  { id: 'ember-forge', name: 'Ember Forge', region: 'North', x: 78, y: 15 },
  { id: 'moon-well', name: 'Moon Well', region: 'West', x: 10, y: 38 },
  { id: 'crystal-core', name: 'Crystal Core', region: 'Central', x: 42, y: 34 },
  { id: 'storm-relay', name: 'Storm Relay', region: 'East', x: 72, y: 40 },
  { id: 'gloom-hollow', name: 'Gloom Hollow', region: 'West', x: 22, y: 60 },
  { id: 'sun-obelisk', name: 'Sun Obelisk', region: 'South', x: 52, y: 58 },
  { id: 'tide-gate', name: 'Tide Gate', region: 'East', x: 90, y: 56 },
  { id: 'verdant-loom', name: 'Verdant Loom', region: 'Central', x: 60, y: 24 },
];
