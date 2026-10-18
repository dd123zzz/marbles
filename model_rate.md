# Model Rates (Anthropic only)

Source: https://docs.github.com/en/copilot/reference/copilot-billing/models-and-pricing (fetched 2026-10-17)

Prices are USD per 1M tokens. **1 AI credit = $0.01** (so 20¢ = 20 credits; $1 = 100 credits).

| Model | Tier | Input | Cached input | Cache write | Output | Credits / 1M in | Credits / 1M out |
|---|---|--:|--:|--:|--:|--:|--:|
| Claude Haiku 4.5 | Default | $1.00 | $0.10 | $1.25 | $5.00 | 100 | 500 |
| Claude Haiku 5.5 | ≤100K ctx | $0.10 | $0.01 | $0.125 | $0.50 | 10 | 50 |
| Claude Haiku 5.5 | >100K ctx | $0.50 | $0.05 | $0.625 | $2.50 | 50 | 250 |
| Claude Sonnet 4 | Default | $3.00 | $0.30 | $3.75 | $15.00 | 300 | 1500 |
| Claude Sonnet 4.6 | Default | $3.00 | $0.30 | $3.75 | $15.00 | 300 | 1500 |
| Claude Sonnet 5 | Default | $2.00 | $0.20 | $2.50 | $10.00 | 200 | 1000 |
| Claude Sonnet 5.5 | Default | $2.00 | $0.10 | $2.50 | $10.00 | 200 | 1000 |
| Claude Opus 4.8 | Default | $5.00 | $0.50 | $6.25 | $25.00 | 500 | 2500 |
| Claude Opus 4.8 (fast, preview) | Default | $10.00 | $1.00 | $12.50 | $50.00 | 1000 | 5000 |
| Claude Opus 5 | Default | $5.00 | $0.50 | $6.25 | $25.00 | 500 | 2500 |
| Claude Opus 5.5 | Default | $4.00 | $0.20 | $5.00 | $20.00 | 400 | 2000 |
| Claude Fable 5 | Default | $10.00 | $1.00 | $12.50 | $50.00 | 1000 | 5000 |
| Claude Fable 5.1 | Default | $10.00 | $0.25 | $12.50 | $50.00 | 1000 | 5000 |

## Quick estimates
- Credits = (input_tokens × in_rate + cached × cached_rate + cache_write × cw_rate + output × out_rate) / 1M × 100
- Example: Sonnet 5.5 call with 50K cached input + 5K output ≈ 0.5 + 5 = **5.5 credits**.
- Example: Haiku 5.5 call with 50K cached input + 5K output ≈ 0.05 + 0.25 = **0.3 credits**.

## Usage policy for this project
- Coding work: **Claude Sonnet 5.5** (complex) or **Claude Haiku 5.5** (simple/mechanical).
- PM support only: **Claude Opus 5.5** (cheapest Opus).
- Handoff update every ~100 credits spent → see `HANDOFF.md`.
