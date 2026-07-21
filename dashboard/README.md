# Email Security Dashboard

A React + Vite + Tailwind operator dashboard scaffold for the Email Security Pipeline project.

## Local development

1. Install dependencies:
   ```bash
   cd dashboard
   npm install
   ```
2. Run the dev server:
   ```bash
   npm run dev
   ```

## Build

```bash
npm run build
```

## AWS Amplify deployment

1. Create or connect an Amplify app to the repo branch containing `dashboard/`.
2. Set the Amplify environment variables:
   - `VITE_API_BASE_URL` = `https://esp-api.naratech.xyz`
   - `VITE_SITE_NAME` = `SecureInbox`
3. Add `secureinbox.skywork.website` as an Amplify custom domain.
4. Use the `amplify.yml` file for build settings.
5. Enable branch previews for per-PR preview environments.

## Notes
- Add the custom domain in Amplify console under "Domain management".
- Point `secureinbox.skywork.website` to Amplify using the generated DNS records.
- Ensure the Amplify environment variables are set for the production branch.

- This app is intended for AWS Amplify hosting with per-PR preview environments.
- The upload tool posts raw email data to the inference API at `/score`.
- The frontend is intended to be hosted at `secureinbox.skywork.website`.
