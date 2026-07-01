# Trickle — Dune Dashboard Recipe

Paste-ready SQL queries + dashboard layout for **Trickle on-chain analytics** on Dune (Celo mainnet).

Modeled after the Claudelance layout: KPI cards top, chart row middle, leaderboards + token breakdown bottom.

---

## Constants

- **Chain**: Celo Mainnet (`chain_id = 42220`, Dune schema `celo`)
- **TrickleVault**: `0x8a3e5d16F088A1D96f554970e5eED8468e7ddc05`
- **Activity since**: block `64796163` (deploy) → filter every query by `block_time >= TIMESTAMP '2026-04-01'` or by contract deploy timestamp
- **Payment tokens** (mainnet):
  - USDC — `0xceba9300f2b948710d2653dd7b07f33a8b32118c` (6 decimals)
  - CELO — `0x471ece3750da237f93b8e339c536989b8978a438` (18 decimals)
  - USDm — (see mainnet address in `fe_trickle/config/tokens.ts`)

## Event topic0 hashes (raw `celo.logs`)

| Event | topic0 |
|---|---|
| `Deposit(address,address,uint256)` | `0x5548c837ab068cf56a2c2479df0882a4922fd203edb7517321831d95078c5f62` |
| `BalanceWithdrawn(address,address,uint256)` | `0x50630162af2fe1b3638257703351230fbe331ec0b7368aba0eb78f2dabd03c0c` |
| `StreamCreated(bytes32,address,address,address,uint216)` | `0xf9432d0e28f9605f1137771a524fcde53dffbc4556c5419a56c9a6f782078079` |
| `StreamCancelled(bytes32,address,address,address)` | `0x4d660684ba2d4ed629a80f8aa6e17f30d42d8f2cac828e30418be6213ce9774c` |
| `Withdrawn(bytes32,address,address,uint256)` | `0xa6786aab7dbbc48b4b0387488b407bd81448030ab207b50bea7dbb5fbc1cd9eb` |

---

## Dashboard header block

Paste as markdown block at the top of the Dune dashboard:

```
# Trickle — On-chain Analytics (Celo)

Real-time metrics for the **Trickle** payroll streaming protocol on Celo Mainnet.

**Vault**: [`0x8a3e5d16...ddc05`](https://celoscan.io/address/0x8a3e5d16F088A1D96f554970e5eED8468e7ddc05)

- Model: employer deposits stablecoin → creates per-second stream → employee withdraws accrued value
- Payment tokens: USDC, CELO, USDm
- Events tracked: `Deposit`, `BalanceWithdrawn`, `StreamCreated`, `StreamCancelled`, `Withdrawn`
- Method: raw `celo.logs` (topic0 decoding) + `tokens.transfers`. Activity since 2026-04-01.
```

---

# Section 1 — Protocol metrics (headline KPIs)

## Query: Total transactions to vault

```sql
SELECT COUNT(*) AS total_transactions
FROM celo.transactions
WHERE "to" = 0x8a3e5d16F088A1D96f554970e5eED8468e7ddc05
  AND block_time >= TIMESTAMP '2026-04-01'
  AND success = true;
```

Visualization: **Counter** — label `Total Transactions`.

## Query: Unique wallets (DAU base)

```sql
SELECT COUNT(DISTINCT "from") AS unique_wallets
FROM celo.transactions
WHERE "to" = 0x8a3e5d16F088A1D96f554970e5eED8468e7ddc05
  AND block_time >= TIMESTAMP '2026-04-01'
  AND success = true;
```

Visualization: **Counter** — `Unique Wallets`.

## Query: Total gas fees (CELO)

```sql
SELECT SUM(gas_used * gas_price) / 1e18 AS total_gas_celo
FROM celo.transactions
WHERE "to" = 0x8a3e5d16F088A1D96f554970e5eED8468e7ddc05
  AND block_time >= TIMESTAMP '2026-04-01'
  AND success = true;
```

Visualization: **Counter** — `Gas Fees (CELO)`.

