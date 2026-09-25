import type { TableSessionDto, TableSummaryDto } from '@ros/shared';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { useTableSession } from '../../features/table/tableSession';
import { api, ApiError } from '../../shared/api/client';
import { buttonClass } from '../../shared/ui/buttonClass';

type State = { kind: 'loading' } | { kind: 'error'; title: string; message: string };

/**
 * /t/:token — where a table's QR code lands (TABLE-03, BROWSE-04). It reads the
 * table with a GET, then opens the session with a POST, then shows the menu
 * bound to the table. The GET alone never seats anything.
 */
export function TableLandingPage() {
  const { token = '' } = useParams();
  const join = useTableSession((s) => s.join);
  const navigate = useNavigate();
  const [state, setState] = useState<State>({ kind: 'loading' });

  useEffect(() => {
    let cancelled = false;
    async function open() {
      try {
        await api<TableSummaryDto>(`/tables/qr/${token}`, { anonymous: true });
        const session = await api<TableSessionDto>('/tables/sessions', {
          method: 'POST',
          body: { token },
          anonymous: true,
        });
        if (cancelled) return;
        join(token, session.table);
        navigate('/menu', { replace: true });
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError && err.code === 'TABLE_DIRTY') {
          setState({
            kind: 'error',
            title: 'This table is being cleared',
            message: 'Give us a moment — ask a member of staff to seat you.',
          });
        } else if (err instanceof ApiError && (err.status === 404 || err.status === 400)) {
          setState({
            kind: 'error',
            title: 'We don’t recognise this code',
            message:
              'The QR code may be out of date. Ask staff for a fresh one, or browse the menu.',
          });
        } else {
          setState({
            kind: 'error',
            title: 'We couldn’t open your table',
            message: 'Check your connection and scan the code again.',
          });
        }
      }
    }
    void open();
    return () => {
      cancelled = true;
    };
  }, [token, join, navigate]);

  if (state.kind === 'loading') {
    return (
      <p role="status" className="p-16 text-center text-ink-muted">
        Finding your table…
      </p>
    );
  }
  return (
    <main className="mx-auto max-w-md px-5 py-16 text-center">
      <h1 className="font-display text-3xl font-bold">{state.title}</h1>
      <p className="mt-3 text-ink-muted">{state.message}</p>
      <Link to="/menu" className={`${buttonClass('ghost')} mt-6`}>
        Browse the menu
      </Link>
    </main>
  );
}
