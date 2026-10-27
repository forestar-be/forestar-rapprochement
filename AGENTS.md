# AGENTS.md — Forestar Rapprochement

Application de rapprochement bancaire (`rapprochement.forestar.be`) : rapprochement des virements et des factures, exports. Elle consomme l'API de `forestar-server`, routes `/facturation/*`.

## Stack

Next.js 16 (App Router), React 19, TypeScript, Tailwind 4, `@forestar-be/ui` et `@forestar-be/core` (design système commun, dépôt `forestar-frontend`).

## Commandes

Le gestionnaire est pnpm (`packageManager` dans `package.json`).

```bash
pnpm dev
pnpm run build
pnpm run lint
pnpm run format:check
pnpm run check      # format:check + lint
```

Pas de test automatisé.

## Structure

```
src/
├── app/
│   ├── connexion/              # connexion
│   └── (authenticated)/        # pages protégées, dont reconciliations/
├── components/  hooks/  types/
└── lib/                        # api.ts, session.ts, auth.tsx, calculs de rapprochement, imports CSV, export Excel
```

## Authentification

Deux chemins embarqués, un seul actif, choisi au build par `NEXT_PUBLIC_AUTH_MODE` (`src/lib/session.ts`) : `oidc` pour le SSO (client de session unique au niveau du module, pour partager le jeton CSRF), sinon l'ancien login.

## Variables d'environnement

`NEXT_PUBLIC_API_URL` (par défaut `http://localhost:3001`), `NEXT_PUBLIC_AUTH_MODE`, `NEXT_PUBLIC_SSO_ISSUER`. Les `NEXT_PUBLIC_*` sont figées au build. Le déploiement passe par Vercel (`vercel.json`).

## Mémoire du dépôt (wiki)

Avant un travail non trivial, lire le catalogue `docs/agent-memory/README.md` ; en fin de
travail, mettre à jour l'entrée concernée ou en créer une (protocole :
[.agents/guides/memory.md](.agents/guides/memory.md)). Commandes, avec Node ≥ 22.18 :
`node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON tools/agent-memory/check.ts` et `node tools/agent-memory/impact.ts` (ou `pnpm run memory:check` / `memory:impact`).
