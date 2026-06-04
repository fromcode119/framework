export interface UserProfilePageProps {
  params: Promise<{ id: string }>;
}

export interface UserProfilePageState {
  routeId: string;
  user: any;
  loading: boolean;
}
