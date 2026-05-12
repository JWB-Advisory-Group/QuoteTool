# Truth Gate Results

Generated: 2026-05-07T22:51:21.888Z

Input file: `data/truth-gate-addresses.sample.json`

| Metric | Result |
| --- | --- |
| Address resolved | 3/3 (100%) |
| Parcel resolved | 2/3 (67%) |
| Usable sqft/year built | 0/3 (0%) |

| Label | County | Address resolved | Parcel resolved | Usable sqft/year | Source | Parcel | Sqft | Year built |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Suffolk sample 1 | Suffolk | yes (100) | yes | no | nys_public_parcels | 47268907200006000510000000 | n/a | n/a |
| Suffolk sample 2 | Suffolk | yes (100) | yes | no | nys_public_parcels | 47228902005720003000020001 | 1815145 | n/a |
| Nassau sample 1 | Nassau | yes (100) | no | no | none | n/a | n/a | n/a |

Decision rule: ship Suffolk property enrichment only if the full 15-address run clears the threshold. If not, keep runtime pricing on customer-reported size plus manual market table.
