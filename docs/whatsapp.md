# WhatsApp notifications (Meta Cloud API)

The site sends booking updates on WhatsApp through Meta's **WhatsApp Cloud
API**. This guide covers what gets sent and to whom, how to set up the Meta
accounts from scratch, the five message templates to get approved, the server
settings, and how to test.

## What is sent, and to whom

A WhatsApp message goes out only when **all** of these are true:

1. The server has `WHATSAPP_ACCESS_TOKEN` and `WHATSAPP_PHONE_NUMBER_ID` set.
2. The customer's mobile number is **verified**: they signed up or logged in
   with a phone OTP, or confirmed the number with a code on
   **Dashboard → Profile**.
3. The customer **opted in** to WhatsApp, either with the tick box when
   verifying their number or with the toggle on **Dashboard → Notifications**.
   This is off by default: Meta's policy requires an explicit opt-in.
4. The event is not muted in their notification preferences.

Changing the number on the profile clears the verification, so nothing is sent
to a new number until the customer proves it's theirs.

| Event | Template | Who gets it |
| --- | --- | --- |
| Payment captured, booking confirmed | `booking_confirmed` | Guest |
| Payment captured, booking confirmed | `host_booking_confirmed` | Host |
| Payment failed | `payment_failed` | Guest |
| Booking cancelled | `booking_cancelled` | Guest |
| Refund completed | `refund_processed` | Guest |

Every message is also saved as an in-app notification, and emails still go out
as before. If WhatsApp fails (template not approved, number not on WhatsApp,
Meta down), the failure is logged and nothing else is affected.

---

## Part 1 — Before you start

Have these ready:

- **A Facebook account** for logging in to Meta. Use a real personal account
  that you'll keep; a new or fake one is often blocked.
- **A phone number for the business** that:
  - can receive an SMS or voice call for verification;
  - is **not** currently registered on WhatsApp or WhatsApp Business. If it is,
    open WhatsApp on that phone → **Settings → Account → Delete account**
    first. A brand-new SIM is simplest.
- **Business documents** for verification: the **GST registration certificate**
  (the legal name and address must match what you type into Meta) and a
  business email address, ideally on the `baagly.com` domain.
- The **website** `https://www.baagly.com`, with the business name and contact
  details visible (the Contact page already covers this).
- A **debit or credit card** for WhatsApp message charges.

## Part 2 — Create the Meta Business account (portfolio)

1. Go to **https://business.facebook.com** and log in with your Facebook
   account.
2. Click **Create account** (it may say "Create a business portfolio").
3. Enter:
   - **Business portfolio name:** `Baagly` (as customers know you);
   - **Your name**, and your **business email**.
4. Click **Create**, then open the confirmation email Meta sends and click
   **Confirm**.

## Part 3 — Verify the business

Without verification you can message only a limited number of customers a day
(250 at the time of writing), and the display name is harder to get approved.
It takes a few days, so start early.

1. In Business Manager, open **Settings** (gear icon) → **Business info**, and
   fill in the **legal business name, address, phone and website** exactly as
   on the GST certificate.
2. Go to **Settings → Security Centre** → **Start verification**.
3. Choose your country (**India**) and confirm the legal name and address.
4. Upload the **GST certificate** when asked for a document.
5. Choose how Meta confirms you: email to an address on your domain, phone
   call, SMS, or domain verification. Email on `@baagly.com` is quickest.
6. Submit. The status shows in the Security Centre, usually within 1–5 working
   days. If it's rejected, the email says which detail didn't match. Fix it
   and resubmit.

## Part 4 — Create the developer app

1. Go to **https://developers.facebook.com** → **Get started**, and register as
   a developer. Accept the terms and verify your phone or email if asked.
2. Click **My Apps → Create app**.
3. Use case: choose **"Connect with customers through WhatsApp"**. On older
   screens, choose **Other → Business**.
4. App name: `Baagly Notifications`. Contact email: your business email.
5. **Business portfolio:** select `Baagly` (from Part 2). This links the app to
   the business.
6. Click **Create app** and re-enter your Facebook password if asked.
7. On the app dashboard, find **WhatsApp** and click **Set up**, or use
   **Customize use case → WhatsApp**. This creates a **WhatsApp Business
   Account (WABA)** and a free **test phone number**.

## Part 5 — Send a test message with the test number

1. In the app, open **WhatsApp → API Setup**. You'll see:
   - a **temporary access token**, valid for 24 hours;
   - the test number's **Phone number ID**;
   - the **WhatsApp Business Account ID**.
2. Under **To**, click **Manage phone number list** and add your own mobile.
   Verify it with the code. In test mode, **only numbers on this list (max 5)
   can receive messages**.
3. Click **Send message**. You should get the `hello_world` message on
   WhatsApp. If it arrives, the account works.

You can point the site at the test number first. Put the temporary token and
the test **Phone number ID** in your local `.env`, and use a customer account
whose verified phone is on the allowed list.

## Part 6 — Add your real business number

1. Open **WhatsApp Manager**: https://business.facebook.com/wa/manage, or
   **WhatsApp → API Setup → Add phone number** in the app.
