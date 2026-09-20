import type { TermsDocument } from '@/lib/legal/terms-content';

/*
  The policy documents a payment gateway asks for before it will onboard a
  merchant: privacy, refunds, and a statement on shipping and returns. They
  share the terms renderer so they get the same table of contents, anchors and
  metadata for free.

  Everything here describes what the platform actually does — which data the
  signup and host-verification forms collect, that card details never touch
  our servers, that refunds go back the way they came — so that a reader
  checking the policy against the product finds them the same. Edit the text
  here, never in the components.
*/

const REVIEW_NOTE =
  'This policy describes how the Platform operates today. It should be reviewed by a qualified legal professional before commercial launch, and will be updated here if the way we handle data or payments changes.';

export const PRIVACY_POLICY: TermsDocument = {
  slug: 'privacy',
  title: 'Privacy Policy',
  subtitle: 'What we collect, why, and who can see it',
  important: REVIEW_NOTE,
  sections: [
    {
      id: 'what-we-collect',
      number: 1,
      title: 'What We Collect',
      blocks: [
        { kind: 'lead', text: 'When you create an account or book a stay:' },
        {
          kind: 'list',
          items: [
            'Your name, email address and mobile number, and a password if you sign up with email. If you sign in with Google, we receive your name and email address from Google and never see your Google password.',
            'One-time verification codes sent to your email or mobile, which are stored only as a hash and expire within minutes.',
            'Booking details: the property, dates, number of guests, the amount paid, and any coupon used.',
            'Anything you write to us or to a host through the Platform, including support requests.',
          ],
        },
        { kind: 'lead', text: 'When you list a property as a host, additionally:' },
        {
          kind: 'list',
          items: [
            'Identity documents required by law before a listing can go live: your PAN number, and images of your PAN and Aadhaar cards, which are kept for verification. Of the Aadhaar number itself we store only the last four digits and a one-way hash used to detect duplicate accounts; the full number is not stored as text.',
            'Bank account details for payouts, of which only the last four digits are shown back to you.',
            "The property's address and map location, photographs, pricing and house rules — which are published as part of the listing.",
          ],
        },
        { kind: 'lead', text: 'Automatically:' },
        {
          kind: 'list',
          items: [
            'Standard server logs: IP address, browser type, the pages requested and when. These are used for security and rate limiting and are not sold or shared.',
            'Your approximate location, only if you tap "Near me" on the map page and grant permission. It is used in your browser for that session and is never sent to our servers or stored.',
          ],
        },
      ],
    },
    {
      id: 'payments',
      number: 2,
      title: 'Payments',
      blocks: [
        {
          kind: 'list',
          items: [
            'Payments are processed by Instamojo, a licensed payment gateway. When you pay, you are taken to a page operated by Instamojo, and your card, UPI or bank details are entered there.',
            "We never receive or store your card number, CVV, UPI PIN or bank login. We receive only a payment reference, the amount, and whether the payment succeeded.",
            "Instamojo's handling of your payment details is governed by its own privacy policy.",
          ],
        },
      ],
    },
    {
      id: 'how-we-use-it',
      number: 3,
      title: 'How We Use It',
      blocks: [
        {
          kind: 'list',
          items: [
            'To operate your account, take and confirm bookings, and pay hosts.',
            'To send you the emails and messages that a booking requires: verification codes, booking confirmations, payment reminders, cancellations and refunds. These are transactional, not marketing.',
            'To verify hosts as the law requires, and to detect fraud, duplicate accounts and abuse.',
            'To respond when you contact support.',
            'We do not sell personal data, and we do not use it for advertising.',
          ],
        },
      ],
    },
    {
      id: 'who-can-see-it',
      number: 4,
      title: 'Who Can See It',
      blocks: [
        {
          kind: 'list',
          items: [
            'The host of a property you book sees your name, the dates, the number of guests and the amount, so they can receive you. They do not see your payment details.',
            "A guest who books sees the host's name and, once the booking is paid, the property's exact address.",
            'Platform administrators can see account, booking and verification details in order to approve listings, resolve disputes and process refunds. Identity documents are visible only to administrators, only for verification.',
            'Service providers who act on our behalf: the payment gateway (Instamojo), our email and SMS delivery providers, and the servers that host the Platform. Each receives only what it needs to do its job.',
            'Authorities, where the law requires it.',
          ],
        },
      ],
    },
    {
      id: 'cookies',
      number: 5,
      title: 'Cookies',
      blocks: [
        {
          kind: 'list',
          items: [
            'We set one cookie: a secure, HTTP-only session cookie that keeps you signed in. It contains no personal details.',
            'A short-lived cookie is used during Google sign-in to protect against forged sign-in attempts, and is cleared when sign-in completes.',
            'Your browser may remember small conveniences such as a draft listing you were writing. That is stored on your device, not with us.',
            'We do not use advertising or cross-site tracking cookies.',
          ],
        },
      ],
    },
    {
      id: 'retention',
      number: 6,
      title: 'How Long We Keep It',
      blocks: [
        {
          kind: 'list',
          items: [
            'Account details are kept while your account is active.',
            'Booking and payment records are kept for as long as Indian tax and company law require, which can be up to eight years.',
            'Verification codes are deleted within minutes of expiring.',
            'Server logs are rotated and are not kept longer than necessary for security.',
          ],
        },
      ],
    },
    {
      id: 'your-rights',
      number: 7,
      title: 'Your Rights',
      blocks: [
        {
          kind: 'list',
          items: [
            'You can see and update your name, phone number and notification preferences from your account at any time.',
            'You can ask us for a copy of the personal data we hold about you, to correct it, or to delete your account. Records we are legally required to keep, such as completed booking and payment records, will be retained for the required period.',
            "To make any of these requests, write to us at the address below. We will respond within thirty days.",
          ],
        },
      ],
    },
    {
      id: 'contact',
      number: 8,
      title: 'Contact',
      blocks: [
        {
          kind: 'list',
          items: [
            'Email: info@baagly.com',
            'Phone: +91 99977 60912, every day 9am – 9pm IST',
            'Questions about this policy, or about your data, can be sent to either.',
          ],
        },
      ],
    },
  ],
};

