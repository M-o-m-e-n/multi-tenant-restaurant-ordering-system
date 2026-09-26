import { Link } from 'react-router-dom';

import { useT } from '../i18n';

export function NotFoundPage() {
  const t = useT();
  return (
    <main className="mx-auto max-w-5xl p-6">
      <h1 className="text-2xl font-bold">{t.notFound.title}</h1>
      <Link to="/">{t.notFound.back}</Link>
    </main>
  );
}
