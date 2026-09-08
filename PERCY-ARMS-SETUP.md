# Percy Arms: finish the Cloudflare move

This update targets [your GitHub repository](https://github.com/5tb7gtnj5y-lgtm/Percy_arms_-Site), based on commit `25cdff57356a149a9cf9c2cfb5545a89cbe09bd9`.

It replaces the old hosting sign-in with Cloudflare Access, fixes the lunch photograph, protects staff API requests and preserves dashboard variables on future deployments. The existing menu, meat availability and order controls remain available.

The files are prepared locally. They are not live until uploaded and deployed. Cloudflare Access and the runtime settings below still need configuring in your account.

## 1. Upload the update in GitHub

1. Extract the downloaded update ZIP on your computer.
2. Open **Percy_arms_-Site**, the first repository in your GitHub screenshot.
3. Select **Add file → Upload files**.
4. Drag everything **inside** the extracted folder into the upload area. Keep the `app`, `lib`, `scripts`, `tests` and `worker` folders intact. Upload the extracted files and folders; uploading the ZIP itself does not update the app.
5. Scroll down and select **Commit changes** to `main`.

This is an update package: you do not need to re-upload the entire site. Cloudflare's connected build should start after the commit. Keep its existing settings:

| Cloudflare build setting | Value |
|---|---|
| Root directory | `/` |
| Build command | `npm run build` |
| Deploy command | `npx wrangler deploy` |

## 2. Set up staff sign-in in Cloudflare

Open [Cloudflare](https://dash.cloudflare.com/) and enter **Zero Trust** for the account that owns the Worker. Complete the team setup if this is your first visit. Your chosen team name creates an address such as `https://your-team.cloudflareaccess.com`; it is separate from the website address.

1. In Zero Trust, open **Integrations → Identity providers** and add **One-time PIN** if it is not already available. This sends staff a sign-in code by email. [Cloudflare instructions](https://developers.cloudflare.com/cloudflare-one/integrations/identity-providers/one-time-pin/)
2. Open **Access controls → Applications → Add an application → Self-hosted**.
3. Name it **Percy Arms Admin**. Set the application hostname to `percy-arms--site.kmvbcbwmw2.workers.dev` and its path to `/admin`. Use a one-hour session. This application protects the admin page; the menu stays public. Cloudflare supports hostname/path applications on workers.dev. Do not select protection for all Worker traffic, which would also require customers to sign in. [Path-specific protection](https://developers.cloudflare.com/workers/configuration/cloudflare-access/#protect-a-specific-hostname)
4. Add an **Allow** policy with **Include → Emails**, containing the exact email address you will use as admin. Select **One-time PIN** as an allowed login method and save the application. Limit the policy to named staff addresses.
5. Under the application's **Advanced settings → Cookie settings**, keep **HttpOnly** enabled and **Cookie Path Attribute** disabled. The staff cookie must reach the same site's `/api/` requests as well as `/admin`. [Cookie settings](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/#cookie-settings)
6. Open the application's **Additional settings** and copy its **Application Audience (AUD) Tag**. [Where to find the AUD tag](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/)

Now open **Workers & Pages → percy-arms--site → Settings → Variables and Secrets**. Add these as the Worker's runtime variables, then save/deploy the settings:

| Variable name | Value to enter |
|---|---|
| `TEAM_DOMAIN` | Your complete Access team address, for example `https://your-team.cloudflareaccess.com` |
| `POLICY_AUD` | The AUD tag copied from **Percy Arms Admin** |
| `ADMIN_EMAIL` | The same exact admin email address used in the Allow policy |

These belong in Worker runtime settings, not the build variables. `POLICY_AUD` is the Access application's audience, not the database UUID. The update's `keep_vars` setting preserves dashboard variables on subsequent GitHub deployments. [Wrangler variable behaviour](https://developers.cloudflare.com/workers/wrangler/configuration/#source-of-truth)

To add another admin later, add their address to both the Access Allow policy and `ADMIN_EMAIL`, separating addresses in `ADMIN_EMAIL` with commas. To remove access, remove them from both and save.

## 3. Finish the database setup

The menu now responds, but the `orders` table has not yet been confirmed in your live database.

Open [the percy-arms-orders database console](https://dash.cloudflare.com/80320ac2d42d2bfe819d26fc24290d7b/workers/d1/databases/13d3e393-23ec-4ca5-b6cf-5966a7ecd03e/console). Open `scripts/cloudflare-repair-order-tables.sql` from the extracted update in a text editor, copy its SQL into the console and select **Execute**.

It creates missing ordering tables and preserves existing tables and their data. The final result should list `menu_extras`, `order_settings` and `orders`.

If an older `orders` table already exists, this script will leave it alone. To check its columns, run `PRAGMA table_info(orders);`. It should include `seen_at`, `status`, `status_updated_at` and `allergen_acknowledged`. If any are absent, capture that result before applying further schema changes.

Developer note: this is an additive recovery script, not a recorded historical migration. The earlier manual menu-table repair was not recorded in the migration ledger. Reconcile that ledger with the actual schema before enabling automatic migrations; do not replay the old CREATE/ALTER migrations blindly. Historical migration files are unchanged by this update.

## 4. Confirm the menu and email settings

1. Open [the website](https://percy-arms--site.kmvbcbwmw2.workers.dev/) and check that the photograph and menu load without signing in.
2. Select **Admin sign in**, or [open Admin](https://percy-arms--site.kmvbcbwmw2.workers.dev/admin). Enter the allowed email address and the code Cloudflare sends you.
3. Set the actual adult and child prices, extras and order-recipient email in the admin panel, then save. The displayed £12.95/£7.95 fallback prices are examples until you confirm them. `configured: false` means the menu settings have not been completed; checkout remains disabled until they are saved.
4. For order emails, add your existing `RESEND_API_KEY` as a Worker secret and `RESEND_FROM_EMAIL` as the sender address for your verified Resend domain. This is separate from Cloudflare's sign-in emails. The app can store orders while email setup is incomplete, but the pub will need to watch its dashboard.
5. When ready, place one clearly labelled test order and confirm it appears in Admin and reaches the order inbox. Check mark-as-seen and clearing seen orders before opening service.

## Verification included with this update

`npm run test:access` checks valid and invalid signatures, expiry, audience, issuer, staff allowlists, cookie authentication, rejected forged headers and same-origin checks.

`npm run test:worker` builds the production Worker and tests it with an isolated local D1 database and locally signed test identities. All outbound traffic is intercepted. It checks the public page/photo/menu, protected staff endpoints, saving prices, storing orders, marking/clearing seen orders, per-meat availability, closing all orders, and safely repeating the database repair.

These local checks do not prove that the live Access application, actual email inbox or production database has been configured. Those are the account setup steps above.