export const REFUND_POLICY: TermsDocument = {
  slug: 'refund-policy',
  title: 'Cancellation & Refund Policy',
  subtitle: 'When a booking can be cancelled, and how money comes back',
  important: REVIEW_NOTE,
  sections: [
    {
      id: 'before-payment',
      number: 1,
      title: 'Before You Pay',
      blocks: [
        {
          kind: 'list',
          items: [
            'A reservation holds the dates for a short time while you pay. If payment is not completed within that hold, the reservation expires on its own and the dates are released. Nothing is charged.',
            'A payment that fails or is cancelled at the payment gateway is not charged. Your reservation stays open until the hold expires, and you can try again without making a new booking.',
            'If a payment is deducted by your bank but not confirmed to us, it is reversed by the gateway automatically, usually within five to seven working days.',
          ],
        },
      ],
    },
    {
      id: 'cancellation-windows',
      number: 2,
      title: 'Cancelling a Confirmed Booking',
      blocks: [
        {
          kind: 'list',
          items: [
            'Every listing shows its cancellation policy on the property page and again before you pay. That policy — including how many days before check-in a free cancellation is allowed, and what portion is refunded after — is the one that applies to your booking.',
            'You can cancel a confirmed booking from your Trips page at any time before check-in.',
            'When you cancel within the free-cancellation window shown for the property, the full amount you paid is refunded.',
            "When you cancel after that window, the refund is the amount the property's policy provides for. Any difference is retained to compensate the host for dates that can no longer be sold.",
            'Bookings are not refundable after check-in, or for a stay that was not taken up, unless the host agrees or the circumstances in section 4 apply.',
          ],
        },
      ],
    },
    {
      id: 'host-cancellation',
      number: 3,
      title: 'If the Host Cancels',
      blocks: [
        {
          kind: 'list',
          items: [
            'If a host cancels your confirmed booking, you receive a full refund of everything you paid, regardless of how close to check-in it happens.',
            'Where we can, we will also help you find an alternative stay.',
          ],
        },
      ],
    },
    {
      id: 'problems-at-the-property',
      number: 4,
      title: 'Problems at the Property',
      blocks: [
        {
          kind: 'list',
          items: [
            'If a property is materially different from its listing, unsafe, or not made available to you at check-in, contact us as soon as possible and no later than 24 hours after check-in, with photographs where relevant.',
            'Depending on the circumstances we may arrange a fix with the host, relocate you, or issue a partial or full refund.',
            'Issues raised after the stay has ended are considered but are harder to verify, and refunds in that case are at our discretion.',
          ],
        },
      ],
    },
    {
      id: 'how-refunds-are-paid',
      number: 5,
      title: 'How Refunds Are Paid',
      blocks: [
        {
          kind: 'list',
          items: [
            'Refunds are always returned to the payment method you paid with. We cannot redirect a refund to a different card, account or UPI ID.',
            'Once approved, a refund is submitted to Instamojo the same day. It typically appears in your account within five to ten working days, depending on your bank; UPI refunds are usually faster than card refunds.',
            'You are notified in your account when the refund is processed. If the money has not arrived after ten working days, contact us with your booking ID and we will trace it with the gateway.',
            'Refunds are made in Indian Rupees for the amount originally paid. Any currency conversion or bank charges on your side are outside our control.',
          ],
        },
      ],
    },
    {
      id: 'coupons-and-fees',
      number: 6,
      title: 'Coupons and Fees',
      blocks: [
        {
          kind: 'list',
          items: [
            'A discount applied with a coupon is not paid out in cash. If a discounted booking is refunded, you receive back what you actually paid.',
            'The platform fee shown in your price breakdown is refunded together with the stay amount whenever the stay amount is refunded in full.',
          ],
        },
      ],
    },
    {
      id: 'contact',
      number: 7,
      title: 'Contact',
      blocks: [
        {
          kind: 'list',
          items: [
            'Email: info@baagly.com',
            'Phone: +91 99977 60912, every day 9am – 9pm IST',
            'Please quote your booking ID, shown on your booking page and in your confirmation email.',
          ],
        },
      ],
    },
  ],
};

