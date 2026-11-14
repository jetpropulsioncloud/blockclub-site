# BlockClub Site

Minecraft server advertising website.

## Architecture

- Static HTML, CSS, and browser JavaScript render listings, server pages, and the visual page builder.
- Firebase Authentication handles user sign-in; Cloud Firestore stores listings, page drafts, and published layouts.
- Firebase Cloud Functions provide server-status lookups, Minecraft voting, and PayPal webhook handling.
- Firebase Storage holds uploaded images.

## Source checks

Use Node.js 22. Before proposing a change, run:

```sh
npm run check:syntax
npm test
```

The syntax checker validates first-party JavaScript and inline scripts. The Node regression suite covers first publication, repeat publication without duplicate listings, owner checks, double-click prevention, failure recovery, blocked publishing during initial loading, and Add Text initialization. These tests use mocked Firebase services and make no production requests.

## Isolated browser integration tests

The repository includes a Playwright + Firebase Emulator Suite smoke test that follows the real website's sign-up → publish → re-publish → reload/edit → icon upload → public server page → logout/login workflow.

The test environment uses:

- `demo-blockclub-e2e`, a non-deployable Firebase **demo** project ID.
- `.firebase-e2e.json` to start local Auth (9099), Firestore (8080), Storage (9199), and Hosting (5000) emulators.
- `firestore.rules` and `storage.rules` as review candidates under automated test, not verified live rules. The superseded permissive emulator fixtures have been removed from this security branch.
- A browser interceptor that replaces requests to the production Minecraft status Cloud Function with an offline test response; no production status requests are sent.

To run locally, use a **disposable clone** of the repository with Node.js 22, Java 21, and Chromium prerequisites:

```sh
npm install --no-save --package-lock=false playwright@1.58.2 firebase-tools@14.26.0
npx playwright install chromium
npx firebase emulators:exec --project demo-blockclub-e2e --config .firebase-e2e.json --only auth,firestore,storage,hosting "node tests/browser-e2e.cjs"
```

The GitHub Actions browser workflow runs this test on pull requests and uses Ubuntu 24.04. Its security checks exercise owner-versus-nonowner reads/writes, denied billing and premium changes, owner-only private settings and Storage paths, and transactional upvotes. It clears the accidentally tracked `node_modules` directory **only inside its disposable runner** before doing a fresh install. Do not delete a developer's working dependencies casually.

## Release safety

The default branch remains the canonical production source. This repo currently has no verified staging environment that mirrors production security rules. The emulator smoke test verifies browser interactions with the isolated test rules, **not production authorization**.

Before merging and deploying a release:

1. Review the actual deployed Firestore and Storage rules, then test owner and non-owner permissions against a faithful staging copy of those rules.
2. Verify image upload, storage deletion, and publish/edit/preview using an isolated Firebase staging project.
3. Back up relevant Firestore and Storage data and confirm a working rollback procedure.
4. Check the site's external service configuration and payment/voting endpoints separately.

**Known limitations:** The repository does not contain checked-in production Firestore/Storage rules. Billing, server-side voting authorization, and transactionality across published server data and assets require later security/data-integrity phases. Passing the emulator, syntax and unit checks is not certification for paid production use.

## Candidate Firebase rules — deployment safety

The proposed `firestore.rules` and `storage.rules` are intentionally **not** added to `firebase.json`, so the existing hosting/functions deployment configuration cannot accidentally publish them. They must first be compared with the active production rules for project `blockclub-4742a`, verified with representative existing documents and staging, and approved as a separate release step. Never replace live rules with permissive test fixture files.

**Known migration risks:** existing public `servers` documents may include PayPal subscription identifiers or owner email addresses; security rules cannot hide individual fields within a readable document. Username-to-email login exposes email through public username lookups. Anonymous client-side view increments are not rate limited. Published IP uniqueness is not server-enforced. The PayPal plan mismatch and webhook processing still require fixes before paid activation is enabled.
