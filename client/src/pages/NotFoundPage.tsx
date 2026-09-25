import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <main className="mx-auto max-w-5xl p-6">
      <h1 className="text-2xl font-bold">Page not found</h1>
      <Link to="/">Back to the menu</Link>
    </main>
  );
}