export const SHIPPING_AND_RETURNS: TermsDocument = {
  slug: 'shipping-and-returns',
  title: 'Shipping & Returns',
  subtitle: 'Why this policy is short',
  important:
    'Baagly is a booking platform for stays. Nothing is shipped and nothing can be returned. This page exists because payment providers ask for it.',
  sections: [
    {
      id: 'no-shipping',
      number: 1,
      title: 'Shipping',
      blocks: [
        {
          kind: 'list',
          items: [
            'We do not sell or deliver physical goods. A booking is confirmed by email and is visible on your Trips page immediately after payment; there is nothing to ship and no delivery charge.',
            "The property's exact address is shared with you once the booking is paid.",
          ],
        },
      ],
    },
    {
      id: 'no-returns',
      number: 2,
      title: 'Returns',
      blocks: [
        {
          kind: 'list',
          items: [
            'Because nothing physical changes hands, there is no return process.',
            'Changing your mind about a stay is a cancellation, and is covered by the Cancellation & Refund Policy, which sets out the windows and how money is returned.',
          ],
        },
      ],
    },
    {
      id: 'contact',
      number: 3,
      title: 'Contact',
      blocks: [
        {
          kind: 'list',
          items: ['Email: info@baagly.com', 'Phone: +91 99977 60912, every day 9am – 9pm IST'],
        },
      ],
    },
  ],
};

export const POLICY_DOCUMENTS = [PRIVACY_POLICY, REFUND_POLICY, SHIPPING_AND_RETURNS] as const;
