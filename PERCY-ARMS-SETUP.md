# Percy Arms Sunday Lunch

This ZIP contains the source code for version 10 of the Percy Arms Sunday Lunch ordering site.

Live site: https://percy-arms-sunday-lunch.ismington.chatgpt.site

## Included

- Customer Sunday lunch ordering page
- Dine-in and takeaway time selection
- Adult and children's meals
- Chicken, beef and pork availability controls
- Extras and pricing controls
- Allergen acknowledgement and Food Standards Agency link
- Admin order dashboard, new-order notification, mark-as-seen and deletion controls
- Cloudflare D1 database schema and migrations
- Resend order-email integration

## Not included

For security and customer privacy, the ZIP does not contain live customer orders, the production database, API keys, email credentials or other environment secrets.

## Requirements

- Node.js 22.13 or newer
- A Cloudflare account with a D1 database binding named `DB`
- For order emails: `RESEND_API_KEY` and `RESEND_FROM_EMAIL` environment variables

## Local installation

```bash
npm ci
npm run dev
```

## Production build

```bash
npm run build
```

The project is based on Next.js/Vinext and is configured for Cloudflare hosting. The `.openai/hosting.json` file refers to the existing ChatGPT Sites project; create or amend the hosting configuration before deploying it into a different account.
