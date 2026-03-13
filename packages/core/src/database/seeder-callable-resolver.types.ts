export type SeederCallableSymbol = 'default' | 'seed' | 'run' | 'execute';

export type SeederCallableSourceType = 'default' | 'named';

export type SeederCallableResolution = {
  callable: (...args: unknown[]) => unknown;
  symbolName: SeederCallableSymbol;
  sourceType: SeederCallableSourceType;
};