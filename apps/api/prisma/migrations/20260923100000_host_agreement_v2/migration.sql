-- Replaces the starter host agreement with a full marketplace agreement.
--
-- Why: the seeded version 1 read as house rules — what a host promises about
-- their property. A payment gateway reviewing a marketplace for onboarding is
-- looking for something else entirely: the commercial and legal relationship
-- between the platform and the seller, and above all a written appointment of
-- the platform as the seller's limited agent for collecting payments. Without
-- that clause a gateway cannot satisfy itself that money collected from guests
-- may lawfully be settled to third-party hosts.
--
-- Version 1 is left in place; hosts who signed it keep that record, and are
-- asked to sign version 2 the next time they submit a listing.
--
-- Dollar-quoted so the text can contain apostrophes without escaping.

UPDATE "HostAgreement" SET "isActive" = false WHERE "isActive" = true;

-- The version number is computed rather than hardcoded: this database may
-- already carry versions published from the admin panel before this deploy.
INSERT INTO "HostAgreement" ("id", "version", "title", "body", "isActive")
VALUES (
    gen_random_uuid()::text,
    (SELECT COALESCE(MAX("version"), 0) + 1 FROM "HostAgreement"),
    'Host Agreement',
    $agreement$## 1. Parties, scope and definitions
- This Host Agreement ("Agreement") is entered into between [[LEGAL ENTITY NAME]], having its registered office at [[REGISTERED OFFICE ADDRESS]], which operates the Baagly platform at www.baagly.com ("Platform", "we", "us"), and the individual or entity listing a property through it ("Host", "you").
- You accept this Agreement electronically by signing it against a listing. It governs that listing and every booking made for it from the date of signature.
- "Guest" means a person who books a Stay through the Platform. "Listing" means the page describing your property. "Stay" means the accommodation you provide for a booking. "Booking Value" means the total amount payable by the Guest for a booking, excluding any amount the Guest pays you directly for services outside the booking.

## 2. Relationship between the parties
- You are an independent contractor. Nothing in this Agreement creates an employment, partnership, joint venture, franchise or agency relationship between you and the Platform, except the limited payment collection agency expressly created by clause 3.
- The Platform is a technology marketplace that lists accommodation and facilitates bookings and payments. It does not own, lease, operate, manage or control your property.
- The contract for the Stay is between you and the Guest. The Platform is not a party to it and is not a provider, re-seller or guarantor of the accommodation.
- You remain solely responsible for the property, for the Stay, and for compliance with every law that applies to letting it.

## 3. Appointment of the Platform as limited payment collection agent
- You irrevocably appoint the Platform as your limited agent for the sole purpose of collecting, holding and remitting to you amounts payable by Guests for bookings of your property, and you authorise the Platform to do so through its licensed payment gateway.
- Payment by a Guest to the Platform for a booking discharges the Guest's payment obligation to you for that booking to the extent of the amount paid, exactly as if the Guest had paid you directly. You will not seek that amount from the Guest again.
- Amounts collected are held by the Platform or its payment gateway on your behalf until they become payable to you under clause 7, and are not the Platform's income except to the extent of the Platform Service Fee and taxes under clauses 6 and 8.
- This appointment is limited to the collection and remittance of payments. It does not authorise the Platform to enter into contracts on your behalf, to accept liability for the Stay, or to act for you for any other purpose.
- You confirm you have full authority to make this appointment in respect of every property you list.

## 4. Listing, verification and approval
- You confirm that you own each property you list or are lawfully authorised by its owner to let it and to enter into this Agreement in respect of it.
- Before a Listing can be submitted for approval you will complete the Platform's host verification, which includes verifying a mobile number and providing PAN and Aadhaar identity details and a bank account for payouts. You will keep those details accurate and current.
- Every detail in a Listing — photographs, location, capacity, bedrooms and bathrooms, amenities, pricing, house rules and cancellation policy — must be accurate, current and not misleading. Photographs must be of the property being let.
- A Listing becomes visible to Guests only after the Platform approves it. The Platform may request changes, decline a Listing, or suspend or remove a Listing that breaches this Agreement, is inaccurate, or attracts serious Guest complaints.
- Approval by the Platform is not an endorsement, inspection certificate or warranty of the property, and does not transfer any of your responsibilities to the Platform.

## 5. Bookings, availability and pricing
- You set the nightly rate, weekend rate, extra-guest charge, minimum stay, check-in and check-out times, house rules and cancellation policy for each Listing through the Platform.
- A booking that is confirmed and paid through the Platform is a binding reservation. You will honour it at the price and on the dates shown to the Guest at the time of booking.
- You will keep your availability calendar accurate and will block dates that are not available. A confirmed booking that you cannot honour because your calendar was wrong is treated as a Host cancellation under clause 9.
- You will not discriminate against any Guest on grounds of religion, caste, sex, place of birth, race, disability, sexual orientation or any other ground prohibited by law.
- You will not charge the Guest any amount that was not disclosed in the Listing before booking, other than a lawful, clearly disclosed security deposit or a charge for genuine damage caused during the Stay.

## 6. Platform Service Fee
- In consideration of the services provided under this Agreement, the Platform charges a Platform Service Fee on each confirmed booking. The Fee is currently five per cent (5%) of the Booking Value and is shown to you in the price breakdown before you submit a Listing and on your Earnings page for every booking.
- The Platform may change the Fee on not less than thirty (30) days' notice sent to your registered email address. A change applies only to bookings made after it takes effect. If you do not accept a change you may stop accepting new bookings and terminate this Agreement under clause 17.
- Goods and Services Tax is charged on the Platform Service Fee at the rate in force and is shown separately.
- Payment gateway charges levied on a transaction are borne by the Platform out of the Platform Service Fee unless the Listing or your Earnings page states otherwise.

## 7. Collection, settlement and payouts
- Guest payments are collected by the Platform through its payment gateway at the time of booking and are held until they become payable to you.
- Amounts for a booking become payable to you after the Guest has checked out. Amounts for bookings that have not yet taken place are not payable and are shown separately on your Earnings page as upcoming.
- Your payout for a booking is the Booking Value less: the Platform Service Fee and tax on it; any refund made to the Guest for that booking; any chargeback, payment reversal or fraudulent-payment loss relating to that booking; any cancellation charge or penalty properly applied under this Agreement; and any tax the Platform is required by law to deduct.
- Payouts are transferred to the bank account recorded on your host profile within seven (7) business days of a payout becoming payable, subject to your verification being complete and your bank details being valid.
- You are responsible for the accuracy of your bank details. A transfer made to the details you supplied is a completed payout, and the Platform is not liable for a transfer made to details that were wrong when you supplied them.
- The Platform may withhold a payout, in whole or in part, while a Guest dispute, refund request, chargeback, damage claim, suspected fraud or verification concern relating to that booking or your account is open, and may set off against your payouts any amount you owe the Platform under this Agreement.
- Your Earnings page is a statement of account. If you believe an amount is wrong, tell us within thirty (30) days of the payout; after that the statement is treated as accepted, except for manifest error.

## 8. Taxes
- Each party is responsible for its own taxes. You are solely responsible for income tax on your earnings from bookings.
- Where the Platform is required to deduct tax at source, including under Section 194-O of the Income-tax Act, 1961, it will deduct at the rate prescribed from time to time, deposit it against your PAN, and make the corresponding certificate available. You will keep a valid PAN on your profile; without one, tax may be deducted at a higher rate prescribed by law.
- You are responsible for determining whether you are required to register for Goods and Services Tax, for charging and remitting GST where applicable, and for filing your own returns. If you are registered, you will provide your GSTIN and keep it current.
- You are responsible for any local body tax, luxury tax, tourism levy or similar charge applicable to letting your property.

## 9. Cancellations, refunds and chargebacks
- Guest cancellations and the resulting refunds are governed by the cancellation policy displayed on your Listing at the time of booking, read with the Platform's Cancellation and Refund Policy.
- If you cancel a confirmed booking, the Guest receives a full refund of everything they paid, regardless of how close to check-in the cancellation occurs. The Platform may in addition recover from your payouts a cancellation charge, restrict your ability to accept new bookings, and suspend or remove the Listing where cancellations are repeated or serious.
- Where a property is materially different from its Listing, is unsafe, or is not made available to a Guest at check-in, the Platform may refund the Guest in whole or in part and recover that amount from your payouts.
- If a Guest's payment is reversed by a chargeback or is found to be fraudulent after a payout has been made, the amount is recoverable from your subsequent payouts or, if none are due, as a debt.
- Refunds are made to the Guest's original payment method. The Platform does not make refunds in cash or to a different instrument.

## 10. Payments outside the Platform
- You will not ask a Guest who found your property through the Platform to pay you outside the Platform, in whole or in part, and will not offer an inducement to book off the Platform.
- This does not prevent you from collecting a clearly disclosed security deposit or a charge for genuine damage in accordance with clause 5, or from letting your property to guests who did not come through the Platform.
- Breach of this clause entitles the Platform to recover the Platform Service Fee that would have been payable, to suspend or terminate your account, and to remove your Listings.

## 11. Your representations, warranties and undertakings
- You have the legal right and all necessary permissions, licences, registrations and approvals to let the property, and letting it does not breach any lease, mortgage, housing society rule, local law or municipal regulation that applies to it.
- The property complies with applicable safety, health, fire and building requirements, is fit for occupation, and is clean and in the condition described at each check-in.
- You will comply with all applicable law in connection with the Stay, including any requirement to record guest identity or to report the presence of foreign nationals to the authorities.
- You have and will maintain the authority to grant the payment collection agency in clause 3 and the licence in clause 15.
- The information you give the Platform, including identity and bank details, is true and complete, and you will update it promptly if it changes.

## 12. Guest safety and property standards
- You will not install, and will not permit, any device capable of recording or observing the interior of a private area of the property, and will disclose any security device monitoring the exterior in the Listing.
- You will provide working smoke detection, fire extinguishing means and emergency contact information appropriate to the property, and will keep access routes clear.
- You will respond promptly to a Guest's reasonable requests during a Stay and will provide a means of contact for emergencies.
- You will report to the Platform, promptly, any incident at the property involving injury, a safety hazard, damage, or the involvement of the police or emergency services in connection with a Stay.

## 13. Indemnity
- You will indemnify and hold harmless the Platform, its directors, officers, employees and agents against all claims, demands, proceedings, losses, damages, fines, penalties, costs and expenses (including reasonable legal fees) arising out of or in connection with: your breach of this Agreement; the condition, safety or letting of your property; any injury, death, loss or damage suffered by a Guest or any other person at the property; any tax, levy or duty for which you are responsible; and any claim that a Listing or its content infringes a third party's rights.
- This indemnity survives termination of this Agreement.

## 14. Limitation of liability
- The Platform provides the marketplace and the payment collection service on a reasonable-efforts basis and does not warrant that bookings will reach any level, or that the service will be uninterrupted or error-free.
- The Platform is not liable to you for loss of profit, loss of anticipated bookings, loss of goodwill or any indirect or consequential loss.
- To the maximum extent permitted by law, the Platform's total liability to you in connection with this Agreement in any twelve-month period is limited to the total Platform Service Fees it retained from your bookings in that period.
- Nothing in this clause limits liability for fraud, for wilful misconduct, or for any liability that cannot lawfully be limited.

## 15. Content, licence and confidentiality
- You grant the Platform a non-exclusive, worldwide, royalty-free licence to use, reproduce, adapt and display the photographs, descriptions and other content you upload, for the purpose of operating, marketing and promoting the Platform and your Listing. This licence ends when the content is removed, except for copies already made in the ordinary course.
- You confirm you own that content or have the right to grant this licence.
- Guest personal data made available to you is provided solely to allow you to host that Guest. You will keep it confidential, will not use it for marketing, will not disclose it except as required by law, and will not retain it longer than necessary.
- Each party will keep the other's confidential business information confidential.

## 16. Data protection
- Each party will comply with applicable data protection law in respect of personal data it handles under this Agreement.
- The Platform's handling of personal data is described in its Privacy Policy, which forms part of this Agreement.

## 17. Suspension, termination and survival
- Either party may terminate this Agreement by written notice, including by removing all Listings, subject to this clause.
- Termination does not affect bookings already confirmed. You will honour every confirmed booking whose check-in falls on or before the effective date of termination, or the Guest will be refunded in full and clause 9 will apply.
- The Platform may suspend or terminate your account immediately where it reasonably believes you have breached this Agreement, where there is a risk to Guest safety, where there is suspected fraud or misrepresentation, or where required by law.
- Amounts due to you for completed Stays remain payable after termination, subject to the deductions and withholdings in clause 7.
- Clauses 8, 9, 13, 14, 15, 16, 19 and 20 survive termination.

## 18. Changes to this Agreement
- The Platform may publish a revised version of this Agreement. A revised version applies to you only once you have signed it.
- You will be asked to read and sign the revised version before your next Listing is submitted for approval. Bookings made before you sign continue to be governed by the version you signed for that Listing.
- Signed versions are retained by the Platform as a record of what was agreed and when.

## 19. Governing law, jurisdiction and disputes
- This Agreement is governed by the laws of India.
- The parties will first attempt to resolve any dispute in good faith. A dispute not resolved within thirty (30) days will be referred to arbitration by a sole arbitrator under the Arbitration and Conciliation Act, 1996. The seat and venue of arbitration is [[CITY]], India, and the language is English.
- Subject to arbitration, the courts at [[CITY]], India have exclusive jurisdiction.

## 20. Notices
- Notices to you are sent to the email address on your account and are treated as received on the day of sending.
- Notices to the Platform are sent to info@baagly.com and to the registered office address in clause 1.
- You will keep your contact details current.

## 21. Entire agreement and severability
- This Agreement, together with the Host Terms and Conditions, the Cancellation and Refund Policy and the Privacy Policy published on the Platform, is the entire agreement between the parties in respect of its subject matter and replaces any prior understanding.
- If any provision is held invalid or unenforceable, the rest continues in force.
- A failure to enforce a provision is not a waiver of it.

## 22. Electronic signature
- By typing your full name below and submitting, you sign this Agreement electronically under the Information Technology Act, 2000. It has the same effect as a handwritten signature.
- The Platform records your name, the date and time, the version of this Agreement you signed, and the internet address from which you signed, as evidence of your signature.$agreement$,
    true
);
