/*
  Guest and Host terms, held as data rather than as JSX.

  Two documents share one renderer, so the structure has to describe every shape
  that actually appears in them: bullet lists, the standalone bold lines that
  state standard check-in and check-out, and the lead-in before each document's
  closing "non-negotiable" list. Keeping it as data also means the table of
  contents, the anchors and the page metadata are all derived from one place
  instead of being kept in sync by hand.

  The wording is the client's own policy draft and is reproduced verbatim. Edit
  the text here, never in the components.
*/

export type TermsBlock =
  | { kind: 'list'; items: string[] }
  /** A standalone emphasised line, e.g. "Standard Check-In: 2:00 PM onwards". */
  | { kind: 'note'; text: string }
  /** Introductory line above a list, e.g. "Every Guest MUST:". */
  | { kind: 'lead'; text: string }
  /** Closing emphasis after a list. */
  | { kind: 'closing'; text: string };

export type TermsSection = {
  /** Anchor slug; also the table-of-contents target. */
  id: string;
  number: number;
  title: string;
  blocks: TermsBlock[];
};

export type TermsDocument = {
  slug: 'guest' | 'host';
  title: string;
  subtitle: string;
  /** Shown as a callout above the document. */
  important: string;
  sections: TermsSection[];
};

const DISCLAIMER =
  'These terms are a structured platform-policy draft and should be reviewed by a qualified legal professional before commercial launch.';

