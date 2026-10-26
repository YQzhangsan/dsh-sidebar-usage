# Publishing dsh-sidebar-usage

Repository: <https://github.com/YQzhangsan/Big-fish>
Package: `dsh-sidebar-usage` · npm name checked free on 2026-10-27

The in-app market has no upload form. Its catalog comes from the curated
[awesome-dsh-plugin](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin) registry,
and **the only way onto it is one YAML file in a pull request there**. The market's
"申请收录插件 / Submit a plugin" link opens that project's contributing guide. This page
keeps the prepared entry and the remaining steps.

## Status

- The plugin (manifest with `dsh.bundle` + `dsh.client`, host route, browser bar, docs,
  LICENSE, raster storefront icon) is on `main`.
- The catalog entry is ready at [`market/awesome-entry.yml`](market/awesome-entry.yml)
  with the real repository values; it only has to be copied into the awesome-list PR.
- **Repository age gate:** the repo was created 2026-10-26T17:47:09Z. CI requires a
  repository at least one day old, so open the catalog PR **after 2026-10-27T17:47:00Z**
  (2026-10-28 01:47 China time). Opening it earlier fails a mechanical check.

## 1. Repository topic

On GitHub: **About → Topics** → add `dsh-plugin`. The catalog CI and storefronts read it.

## 2. Install straight from the repository

```sh
dsh plugin --profile <profile> add github:YQzhangsan/Big-fish
```

## 3. Optional: publish to npm

A prebuilt npm package installs without the `allowBuilds` build-approval prompt, so the
market card's install is smoother. The package has no build step and no `private` flag.

```sh
npm login --registry=https://registry.npmjs.org
npm publish --access public --registry=https://registry.npmjs.org
```

The local `~/.npmrc` points at `registry.npmmirror.com`, which is a read-only mirror;
publishing must name the official registry explicitly, as above.

## 4. Open the catalog PR

1. Fork <https://github.com/awesome-dsh-plugin/awesome-dsh-plugin>.
2. Add exactly one file, `data/plugins/YQzhangsan__Big-fish.yml`, containing the content
   of [`market/awesome-entry.yml`](market/awesome-entry.yml) (do not edit the generated
   README files).
3. Commit, push, and open the pull request (after the one-day gate).

CI checks, in order: at most three entries per PR, the `dsh.bundle` manifest in the
repository, repository age, then `awesome-lint` and the site build. A maintainer then
reads the repository against the description before merging.

## 5. After merge

The website and the in-app market rebuild automatically and usually pick the entry up
within a day. No further action is needed.

## Keeping it accurate

Change only your own `data/plugins/YQzhangsan__Big-fish.yml`. The English description is
read as a claim about the code, so keep it matching what the plugin does.
