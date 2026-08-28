# Planos Zupet Walker — Free vs Pro

Documento de referência oficial para os limites e funcionalidades de cada plano.
Atualizado em: 2026-08-28

---

## Limites por plano

| Funcionalidade | Free | Pro |
|---|---|---|
| Pets vinculados por tutores | até **7** | ilimitado |
| Pets cadastrados pelo walker | até **7** | ilimitado |
| Serviços criados | até **1** | ilimitado |
| Pets simultâneos por passeio | até **2** | até `max_pets_per_walk` do perfil |
| Histórico de relatórios | últimos **7 dias** | histórico completo |
| Agendamentos de última hora | não | sim |
| Dashboard web (walker.zupet.io) | sim | sim |
| Código de convite para tutores | sim | sim |

---

## Onde os limites são aplicados no código

| Limite | Arquivo | Mecanismo |
|---|---|---|
| Pets vinculados | `app/(tabs)/pets.tsx` | Verificação antes de aceitar vínculo |
| Pets próprios | `app/(tabs)/pets.tsx` | Verificação antes de abrir tela de cadastro |
| Serviços | `app/services/index.tsx` | Verificação na função `openNew()` |
| Pets por passeio | `app/walk/start.tsx` | Verificação na função `toggle()` |
| Histórico relatórios | `app/(tabs)/financeiro.tsx` | Filtro de data na query + banner informativo |

Todos os limites são lidos de `lib/plan.ts` via `getLimits(walkerProfile)`.

---

## Constantes (`lib/plan.ts`)

```ts
PLAN_LIMITS.free.linkedPets  = 7
PLAN_LIMITS.free.ownPets     = 7
PLAN_LIMITS.free.services    = 1
PLAN_LIMITS.free.petsPerWalk = 2
PLAN_LIMITS.free.reportDays  = 7
PLAN_LIMITS.free.lastMinute  = false
```

Para alterar um limite, edite apenas `lib/plan.ts` — todos os bloqueios seguem automaticamente.

---

## Como promover um walker para Pro

Acesse o dashboard admin: `/dashboard/walker/walkers`

- Clique no badge de plano do walker (coluna "Plano")
- Confirme no modal com uma nota interna (ex: "beta tester", "parceiro")
- O campo `plan` em `walker_profiles` é atualizado para `'pro'` e um registro é criado em `walker_subscriptions`

Para revogar Pro: mesmo fluxo — o badge muda para "Revogar Pro".

---

## Notas

- O campo `plan` em `walker_profiles` é a fonte de verdade — `'free'` ou `'pro'`
- Bloqueios são aplicados apenas no cliente (app mobile e web); o banco não tem constraints por plano
- A landing page do walker (walker.zupet.io) exibe a comparação Free vs Pro para conversão
