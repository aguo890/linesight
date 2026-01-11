import { StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import './i18n'
import { AuthProvider } from './contexts/AuthContext.tsx'
import { ThemeProvider } from './context/ThemeContext.tsx'
import App from './App.tsx'

const queryClient = new QueryClient();

async function enableMocking() {
  if (import.meta.env.VITE_MOCK_API !== 'true') {
    return;
  }

  const { getFactoriesMock } = await import('./api/endpoints/factories/factories.msw');
  const { getGetUploadHistoryApiV1IngestionHistoryGetMockHandler } = await import('./api/endpoints/data-ingestion/data-ingestion.msw');
  // Add other resource mocks here as needed or create a central handler loader

  const { setupWorker } = await import('msw/browser');

  // You can combine all your mock handlers here
  const worker = setupWorker(
    ...getFactoriesMock(),
    getGetUploadHistoryApiV1IngestionHistoryGetMockHandler(),
  );

  return worker.start();
}

enableMocking().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <AuthProvider>
            <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>}>
              <App />
            </Suspense>
          </AuthProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </StrictMode>,
  );
});
