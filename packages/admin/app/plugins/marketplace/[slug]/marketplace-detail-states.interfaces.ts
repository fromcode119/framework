export interface MarketplaceDetailLoadingProps {
  theme: string;
}

export interface MarketplaceDetailErrorProps {
  error: string | null;
  onBack: () => void;
}
