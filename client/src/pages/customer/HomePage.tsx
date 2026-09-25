import type { MenuItemDto } from '@ros/shared';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { CartBar } from '../../features/cart/CartBar';
import { ModifierDialog } from '../../features/cart/ModifierDialog';
import { Hero } from '../../features/landing/Hero';
import {
  Footer,
  HowItWorks,
  Marquee,
  QuoteBand,
  Reviews,
  Story,
  Visit,
} from '../../features/landing/Sections';
import { useMenu } from '../../features/menu/menuApi';
import { SignatureRail } from '../../features/menu/SignatureRail';
import { pickSignatures } from '../../features/menu/signatures';

/** The customer landing page (design 31): hero, live signatures, story, reviews, visit. */
export function HomePage() {
  const { data } = useMenu();
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
                  Chef&rsquo;s <span className="text-flame">signatures</span>
                </>
              }
              items={signatures}
              categoryName={categoryName}
              onOpen={setOpen}
            />
            <div className="mt-4 text-center">
              <Link to="/menu" className="text-sm font-semibold text-flame-text hover:underline">
                See the full menu →
              </Link>
            </div>
          </div>
        )}
        <HowItWorks />
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
