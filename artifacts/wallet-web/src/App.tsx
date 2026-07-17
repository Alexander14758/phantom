import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import WalletDashboard from '@/pages/WalletDashboard';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 2, staleTime: 30_000 },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <WalletDashboard />
    </QueryClientProvider>
  );
}