2. Click **Add phone number** and fill in:
   - **Display name:** `Baagly`. It must match the business name on the website
     and must not be a generic word. Meta reviews it.
   - **Category:** Travel and transport (or the closest match), plus a short
     description.
3. Enter the phone number from Part 1 and verify it with the SMS or voice code.
4. If asked, set a **two-step verification PIN** (6 digits) and write it down.
   If the number shows **Pending** or **Not registered** in WhatsApp Manager,
   register it with this request, using the permanent token from Part 8:

   ```bash
   curl -X POST "https://graph.facebook.com/v21.0/<PHONE_NUMBER_ID>/register" \
     -H "Authorization: Bearer <ACCESS_TOKEN>" \
     -H "Content-Type: application/json" \
     -d '{"messaging_product":"whatsapp","pin":"<YOUR 6-DIGIT PIN>"}'
   # expected: {"success":true}
   ```

5. Wait for **display name approval** (the status shows next to the number,
   usually within a day or two).
6. Copy this number's **Phone number ID**, the long number shown in
   **WhatsApp → API Setup** when the number is selected. **Don't** use the phone
   number itself. This ID goes into `WHATSAPP_PHONE_NUMBER_ID`.

## Part 7 — Add a payment method

Meta charges for business-initiated template messages. Utility messages like
these cost a small amount each in India; check current rates on Meta's pricing
page.

1. In WhatsApp Manager, open **Overview** (or **Settings → Payment settings**).
2. **Add payment method** → currency **INR** → enter the card.

Until a payment method is added, messages to anyone outside the test list fail.

## Part 8 — Create a permanent access token

The token on the API Setup page expires in 24 hours. The server needs one that
doesn't.

