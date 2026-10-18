import type { MenuItemDto } from '@ros/shared';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { tenant } from '../../brand';
import { CartBar } from '../../features/cart/CartBar';
import { ModifierDialog } from '../../features/cart/ModifierDialog';
import { FireToTable } from '../../features/landing/FireToTable';
import { Hero } from '../../features/landing/Hero';
import { Footer, Marquee, QuoteBand, Reviews, Story, Visit } from '../../features/landing/Sections';
import { useMenu } from '../../features/menu/menuApi';
import { SignatureRail } from '../../features/menu/SignatureRail';
import { pickSignatures } from '../../features/menu/signatures';
import { useT } from '../../i18n';
import { lazyComponent } from '../../shared/ui/lazyPage';

// A tenant may bring its own landing (ADR-032); otherwise it is design 31's.
const TenantHome = tenant.home ? lazyComponent(tenant.home) : null;

export function HomePage() {
  return TenantHome ? <TenantHome /> : <ForkAndFlameHome />;
}

/** The Fork & Flame landing page (design 31): hero, live signatures, story, reviews, visit. */
function ForkAndFlameHome() {
  const { data } = useMenu();
  const t = useT();
  const [open, setOpen] = useState<MenuItemDto | null>(null);
  const signatures = useMemo(() => pickSignatures(data), [data]);
  const categoryName = (item: MenuItemDto) =>
    data?.categories.find((c) => c.id === item.categoryId)?.name ?? '';

  return (
    <>
      <main>
        <Hero />
        <Marquee />
        {signatures.length > 0 && (
          <div className="mx-auto w-full max-w-content px-5 pt-20 md:px-10">
            <SignatureRail
              id="signatures"
              title={
                <>
                  {t.menu.signaturesLead}{' '}
                  <span className="text-flame">{t.menu.signaturesWord}</span>
                </>
              }
              items={signatures}
              categoryName={categoryName}
              onOpen={setOpen}
            />
            <div className="mt-4 text-center">
              <Link to="/menu" className="text-sm font-semibold text-flame-text hover:underline">
                {t.menu.seeFullMenu}
              </Link>
            </div>
          </div>
        )}
        <FireToTable />
        <Story />
        <QuoteBand />
        <Reviews />
        <Visit />
        <ModifierDialog
          item={open}
          category={open ? categoryName(open) : ''}
          onClose={() => setOpen(null)}
        />
        <CartBar />
      </main>
      <Footer />
    </>
  );
}
