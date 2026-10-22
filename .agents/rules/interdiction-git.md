# Interdiction stricte d'utiliser Git

## Règle fondamentale

L'agent a l'**interdiction formelle et absolue** d'exécuter la moindre commande `git` dans le terminal ou via tout outil d'exécution de commandes.

Cette interdiction s'applique à l'ensemble des commandes Git, notamment :
- `git push`
- `git pull` / `git fetch`
- `git checkout` / `git switch`
- `git branch`
- `git merge` / `git rebase`
- `git stash`
- `git reset`

exception, commande autorisé sous demande : 
- `git status`
- `git diff`
- `git log`
- `git add`
- `git commit`

## Justification et périmètre

1. **Responsabilité humaine exclusive** : Le suivi des versions, la préparation des commits, la rédaction des messages de commit et les synchronisations distantes relèvent uniquement de la décision et de l'action de l'utilisateur.
2. **Absence d'effet de bord** : L'agent ne doit à aucun moment interférer avec l'arbre Git de travail, l'index (staging area), les branches locales ou les dépôts distants.
3. **Contrôles et vérifications** : L'agent doit utiliser des outils ou scripts dédiés du projet (par exemple le script de vérification MVC ou les builds Vite) pour vérifier l'intégrité de ses modifications, sans jamais invoquer `git`.