1. Go to **Business settings** (https://business.facebook.com/settings) →
   **Users → System users** → **Add**.
2. Name: `baagly-api`. Role: **Admin**. Click **Create system user**.
3. With the system user selected, click **Assign assets**:
   - **Apps** → `Baagly Notifications` → turn on **Full control** (or "Manage
     app");
   - **WhatsApp accounts** → your WhatsApp Business Account → turn on **Full
     control**.
   Save.
4. Click **Generate new token**:
   - App: `Baagly Notifications`;
   - Token expiration: **Never**;
   - Permissions: tick **`whatsapp_business_messaging`** and
     **`whatsapp_business_management`**.
5. Click **Generate token** and **copy it now**. It's shown only once. This is
   `WHATSAPP_ACCESS_TOKEN`. Treat it like a password: never put it in code,
   chat or email.

## Part 9 — Create the five message templates

A business can only start a WhatsApp conversation with a template Meta has
approved. The code sends these five, and **the names, the language and the
number of `{{…}}` placeholders must match exactly**. The code's copy of this
text is in
[`whatsapp-templates.ts`](../apps/api/src/modules/notifications/whatsapp-templates.ts).

For each template below:

1. WhatsApp Manager → **Message templates** → **Create template**.
2. **Category:** **Utility**. (Don't choose Marketing: it costs more and
   customers can mute it.)
3. **Name:** exactly as given (lowercase, with underscores).
4. **Language:** **English** (code `en`). Don't pick English (US) or English
   (UK): the server asks for `en`.
5. **Body:** paste the body text exactly. Then fill in the **sample values**
   Meta asks for; the samples are given below.
6. **Footer** (optional, recommended): `Replies to this number are not
   monitored. Help: +91 99977 60912`.
7. **Buttons**, where listed: **Call to action → Visit website**, with the
   button text and URL given. For a URL ending in `{{1}}`, choose URL type
   **Dynamic** and give the sample URL.
8. **Submit**. Approval usually takes minutes, sometimes up to 24 hours.

### `booking_confirmed` — to the guest

Body:

```
Hi {{1}}, your stay at {{2}} is confirmed. Check-in: {{3}}. Check-out: {{4}}. Guests: {{5}}. Booking ref: {{6}}. Your host: {{7}} ({{8}}). The exact address and directions are on your booking page.
```

Samples: `Asha` · `Lake House Farm` · `Sat, 3 Oct, 2026` · `Sun, 4 Oct, 2026` · `6` · `3E4F5A6B` · `Meera Kapoor` · `+91 98765 43210`

`{{7}}` and `{{8}}` are the host's name and mobile. The mobile is sent only if
the host verified it with an OTP; otherwise `{{8}}` reads "contact them from
your booking page". If this template was already approved with the older
six-placeholder text, edit it in WhatsApp Manager and wait for re-approval:
until then Meta refuses the message for a parameter-count mismatch (`132000`).

Button: **Visit website** · text `View booking` · Dynamic URL
`https://www.baagly.com/booking/{{1}}` · sample
`https://www.baagly.com/booking/3f2b8c1e-4a5d-4e6f-9a7b-1c2d3e4f5a6b`

### `host_booking_confirmed` — to the host

Body:

```
Hi {{1}}, you have a new confirmed booking at {{2}}. Guest: {{3}}. Check-in: {{4}}. Check-out: {{5}}. Guests: {{6}}. The dates are now blocked on your calendar.
```

Samples: `Ravi` · `Lake House Farm` · `Asha Rao` · `Sat, 3 Oct, 2026` · `Sun, 4 Oct, 2026` · `6`

Button: **Visit website** · text `Open calendar` · **Static** URL
`https://www.baagly.com/host/calendar`

### `payment_failed` — to the guest

Body:

```
Hi {{1}}, your payment for {{2}} did not go through. Your dates are still held for a short while, and you can try again from your booking.
```

Samples: `Asha` · `Lake House Farm`

Button: **Visit website** · text `Try again` · Dynamic URL
`https://www.baagly.com/booking/{{1}}` · sample
`https://www.baagly.com/booking/3f2b8c1e-4a5d-4e6f-9a7b-1c2d3e4f5a6b`

### `booking_cancelled` — to the guest

Body:

```
Hi {{1}}, your booking at {{2}} for {{3}} to {{4}} has been cancelled. If a refund is due, it will be sent to the payment method you used.
```

Samples: `Asha` · `Lake House Farm` · `Sat, 3 Oct, 2026` · `Sun, 4 Oct, 2026`

Button: **Visit website** · text `View booking` · Dynamic URL
`https://www.baagly.com/booking/{{1}}` · sample
`https://www.baagly.com/booking/3f2b8c1e-4a5d-4e6f-9a7b-1c2d3e4f5a6b`

### `refund_processed` — to the guest

Body:

```
Hi {{1}}, a refund of {{2}} for your booking at {{3}} has been processed. It usually reaches your account within 5 to 10 working days, depending on your bank.
```

Samples: `Asha` · `₹12,500` · `Lake House Farm`

No button.

> Meta may reject a template for wording, for example if it reads as
> promotional. If it does, adjust the wording (not the number of placeholders)
> and resubmit, then update the matching text in `whatsapp-templates.ts` so the
> two stay in step. If a template is ever renamed or a placeholder added or
> removed, the code must change too.

## Part 10 — Configure the server

On the production server, add to `.env.production`:

```env
WHATSAPP_ACCESS_TOKEN=<permanent token from Part 8>
WHATSAPP_PHONE_NUMBER_ID=<Phone number ID of the real number, from Part 6>
WHATSAPP_API_VERSION=v21.0
WHATSAPP_TEMPLATE_LANGUAGE=en
```

Then deploy (this release also has a database migration) and restart the API:

```bash
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml logs --tail=60 api
```

**Admin → Settings** should now show **WhatsApp: Meta Cloud API**.

The same four lines go in your local `.env` for development; there, use the
test number from Part 5 if the real one isn't approved yet.

## Part 11 — Test end to end

1. Sign in to the site as a customer. On **Dashboard → Profile**, enter your
   mobile, click **Send code**, enter the SMS code, **tick "Send my booking
   updates on WhatsApp"**, and click **Verify**. The badge shows **Verified**.
2. Book a stay and pay. Within a few seconds you should get
   **booking_confirmed** on WhatsApp, and the host (if their phone is verified
   and opted in) should get **host_booking_confirmed**.
3. Cancel and refund it from the admin panel. You should get
   **booking_cancelled**, and **refund_processed** once the refund completes.

If nothing arrives, check the API log:

```bash
docker compose -f docker-compose.prod.yml logs api | grep -i whatsapp
```

| Error in the log | Meaning | Fix |
| --- | --- | --- |
| `190` / "access token" / "session has expired" | Token wrong or expired | Make a permanent token (Part 8) |
| `132001` "template name does not exist" | Template not approved yet, name misspelt, or wrong language | Check the name and **English (`en`)** in WhatsApp Manager |
| `132000` "number of parameters does not match" | Approved text has a different number of `{{…}}` | Make the template match Part 9 |
| `131030` "recipient not in allowed list" | Still using the test number | Add the recipient in API Setup, or switch to the real number |
| `131026` "message undeliverable" | That number isn't on WhatsApp, or has an old app version | Nothing to fix; email still went |
| `131042` payment / "eligibility" | No payment method | Part 7 |
| `368` or "temporarily blocked" | Quality or policy block | See **Account quality** in WhatsApp Manager |

No log line at all means no send was attempted. Check that the customer's phone
is **Verified** and that the WhatsApp toggle on Dashboard → Notifications is
on.

## Good to know

- **Replies aren't read.** The Cloud API delivers customer replies only to a
  webhook, which this site doesn't have yet. The footer text in Part 9 tells
  customers where to get help instead.
- **Messaging limits.** A new number can start conversations with a limited
  number of customers per day. The limit rises automatically as you send
  good-quality messages and after business verification. You can see it under
  **WhatsApp Manager → Phone numbers → Messaging limit**.
- **Quality rating.** If many customers block or report the number, Meta
  lowers its rating and then its limit. Opt-in only, useful messages only: keep
  it that way.
- **Changing wording** means editing the template in WhatsApp Manager and
  waiting for re-approval. The code only chooses the template and fills the
  placeholders.