## Query: Total volume streamed (USD)

Sum of ERC20 transfers **into** and **out of** the vault, priced via `prices.usd`:

```sql
WITH vault AS (
  SELECT 0x8a3e5d16F088A1D96f554970e5eED8468e7ddc05 AS addr
),
flows AS (
  SELECT
    t.contract_address AS token,
    t.amount AS amount_raw,
    t.evt_block_time
  FROM tokens.transfers t, vault v
  WHERE (t."from" = v.addr OR t."to" = v.addr)
    AND t.blockchain = 'celo'
    AND t.evt_block_time >= TIMESTAMP '2026-04-01'
)
SELECT SUM(f.amount_raw / POW(10, p.decimals) * p.price) AS total_volume_usd
FROM flows f
LEFT JOIN prices.usd p
  ON p.contract_address = f.token
  AND p.blockchain = 'celo'
  AND p.minute = date_trunc('minute', f.evt_block_time);
```

Visualization: **Counter** — `Total Volume (USD)`.

## Query: Daily transactions & DAU

```sql
SELECT
  date_trunc('day', block_time) AS day,
  COUNT(*) AS transactions,
  COUNT(DISTINCT "from") AS active_wallets
FROM celo.transactions
WHERE "to" = 0x8a3e5d16F088A1D96f554970e5eED8468e7ddc05
  AND block_time >= TIMESTAMP '2026-04-01'
  AND success = true
GROUP BY 1
ORDER BY 1;
```

Visualization: **Line chart** — X `day`, Y1 `transactions` (bar), Y2 `active_wallets` (line).

## Query: Daily gas fees (CELO)

```sql
SELECT
  date_trunc('day', block_time) AS day,
  SUM(gas_used * gas_price) / 1e18 AS gas_celo
FROM celo.transactions
WHERE "to" = 0x8a3e5d16F088A1D96f554970e5eED8468e7ddc05
  AND block_time >= TIMESTAMP '2026-04-01'
  AND success = true
GROUP BY 1
ORDER BY 1;
```

Visualization: **Area chart** — X `day`, Y `gas_celo`.

---

# Section 2 — Streaming KPIs

## Query: Streams created (total)

```sql
SELECT COUNT(*) AS streams_created
FROM celo.logs
WHERE contract_address = 0x8a3e5d16F088A1D96f554970e5eED8468e7ddc05
  AND topic0 = 0xf9432d0e28f9605f1137771a524fcde53dffbc4556c5419a56c9a6f782078079
  AND block_time >= TIMESTAMP '2026-04-01';
```

Visualization: **Counter** — `Streams Created`.

## Query: Active streams (created − cancelled)

```sql
WITH created AS (
  SELECT COUNT(*) AS n FROM celo.logs
  WHERE contract_address = 0x8a3e5d16F088A1D96f554970e5eED8468e7ddc05
    AND topic0 = 0xf9432d0e28f9605f1137771a524fcde53dffbc4556c5419a56c9a6f782078079
),
cancelled AS (
  SELECT COUNT(*) AS n FROM celo.logs
  WHERE contract_address = 0x8a3e5d16F088A1D96f554970e5eED8468e7ddc05
    AND topic0 = 0x4d660684ba2d4ed629a80f8aa6e17f30d42d8f2cac828e30418be6213ce9774c
)
SELECT (SELECT n FROM created) - (SELECT n FROM cancelled) AS active_streams;
```

Visualization: **Counter** — `Active Streams`.

## Query: Unique employers (payers)

Employer address is topic1 (indexed `payer`) of `StreamCreated`:

```sql
SELECT COUNT(DISTINCT topic2) AS unique_employers
FROM celo.logs
WHERE contract_address = 0x8a3e5d16F088A1D96f554970e5eED8468e7ddc05
  AND topic0 = 0xf9432d0e28f9605f1137771a524fcde53dffbc4556c5419a56c9a6f782078079
  AND block_time >= TIMESTAMP '2026-04-01';
```

> Topic layout: `topic0` sig · `topic1` streamId · `topic2` payer · `topic3` payee.

