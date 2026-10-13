# Pull request validation

The site uses Node 22, declared in `.nvmrc` and `package.json`. Run the same validation as CI from a clean checkout:

```sh
npm ci
npm run check
npm run test:audit
npm run build
npm run audit
```

`npm run check` runs Astro's TypeScript-aware checker. `npm run test:audit` exercises the static auditor against isolated fixtures. `npm run audit` inspects the generated `dist` directory for broken internal page links, missing local assets, duplicate HTML IDs, and missing fragment targets. The audit discovers generated pages rather than requiring a fixed route list, so adding or removing a legitimate route does not require editing the script.

Pull requests targeting `main` run `.github/workflows/pr-validation.yml`. Its required check name is exactly **Website validation**. The workflow has read-only repository contents permission and does not deploy.

## Proposed branch protection

In the GitHub ruleset or branch protection settings for `main`, require a pull request and require the **Website validation** status check before merging. This is a repository-settings proposal only; adding the workflow does not change branch protection.

Publishing remains separate. `.github/workflows/deploy.yml` runs only for pushes to `main` and deploys the already merged site to GitHub Pages.
