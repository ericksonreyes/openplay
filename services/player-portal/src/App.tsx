import { Route, Routes } from 'react-router-dom';

export default function App() {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <main className="flex min-h-screen items-center justify-center">
            <h1 className="text-2xl font-semibold">OpenPlay Player Portal</h1>
          </main>
        }
      />
    </Routes>
  );
}
