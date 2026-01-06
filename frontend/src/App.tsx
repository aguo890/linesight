import './index.css';
import { AppRouter } from './router';


import { DashboardProvider } from './features/dashboard/context/DashboardContext';
import { FactoryProvider } from './contexts/FactoryContext';


function App() {
  return (
    <FactoryProvider>
      <DashboardProvider>
        <AppRouter />
      </DashboardProvider>
    </FactoryProvider>
  );
}

export default App;