export const GUEST_TERMS: TermsDocument = {
  slug: 'guest',
  title: 'Guest Terms & Conditions',
  subtitle: 'For Guests booking properties through the Platform',
  important: DISCLAIMER,
  sections: [
    {
      id: 'registration',
      number: 1,
      title: 'Guest Registration & Verification',
      blocks: [
        {
          kind: 'list',
          items: [
            'Every Guest must complete the registration and verification process required by the Platform before making or accessing a reservation.',
            'Guests must provide accurate and current personal and contact information.',
            "A Guest may not use another person's identity, create fraudulent accounts, or provide misleading information.",
            'The Platform may request reasonable verification information for safety, fraud prevention, and booking purposes.',
          ],
        },
      ],
    },
    {
      id: 'booking-information',
      number: 2,
      title: 'Booking & Guest Information',
      blocks: [
        {
          kind: 'list',
          items: [
            'Guests must provide the correct number of people who will stay at the property.',
            "The maximum occupancy specified in the listing must not be exceeded without the Host's prior approval.",
            'Only the individuals permitted under the reservation and applicable house rules may access or stay at the property.',
            'Guests must not transfer or resell a reservation to another person without Platform approval.',
          ],
        },
      ],
    },
    {
      id: 'payment',
      number: 3,
      title: 'Payment & Charges',
      blocks: [
        {
          kind: 'list',
          items: [
            'Guests must pay the total amount displayed at checkout, including applicable accommodation charges, Platform service fees, taxes, and any other mandatory charges disclosed before booking.',
            "Guests must use an approved payment method and must not attempt to bypass the Platform's payment system.",
            'Any refundable security deposit or other clearly disclosed charge must be paid according to the applicable booking terms.',
            'Undisclosed or unauthorized charges demanded by a Host may be reported to the Platform.',
          ],
        },
      ],
    },
    {
      id: 'check-in-out',
      number: 4,
      title: 'Check-In & Check-Out',
      blocks: [
        { kind: 'note', text: 'Standard Check-In: 2:00 PM onwards' },
        { kind: 'note', text: 'Standard Check-Out: By 11:00 AM' },
        {
          kind: 'list',
          items: [
            'The exact check-in and check-out time for the selected property will be displayed on the listing before booking and will take precedence where it differs from the standard Platform timing.',
            'Early check-in or late check-out is subject to Host approval, availability, and any applicable additional fee.',
            "Guests must follow the property's check-in procedure and provide any information reasonably required for access.",
            'Guests must leave the property and return keys, access cards, or other property equipment by the stated check-out time unless a late check-out has been approved.',
          ],
        },
      ],
    },
    {
      id: 'house-rules',
      number: 5,
      title: 'House Rules & Property Use',
      blocks: [
        {
          kind: 'list',
          items: [
            'Guests must read and comply with all house rules displayed on the property listing before booking.',
            'House rules may cover smoking, pets, parties and events, noise, quiet hours, pool usage, parking, visitors, photography or filming, and use of property facilities.',
            'Guests must use the property only for the purpose permitted by the listing and reservation.',
            'Guests must not make structural changes, move major furniture or equipment unnecessarily, or use the property in a manner that may cause damage.',
          ],
        },
      ],
    },
    {
      id: 'parties',
      number: 6,
      title: 'Parties, Events & Noise',
      blocks: [
        {
          kind: 'list',
          items: [
            'Guests must not organize parties, events, gatherings, or commercial activities that are prohibited by the listing or house rules.',
            'Guests must respect applicable quiet hours and the surrounding community.',
            'Unauthorized guests, gatherings, or events may result in cancellation of the reservation without refund where permitted by the applicable policy.',
            'Guests may be responsible for verified damage, additional cleaning, security costs, or other reasonable losses caused by unauthorized events.',
          ],
        },
      ],
    },
    {
      id: 'damage',
      number: 7,
      title: 'Property Damage & Security Deposit',
      blocks: [
        {
          kind: 'list',
          items: [
            'Guests are responsible for reasonable care of the property, furnishings, appliances, equipment, and other items provided for their use.',
            'Guests must promptly report accidental damage or safety issues to the Host or Platform.',
            'Where a Guest causes verified damage, the Platform may process a reasonable damage claim in accordance with its damage and dispute policy.',
            'Any deduction from a refundable security deposit must be supported by the applicable policy and reasonable evidence.',
            'Guests are not responsible for ordinary wear and tear or damage that they did not cause.',
          ],
        },
      ],
    },
    {
      id: 'cleanliness',
      number: 8,
      title: 'Cleanliness & Responsible Use',
      blocks: [
        {
          kind: 'list',
          items: [
            'Guests must leave the property in a reasonably tidy condition and follow any clearly disclosed cleaning requirements.',
            'Guests must not intentionally create excessive waste, damage facilities, or misuse appliances, pools, furniture, or other amenities.',
            'Additional cleaning charges may apply only where they are permitted under the disclosed booking terms and supported by the applicable policy.',
          ],
        },
      ],
    },
    {
      id: 'safety',
      number: 9,
      title: 'Safety, Security & Prohibited Activities',
      blocks: [
        {
          kind: 'list',
          items: [
            'Guests must comply with all applicable laws and safety requirements while using the property.',
            'Illegal activities, violence, threats, harassment, theft, fraud, or dangerous conduct are strictly prohibited.',
            'Guests must not bring or use prohibited or unlawful items at the property.',
            'Guests must not disable, damage, or interfere with legitimate safety equipment such as fire alarms or emergency systems.',
            'The Platform or Host may take appropriate action, including cancellation or suspension, where serious safety or legal concerns arise.',
          ],
        },
      ],
    },
    {
      id: 'privacy',
      number: 10,
      title: 'Privacy & Respect for Host and Community',
      blocks: [
        {
          kind: 'list',
          items: [
            'Guests must respect the privacy, property, and reasonable instructions of Hosts, staff, neighbours, and other residents.',
            'Guests must not harass, threaten, intimidate, or discriminate against Hosts, staff, neighbours, or other users.',
            'Guests must not record or publish private information about Hosts, staff, or other individuals without appropriate permission or legal basis.',
          ],
        },
      ],
    },
    {
      id: 'cancellation',
      number: 11,
      title: 'Cancellation & Refunds',
      blocks: [
        {
          kind: 'list',
          items: [
            'Guest cancellations are subject to the cancellation policy displayed for the specific property at the time of booking.',
            'Refund eligibility may depend on when the cancellation is made and the applicable cancellation policy.',
            "If a property is unavailable due to a Host cancellation or a serious issue covered by the Platform's rebooking or refund policy, the Guest may be eligible for a refund or alternative accommodation assistance.",
            'Service fees, taxes, and other amounts may be treated according to the applicable refund policy and law.',
          ],
        },
      ],
    },
    {
      id: 'problems',
      number: 12,
      title: 'Problems With the Property',
      blocks: [
        {
          kind: 'list',
          items: [
            'Guests should report material problems with the property to the Host and/or Platform as soon as reasonably possible after discovering them.',
            'Where appropriate, Guests should provide photographs, videos, descriptions, or other reasonable evidence to help the Platform assess the issue.',
            'Depending on the circumstances and applicable policy, the Platform may provide troubleshooting, relocation assistance, partial or full refund, or another appropriate resolution.',
          ],
        },
      ],
    },
    {
      id: 'reviews',
      number: 13,
      title: 'Reviews & Ratings',
      blocks: [
        {
          kind: 'list',
          items: [
            'Guests may submit a review after an eligible completed reservation.',
            "Reviews must be honest, relevant, and based on the Guest's genuine experience.",
            'Guests must not threaten, manipulate, bribe, or pressure a Host in exchange for a review or refund.',
            'Fake, discriminatory, abusive, retaliatory, or otherwise policy-violating reviews may be removed by the Platform.',
          ],
        },
      ],
    },
    {
      id: 'changes',
      number: 14,
      title: 'Reservation Changes & Unauthorized Transfers',
      blocks: [
        {
          kind: 'list',
          items: [
            'Any change to dates, number of Guests, or other material booking details must be made through the Platform or approved by the Host where required.',
            'Guests must not transfer, sell, or commercially resell reservations without authorization.',
            'Changes that affect price, occupancy, or availability may result in additional charges or may require a new reservation.',
          ],
        },
      ],
    },
    {
      id: 'suspension',
      number: 15,
      title: 'Account Suspension & Termination',
      blocks: [
        {
          kind: 'list',
          items: [
            'The Platform may suspend, restrict, or terminate a Guest account or reservation where the Guest violates these Terms, provides fraudulent information, causes serious property damage, engages in illegal or unsafe conduct, repeatedly violates house rules, or otherwise misuses the Platform.',
            'Where appropriate and legally permitted, the Platform may cancel future reservations associated with a suspended or terminated account.',
          ],
        },
      ],
    },
    {
      id: 'responsibilities',
      number: 16,
      title: "Guest's Non-Negotiable Responsibilities",
      blocks: [
        { kind: 'lead', text: 'Every Guest MUST:' },
        {
          kind: 'list',
          items: [
            'Provide accurate personal and booking information.',
            'Respect the maximum occupancy and approved Guest list.',
            'Pay all disclosed booking charges.',
            "Follow the property's house rules.",
            'Respect check-in and check-out timings.',
            'Take reasonable care of the property and report damage promptly.',
            'Respect Hosts, staff, neighbours, and the surrounding community.',
            'Never engage in illegal, violent, fraudulent, or unsafe activities.',
            "Use the Platform's official payment and dispute processes.",
            'Provide honest and respectful reviews.',
          ],
        },
        {
          kind: 'closing',
          text: 'These requirements are non-negotiable and apply to every Guest using the Platform.',
        },
      ],
    },
  ],
};

