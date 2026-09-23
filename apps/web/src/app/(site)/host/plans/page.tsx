'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { EmptyState, ErrorState, Spinner } from '@/components/ui/feedback';
import { hostApi } from '@/lib/host/host-api';
import { ApiError } from '@/lib/api/errors';
import { brand } from '@/lib/config/brand';
import {
  formatMonthlyPrice,
  listingLimitLabel,
  planEnquiryHref,
  type SubscriptionPlan,
} from '@/lib/plans/plans';
import { cn } from '@/lib/cn';
import styles from './plans.module.css';

export default function HostPlansPage() {
  const [plans, setPlans] = useState<SubscriptionPlan[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    setError(null);
    hostApi
      .plans()
      .then(setPlans)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load plans.'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div>
      <p className="t-label">Subscription</p>
      <h1 className="t-h2">Monthly listing plans</h1>
      <p className={`t-body ${styles.lead}`}>
        Pick the plan that fits how many properties you list. Choosing a plan emails our team, and we&apos;ll set up
        your subscription and confirm billing with you.
      </p>

      {loading ? (
        <Spinner label="Loading plans" />
      ) : error ? (
        <ErrorState description={error} onRetry={load} />
      ) : !plans?.length ? (
        <EmptyState
          title="No plans published yet"
          description={`Plans will appear here once they're announced. Questions? Write to ${brand.support.email}.`}
        />
      ) : (
        <div className={styles.grid}>
          {plans.map((plan) => (
            <article key={plan.id} className={cn(styles.card, plan.isFeatured && styles.cardFeatured)}>
              {plan.isFeatured ? <span className={styles.badge}>Most popular</span> : null}
              <h2 className="t-h3">{plan.name}</h2>
              {plan.description ? <p className="t-body-small">{plan.description}</p> : null}
              <p className={styles.price}>
                <span className={styles.amount}>{formatMonthlyPrice(plan.monthlyPrice)}</span>
                {Number(plan.monthlyPrice) > 0 ? <span className="t-caption"> / month</span> : null}
              </p>
              <p className={styles.limit}>{listingLimitLabel(plan.listingLimit)}</p>
              {plan.features.length ? (
                <ul className={styles.features}>
                  {plan.features.map((feature) => (
                    <li key={feature}>{feature}</li>
                  ))}
                </ul>
              ) : null}
              <div className={styles.cta}>
                <Button href={planEnquiryHref(plan.name)} variant={plan.isFeatured ? 'primary' : 'secondary'} block>
                  Choose {plan.name}
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}

      <p className={`t-body-small ${styles.footnote}`}>
        Prefer to talk? Call <a href={brand.support.phoneHref}>{brand.support.phone}</a> ({brand.support.hours}).
      </p>
    </div>
  );
}