Visualization: **Counter** — `Unique Employers`.

## Query: Unique employees (payees)

```sql
SELECT COUNT(DISTINCT topic3) AS unique_employees
FROM celo.logs
WHERE contract_address = 0x8a3e5d16F088A1D96f554970e5eED8468e7ddc05
  AND topic0 = 0xf9432d0e28f9605f1137771a524fcde53dffbc4556c5419a56c9a6f782078079
  AND block_time >= TIMESTAMP '2026-04-01';
```

Visualization: **Counter** — `Unique Employees`.

## Query: Paid to employees (USD)

Sum of ERC20 transfers out of vault, priced:

```sql
WITH vault AS (
  SELECT 0x8a3e5d16F088A1D96f554970e5eED8468e7ddc05 AS addr
),
paid AS (
  SELECT
    t.contract_address AS token,
    t.amount AS amount_raw,
    t.evt_block_time
  FROM tokens.transfers t, vault v
  WHERE t."from" = v.addr
    AND t.blockchain = 'celo'
    AND t.evt_block_time >= TIMESTAMP '2026-04-01'
)
SELECT SUM(p.amount_raw / POW(10, pr.decimals) * pr.price) AS paid_usd
FROM paid p
LEFT JOIN prices.usd pr
  ON pr.contract_address = p.token
  AND pr.blockchain = 'celo'
  AND pr.minute = date_trunc('minute', p.evt_block_time);
```

Visualization: **Counter** — `Paid to Employees (USD)`.

## Query: Daily streaming activity

Bar chart of daily deposits vs streams created vs withdrawals:

```sql
WITH events AS (
  SELECT
    date_trunc('day', block_time) AS day,
    CASE topic0
      WHEN 0x5548c837ab068cf56a2c2479df0882a4922fd203edb7517321831d95078c5f62 THEN 'Deposits'
      WHEN 0xf9432d0e28f9605f1137771a524fcde53dffbc4556c5419a56c9a6f782078079 THEN 'Streams Created'
      WHEN 0xa6786aab7dbbc48b4b0387488b407bd81448030ab207b50bea7dbb5fbc1cd9eb THEN 'Withdrawals'
      ELSE NULL
    END AS event
  FROM celo.logs
  WHERE contract_address = 0x8a3e5d16F088A1D96f554970e5eED8468e7ddc05
    AND topic0 IN (
      0x5548c837ab068cf56a2c2479df0882a4922fd203edb7517321831d95078c5f62,
      0xf9432d0e28f9605f1137771a524fcde53dffbc4556c5419a56c9a6f782078079,
      0xa6786aab7dbbc48b4b0387488b407bd81448030ab207b50bea7dbb5fbc1cd9eb
    )
    AND block_time >= TIMESTAMP '2026-04-01'
)
SELECT day, event, COUNT(*) AS count
FROM events
WHERE event IS NOT NULL
GROUP BY 1, 2
ORDER BY 1;
```

Visualization: **Bar chart** grouped — X `day`, Y `count`, group by `event`.

---

# Section 3 — Vault flows by token

## Query: Deposits & payouts by token (USD)

```sql
WITH vault AS (
  SELECT 0x8a3e5d16F088A1D96f554970e5eED8468e7ddc05 AS addr
),
flows AS (
  SELECT
    t.contract_address AS token,
    CASE WHEN t."to" = (SELECT addr FROM vault) THEN 'in' ELSE 'out' END AS direction,
    t.amount AS amount_raw,
    t.evt_block_time
  FROM tokens.transfers t
  WHERE (t."from" = (SELECT addr FROM vault) OR t."to" = (SELECT addr FROM vault))
    AND t.blockchain = 'celo'
    AND t.evt_block_time >= TIMESTAMP '2026-04-01'
),
priced AS (
  SELECT
    f.token,
    f.direction,
    f.amount_raw / POW(10, pr.decimals) * pr.price AS amount_usd
  FROM flows f
  LEFT JOIN prices.usd pr
    ON pr.contract_address = f.token
    AND pr.blockchain = 'celo'
    AND pr.minute = date_trunc('minute', f.evt_block_time)
)
SELECT
  COALESCE(sym.symbol, CAST(p.token AS VARCHAR)) AS token,
  COUNT(*) AS transfers,
  SUM(CASE WHEN p.direction = 'in'  THEN p.amount_usd END) AS deposited_usd,
  SUM(CASE WHEN p.direction = 'out' THEN p.amount_usd END) AS paid_out_usd
FROM priced p
LEFT JOIN tokens.erc20 sym
  ON sym.contract_address = p.token AND sym.blockchain = 'celo'
GROUP BY 1
ORDER BY deposited_usd DESC NULLS LAST;
```