export const HOST_TERMS: TermsDocument = {
  slug: 'host',
  title: 'Host Terms & Conditions',
  subtitle: 'For Hosts listing properties on the Platform',
  important: DISCLAIMER,
  sections: [
    {
      id: 'verification',
      number: 1,
      title: 'Host Verification & Registration',
      blocks: [
        {
          kind: 'list',
          items: [
            'Every Host must complete the registration and verification process before listing a property.',
            'The Host must provide accurate and valid personal, contact, and property-related information.',
            'The Host must have the legal right, ownership, authorization, or permission required to offer the property for short-term rental.',
            'The Platform reserves the right to request additional information or documentation for verification and safety purposes.',
            'A Host may not create multiple or misleading accounts to avoid Platform restrictions.',
          ],
        },
      ],
    },
    {
      id: 'accurate-listing',
      number: 2,
      title: 'Accurate Property Listing',
      blocks: [
        {
          kind: 'list',
          items: [
            'All information provided in a property listing must be true, accurate, complete, and up to date.',
            "Photos and videos must represent the property's current condition.",
            "The Host must clearly disclose the property's location, facilities, amenities, maximum occupancy, parking availability, pool facilities, accessibility, restrictions, and any other material information.",
            'The Host must disclose any additional mandatory charges before the Guest confirms the booking.',
            'The Host must not advertise facilities or services that are unavailable at the property.',
          ],
        },
      ],
    },
    {
      id: 'safety-cleanliness',
      number: 3,
      title: 'Property Safety & Cleanliness',
      blocks: [
        {
          kind: 'list',
          items: [
            'The Host must provide the property in a clean, safe, hygienic, and reasonably maintained condition.',
            'Electrical, gas, water, swimming-pool, fire-safety, and other relevant facilities must be maintained appropriately.',
            'Any known safety hazards must be disclosed to the Platform and/or Guest where applicable.',
            'The Host is responsible for complying with applicable local laws, regulations, permits, licences, and safety requirements.',
          ],
        },
      ],
    },
    {
      id: 'guest-privacy',
      number: 4,
      title: 'Guest Privacy & Security',
      blocks: [
        {
          kind: 'list',
          items: [
            "The Host must respect the Guest's privacy and must not unlawfully monitor, record, photograph, or otherwise surveil Guests.",
            'Any legally permitted security or monitoring equipment must be disclosed in accordance with applicable law and Platform policy.',
            "The Host must not enter an occupied property without the Guest's consent, except in a genuine emergency or where otherwise legally permitted.",
          ],
        },
      ],
    },
    {
      id: 'booking-confirmation',
      number: 5,
      title: 'Booking Confirmation & Host Responsibility',
      blocks: [
        {
          kind: 'list',
          items: [
            'Once a reservation is confirmed, the Host is expected to honour the booking according to the listing details and reservation terms.',
            "The Host must not substitute the property, materially change the facilities, or impose new mandatory conditions after confirmation without the Guest's agreement.",
            'The Host must provide reasonable instructions necessary for check-in and access to the property.',
          ],
        },
      ],
    },
    {
      id: 'check-in-out',
      number: 6,
      title: 'Check-In & Check-Out',
      blocks: [
        { kind: 'note', text: 'Standard Check-In: 2:00 PM onwards' },
        { kind: 'note', text: 'Standard Check-Out: By 11:00 AM' },
        {
          kind: 'list',
          items: [
            'The exact check-in and check-out time for each property must be clearly displayed on its listing before booking.',
            "Early check-in or late check-out may be permitted at the Host's discretion and may be subject to availability and additional charges.",
            'The Host must not unreasonably deny access during the confirmed check-in period.',
            'Guests must vacate the property by the stated check-out time unless a late check-out has been approved.',
          ],
        },
      ],
    },
    {
      id: 'house-rules',
      number: 7,
      title: 'House Rules',
      blocks: [
        {
          kind: 'list',
          items: [
            'The Host may establish reasonable property-specific rules, including rules regarding maximum Guests, smoking, pets, parties and events, noise and quiet hours, pool usage, parking, visitors, commercial photography or filming, and use of appliances and facilities.',
            'All material house rules and restrictions must be clearly disclosed before the Guest makes a booking.',
            'Hosts may not introduce unreasonable or undisclosed rules after a reservation has been confirmed.',
          ],
        },
      ],
    },
    {
      id: 'host-cancellation',
      number: 8,
      title: 'Cancellation by Host',
      blocks: [
        {
          kind: 'list',
          items: [
            'Hosts should avoid cancelling confirmed reservations except where genuinely necessary.',
            "If a Host cancels a confirmed reservation without an eligible reason, the Platform may issue a full or applicable refund to the Guest, withhold or reduce the Host's payout, apply a cancellation fee or other penalty, restrict the Host's ability to accept future bookings, and/or suspend or remove the listing in cases of repeated or serious violations.",
            "The exact consequences will depend on the Platform's applicable cancellation policy.",
          ],
        },
      ],
    },
    {
      id: 'damage',
      number: 9,
      title: 'Damage, Security Deposit & Additional Charges',
      blocks: [
        {
          kind: 'list',
          items: [
            "The Host may report genuine property damage caused by a Guest through the Platform's damage-claim process.",
            'Any claim must be supported by reasonable evidence, such as photographs, invoices, receipts, or other relevant documentation.',
            'A Host may not impose arbitrary, excessive, or undisclosed charges.',
            'Where a refundable security deposit applies, the amount must be clearly disclosed before booking.',
            "Legitimate deductions from a security deposit must be based on verified damage or other clearly stated charges under the Platform's policy.",
          ],
        },
      ],
    },
    {
      id: 'prohibited-conduct',
      number: 10,
      title: 'Prohibited Host Conduct',
      blocks: [
        {
          kind: 'list',
          items: [
            'The Host must not provide false or misleading information; discriminate against Guests unlawfully; harass, threaten, or intimidate Guests; misuse Guest information; enter an occupied property without proper justification; attempt to move transactions outside the Platform to avoid applicable fees or safety protections; demand undisclosed payments; facilitate illegal activities; or use the Platform for fraudulent or deceptive purposes.',
          ],
        },
      ],
    },
    {
      id: 'reviews',
      number: 11,
      title: 'Reviews & Ratings',
      blocks: [
        {
          kind: 'list',
          items: [
            'Hosts may review Guests only after an eligible completed reservation.',
            'Reviews must be honest, relevant, and based on the actual booking experience.',
            'Hosts must not threaten, manipulate, bribe, or pressure Guests to provide positive reviews.',
            'Fake, retaliatory, discriminatory, or abusive reviews may be removed by the Platform.',
          ],
        },
      ],
    },
    {
      id: 'payments',
      number: 12,
      title: 'Host Payments',
      blocks: [
        {
          kind: 'list',
          items: [
            "Host payouts will be processed according to the Platform's applicable payment and payout policy.",
            'The Platform may deduct applicable service fees, taxes, refunds, penalties, or approved damage-related amounts before releasing a payout.',
            'Hosts are responsible for providing accurate payment and tax information where required.',
          ],
        },
      ],
    },
    {
      id: 'legal-compliance',
      number: 13,
      title: 'Legal Compliance',
      blocks: [
        {
          kind: 'list',
          items: [
            'Hosts are solely responsible for ensuring that their property and rental activities comply with all applicable local, state, and national laws and regulations.',
            'This may include property permissions, licences, taxes, zoning requirements, safety requirements, accommodation regulations, and other applicable obligations.',
            'The Platform may suspend or remove a listing if it reasonably believes the listing violates applicable law or Platform policies.',
          ],
        },
      ],
    },
    {
      id: 'suspension',
      number: 14,
      title: 'Suspension & Removal',
      blocks: [
        {
          kind: 'list',
          items: [
            'The Platform reserves the right to suspend, restrict, or permanently remove a Host or property listing where the Host violates these Terms, provides fraudulent or misleading information, repeatedly cancels confirmed reservations, creates safety risks, receives serious or repeated Guest complaints, engages in illegal or harmful conduct, or otherwise misuses the Platform.',
          ],
        },
      ],
    },
    {
      id: 'responsibilities',
      number: 15,
      title: "Host's Non-Negotiable Responsibilities",
      blocks: [
        { kind: 'lead', text: 'Every Host MUST:' },
        {
          kind: 'list',
          items: [
            'Provide an accurate listing.',
            'Maintain a safe and clean property.',
            'Disclose all mandatory charges.',
            'Respect Guest privacy.',
            'Honour confirmed bookings.',
            'Clearly communicate check-in/check-out times.',
            'Follow applicable laws.',
            'Follow Platform safety and cancellation policies.',
          ],
        },
        {
          kind: 'closing',
          text: 'These requirements are non-negotiable and apply to every Host using the Platform.',
        },
      ],
    },
  ],
};

export const TERMS_DOCUMENTS = [GUEST_TERMS, HOST_TERMS] as const;

export function termsBySlug(slug: string): TermsDocument | null {
  return TERMS_DOCUMENTS.find((document) => document.slug === slug) ?? null;
}
