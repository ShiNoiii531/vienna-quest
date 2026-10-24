# Vienna Quest

**Et si un voyage à deux devenait une aventure en pixel art ?**

Vienna Quest transforme un programme de voyage en quêtes : une carte imaginaire de Vienne, des lieux à dévoiler au bon moment, une progression partagée et des souvenirs à raconter en photos.

Le projet a été créé avec ChatGPT et Codex pour un séjour à Vienne en octobre 2026. Ce dépôt en présente une version anonymisée : les personnages sont « Joueur 1 » et « Joueur 2 », les cadeaux sont destinés à des proches fictifs et l'hôtel est un exemple. L'itinéraire reste un exemple daté d'octobre 2026.

![La carte imaginaire de Vienna Quest](public/vienna-map.webp)

## L'expérience

- **Explorer une carte en pixel art** : déplacement, zoom et parcours au clavier ou au toucher.
- **Garder la surprise** : l'organisateur dévoile les destinations progressivement ; l'explorateur découvre d'abord des indices.
- **Valider les étapes par une photo**, avec aperçu avant enregistrement.
- **Partager la progression** entre les appareils autorisés à accéder au même voyage.
- **Trouver des cadeaux** au fil de quêtes optionnelles, sans photo obligatoire.
- **Constituer un coffre des souvenirs** : plusieurs photos, chacune accompagnée d'un commentaire obligatoire.
- **Conserver les originaux** des photos et leurs métadonnées lorsqu'ils sont disponibles.
- **Utiliser l'interface en paysage**, avec un manifeste et des icônes pour l'ajout à l'écran d'accueil.

Une connexion internet est nécessaire pour la version hébergée. Il ne s'agit pas d'une application hors ligne. La carte est artistique ; les liens d'itinéraire utilisent les véritables adresses.

## Code public, voyage privé

Le dépôt contient le code, les illustrations de l'interface et les migrations de base de données. Il ne contient aucune photo de voyage, aucun commentaire personnel, aucune progression enregistrée, aucun export de base de données ni identifiant de déploiement.

Le site original conserve son accès privé. Ce dépôt n'est pas connecté à sa base de données ou à son stockage photo.

## Stack

| Partie | Technologies |
| --- | --- |
| Interface | React 19, TypeScript, Tailwind CSS 4, composants Radix/shadcn |
| Application | Vinext, Vite et conventions de routage Next.js |
| API | Routes serveur TypeScript, validation Zod |
| Progression | Cloudflare D1 / SQLite, schéma et migrations Drizzle |
| Photos | Cloudflare R2, aperçu JPEG et fichier original |
| Hébergement original | ChatGPT Sites, connexion et accès contrôlés par la plateforme |

## Lancer en local

Prérequis : Node.js 24 et la version de pnpm déclarée dans `package.json`. Les dépendances sont verrouillées dans `pnpm-lock.yaml`.

```bash
pnpm install --frozen-lockfile
```

Copiez `.dev.vars.example` vers `.dev.vars`. L'adresse `seedy@sites.test` est un compte de développement fictif fourni par le plugin local ; elle permet d'utiliser les commandes organisateur.

```bash
pnpm db:setup
pnpm dev
```

Ouvrez `http://localhost:5173` puis utilisez le bouton de connexion. En développement local, cette connexion est simulée et ne demande aucun compte ChatGPT. Les quêtes principales commencent cachées : utilisez le menu organisateur pour les dévoiler.

`db:setup` applique uniquement les migrations dans la base locale, sous `.wrangler/state`. Il n'accède pas au voyage original. Les photos et la progression que vous créez localement restent dans cet environnement de développement.

## Vérifications

```bash
pnpm test
pnpm typecheck
pnpm build
```

Le test d'intégration existant utilise SQLite en mémoire et un stockage objet simulé. Il vérifie notamment les migrations, les commentaires obligatoires, la conservation des originaux, les reprises après interruption, les règles de visibilité et la préservation des anciennes photos.

## Adapter l'aventure

| Fichier | Contenu |
| --- | --- |
| `lib/missions.ts` | Destinations, indices, descriptions, horaires et cadeaux |
| `lib/quest-types.ts` | Types et chapitres du voyage |
| `app/quest.tsx` | Interface principale et commandes organisateur |
| `app/world-map.tsx` | Carte, marqueurs et déplacement du duo |
| `app/quest-photo.tsx` | Photos de validation |
| `app/quest-album.tsx` | Album avec commentaires |
| `app/api/` | Progression et enregistrement des images |
| `db/schema.ts`, `drizzle/` | Schéma et migrations de données |
| `public/` | Carte, personnages et icônes |

Les horaires, réservations et adresses de l'itinéraire sont des données d'exemple historiques, à vérifier et remplacer pour un nouveau voyage. Les noms des joueurs apparaissent aussi dans les textes de l'interface et des routes API.

## Hébergement et accès

L'application possède un serveur, une base D1 et un stockage R2 : **elle ne fonctionne pas directement sur GitHub Pages**.

Pour une nouvelle instance sur ChatGPT Sites, créez un nouveau projet et configurez ses propres ressources ainsi que `ORGANIZER_EMAIL`. Le fichier `.openai/hosting.json` ne contient volontairement aucun `project_id` existant.

L'authentification de production repose sur les en-têtes d'identité injectés par la passerelle de confiance de ChatGPT Sites. Pour héberger ailleurs, remplacez cette intégration par une authentification vérifiée côté serveur : les en-têtes fournis directement par un client ne doivent jamais être considérés comme une identité.

Chaque instance représente **un voyage partagé**, avec une progression et un album communs. Elle n'isole pas plusieurs groupes de voyageurs. Conservez un accès réservé aux participants si vous y stockez des photos. Les originaux peuvent contenir des métadonnées EXIF, notamment de localisation.

## Origine et licences

Projet conçu par [ShiNoiii](https://github.com/ShiNoiii531), avec l'aide de ChatGPT et Codex.

Le code est publié pour présenter le projet. Aucune licence générale de réutilisation n'a encore été choisie pour le code et les illustrations propres à Vienna Quest. Les licences des éléments tiers sont conservées, notamment `build/sites-vite-plugin.LICENSE` et `vendor/shadcn-tailwind-4.13.0.LICENSE.md`.

---

**English:** Vienna Quest turns a trip into a pixel-art adventure, with progressive reveals, shared quests, photo check-ins and a memory album. This is an anonymized source release of a project created for a real trip to Vienna. It includes no private trip photos, saved progress, credentials or production site identifier. The original hosted trip remains private. A backend is required; this is not a GitHub Pages static app.