Visualization: **Table** — columns `token`, `transfers`, `deposited_usd`, `paid_out_usd`.

---

# Section 4 — Leaderboards

## Query: Top employers by deposits

```sql
SELECT
  '0x' || SUBSTR(TO_HEX(SUBSTR(topic2, 13, 20)), 1, 40) AS employer,
  COUNT(*) AS deposits
FROM celo.logs
WHERE contract_address = 0x8a3e5d16F088A1D96f554970e5eED8468e7ddc05
  AND topic0 = 0x5548c837ab068cf56a2c2479df0882a4922fd203edb7517321831d95078c5f62
  AND block_time >= TIMESTAMP '2026-04-01'
GROUP BY 1
ORDER BY deposits DESC
LIMIT 25;
```

> `topic1` = payer indexed. Slice last 20 bytes of the 32-byte word.

Visualization: **Table** — columns `employer`, `deposits`. Alternative bar chart.

## Query: Top employees by withdrawals

```sql
SELECT
  '0x' || SUBSTR(TO_HEX(SUBSTR(topic2, 13, 20)), 1, 40) AS employee,
  COUNT(*) AS withdrawals
FROM celo.logs
WHERE contract_address = 0x8a3e5d16F088A1D96f554970e5eED8468e7ddc05
  AND topic0 = 0xa6786aab7dbbc48b4b0387488b407bd81448030ab207b50bea7dbb5fbc1cd9eb
  AND block_time >= TIMESTAMP '2026-04-01'
GROUP BY 1
ORDER BY withdrawals DESC
LIMIT 25;
```

Visualization: **Table** — columns `employee`, `withdrawals`.

---

# How to build the dashboard on Dune

1. Go to https://dune.com/browse/dashboards → **Create new dashboard**
2. Title: `Trickle — On-chain Analytics (Celo)`
3. For each query above:
   a. New query → paste SQL → **Run**
   b. Switch to **Visualization** tab → pick chart type → set X/Y from the guidance
   c. **Save** with a clear name (e.g. `Trickle — Total transactions`)
   d. Add to dashboard: **Add visualization**
4. Layout suggestion:
   - **Row 1**: 4 counters — Total Transactions, Unique Wallets, Gas Fees, Total Volume
   - **Row 2**: 2 charts — Daily transactions & DAU (left), Daily gas fees (right)
   - **Row 3**: 4 counters — Streams Created, Active Streams, Unique Employers, Unique Employees
   - **Row 4**: Paid to Employees counter + Daily streaming activity bar chart
   - **Row 5**: Deposits & payouts by token table
   - **Row 6**: Top employers + Top employees side by side

## Auto-refresh

Free tier: 1h refresh. Paid tier: minutes. Set per-query in query settings.

## Sharing

Dashboard → **Share** → Public URL. Add link to `README.md` → Links table.

---

# Notes

- `prices.usd` needs the token to be in Dune's price feed. USDC and CELO are covered; USDm may not be — those rows return `NULL` USD but count is still shown.
- `tokens.transfers` is a decoded view; if empty for a token, fallback to raw `erc20_celo.evt_Transfer` filtered by `contract_address`.
- If the Dune indexer hasn't decoded the TrickleVault ABI yet, submit the contract via https://dune.com/contracts/new for faster decoded tables next time.
