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

The syntax checker validates first-party JavaScript and JavaScript embedded in HTML. The tests cover first publication, re-publishing without duplicate listings, ownership denial, rapid-click prevention, and failure recovery. They use mocked Firebase services and do **not** make network requests or write production data.

GitHub Actions runs both commands on pull requests and selected pushes. Keep changes on a feature branch and review the check results before merging.

## Deployment and release safety

The default branch is the canonical source. Do not assume merging a pull request deploys a verified release. Test the complete sign-in → create → edit → publish → view workflow against an appropriate Firebase test project before production deployment. Back up relevant Firestore data and verify security rules before making changes to persistence or payments.

**Known limitations:** The repository does not currently include checked-in Firestore/Storage rules or a full end-to-end Firebase integration test. Paid checkout and voting authorization require separate security work. Passing syntax and mocked tests alone does not certify production readiness.
