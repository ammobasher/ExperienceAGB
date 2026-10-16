# Optional score-to-propensity companion

Open a model, choose **Trace a profile**, then **Import or prepare a companion
mapping**. The original summed-leaf raw score and sigmoid preview remain
unchanged. The optional panel applies a supplied Classifier interval mapping to
the complete, finite profile result, showing the selected interval, response
counts when supplied, unrounded probability and declared provenance.

**This is an ExperienceAGB companion format, not a native Pega datamart/export
adapter or verified Pega scorer.** A matching source-byte hash prevents accidental
attachment to a different file; it cannot verify that the supplied mapping,
context, capture time, score domain or method represents platform behavior.
Confirmation is required before applying any imported companion.

## Preparing and importing

1. Open **Model fingerprint and empty template**. Approve preparing a template
   containing model identifiers, prepare it and explicitly save the local file.
2. Complete the empty fields from authoritative mapping evidence. Do not invent
   bins or fit a calibration to the illustrative profile. The intentionally
   incomplete template is not accepted as a mapping.
3. Import the completed JSON, inspect the source/context, then confirm its model,
   action/channel/direction, applicable snapshot, score domain and method.
4. Edit the profile normally. The matched interval and probability update across
   the ensemble, not just the selected tree. Switching views preserves the
   mapping; **Clear mapping**, closing/replacing the model or reloading clears it.

The source reference is displayed as text, never opened or fetched automatically.
Imported companions, model identifiers, counts and mapped probabilities are not
included in AI requests, evolution summaries or structural audit downloads.
They are held in component memory, not browser storage. Saving a template
creates a sensitive copy outside app memory; manage saved copies yourself.

## Version 1 format

Required top-level fields:

| Field | Meaning |
|---|---|
| `schema` | Exactly `experience-agb-propensity-mapping-v1` |
| `sourceSha256` | SHA-256 of the exact open model-file bytes, not the companion bytes; 64 hexadecimal digits |
| `exportTag` | Exact open model's preserved export tag |
| `exportUpdateTime` | Exact normalized model update time, or explicit `null` when absent |
| `inputDomain` | Explicitly `raw-score` or `sigmoid-preview` |
| `method` | Explicitly `exported-values` or `smoothed-bin-counts` |
| `context` | Nonempty `modelId`, `action`, `channel`, `direction` |
| `provenance` | Nonempty `reference`, `platformVersion`, `capturedAt` |
| `bins` | Between 1 and 1,000 ordered intervals |

`capturedAt` must be exact UTC ISO format `YYYY-MM-DDTHH:mm:ss.sssZ`. It describes
the supplied mapping's capture time, not a guessed model update time. The
supplier must establish snapshot applicability; the app cannot infer calibration
continuity from either timestamp. Metadata strings are limited to 512 characters.
Unknown fields and duplicate keys, including escaped equivalent keys, are rejected.
Companions are limited to **256 KiB**, checked before reading and again on text
parsing. This bounded companion is parsed locally in the browser; model forests
continue to be parsed in their existing workers.

### Input domain

- `raw-score`: the complete finite sum of reached serialized leaf scores. No
  Naive Bayes prior, predictor-count division or extra learning-rate factor is
  introduced.
- `sigmoid-preview`: the existing sigmoid of that sum, in the 0-1 domain. It is
  not transformed a second time. All interval bounds must be finite and within
  0-1.

Choose the domain according to the source mapping. Neither the notebook's
Naive Bayes intervals nor its score-normalization formula establish an AGB
mapping's input domain.

### Probability method

**`exported-values`** requires each bin's explicit numeric `propensity` between
0 and 1. It is used unchanged, even if optional accompanying response counts
would yield a different smoothed fraction. `positives` and `negatives` must
either both be supplied or both omitted.

**`smoothed-bin-counts`** requires both response counts and forbids an additional
`propensity` field. The app computes `(positives + 0.5) / (positives + negatives + 1)`
for each supplied, already pooled bin. This is the explicitly selected formula
described in the reference, not independently confirmed AGB runtime semantics.
An empty bin yields 0.5 under this formula, not evidence of a known true 50% rate.
Counts must be nonnegative safe integers, with their sum plus one also safe.
Fractional/weighted counts are unsupported.

**No PAVA pooling, Platt fitting, automatic smoothing choice or monotonic
repair is performed.** Resulting probabilities must be nondecreasing, including
after the selected smoothing. If smoothing creates a decrease, obtain the
authoritative final mapped values or correctly pooled bins. Do not sort the
probabilities or change their association with score intervals to force acceptance.

### Interval rules

Every bin requires explicit finite numeric `lower` and `upper` bounds, or
`null` for an unbounded raw-score tail. Only the first lower and final upper
bound may be null. Finite lower bounds must be less than upper bounds.
Intervals must be ordered and exactly contiguous: no gaps, overlaps or
implicit floating-point tolerance.

Intervals include the lower bound and exclude the upper bound. The final finite
upper bound is included. An internal boundary belongs to the next interval.
If the applicable platform uses different boundary conventions, convert and
verify the mapping before import; do not assume compatibility.

Incomplete routes, nonfinite totals, absent confirmation, mismatched model
identifiers and scores outside the supplied range withhold the mapped result.
No clipping, extrapolation, sigmoid fallback or made-up neutral result is used.
Raw-score mappings may explicitly cover both unbounded tails.

### Synthetic illustration, not a ready-to-use Pega mapping

Replace the hash/tag/update time with the values in the prepared template and
replace **all** source metadata and bin evidence with your applicable source.
This example merely illustrates structure; the placeholder hash will not match
an actual open model.

```json
{
  "schema": "experience-agb-propensity-mapping-v1",
  "sourceSha256": "REPLACE_WITH_EXACT_64_HEX_MODEL_FILE_SHA256",
  "exportTag": "2",
  "exportUpdateTime": null,
  "inputDomain": "raw-score",
  "method": "exported-values",
  "context": {
    "modelId": "synthetic-example",
    "action": "synthetic-action",
    "channel": "Web",
    "direction": "Inbound"
  },
  "provenance": {
    "reference": "Synthetic illustration, not a Pega export",
    "platformVersion": "example-only",
    "capturedAt": "2024-01-01T00:00:00.000Z"
  },
  "bins": [
    { "lower": null, "upper": 0, "propensity": 0.1, "positives": 10, "negatives": 90 },
    { "lower": 0, "upper": null, "propensity": 0.2, "positives": 20, "negatives": 80 }
  ]
}
```

For `smoothed-bin-counts`, remove the `propensity` fields and explicitly change
`method`. The resulting values will differ; the example counts were not chosen
to reconstruct any platform output.

## Reading the result and lifecycle

The display says **Companion-mapped propensity - unverified Pega reproduction**,
not final platform propensity or final business priority. Rounded percentages
are for scanning; **Exact numbers** and the interval table preserve native numeric
precision. The step chart shows every supplied interval with equal display
widths; widths do **not** represent numeric score distances. Only 20 table rows
are mounted per page, and profile changes reveal the matched interval's page.

Importing a replacement immediately removes confirmation. Invalid replacements
leave the previous mapping retained but disabled; the visible error explains
that it requires reconfirmation. Cancelled or obsolete reads cannot install a
late result. Clearing or changing the model also invalidates pending reads and
revokes prepared template URLs. These are memory-lifecycle safeguards, not
secure erasure of browser/OS traces or saved copies.

Reference: [ADM NB Explained, pdstools 5.0.0](https://pegasystems.github.io/pega-datascientist-tools/5.0.0/articles/ADMExplained.html).
The source explicitly describes Naive Bayes; engineering confirmation of shared
calibration architecture does not make its NB contribution formulas valid for
AGB. The notebook's displayed AUC mismatch and post-smoothing monotonicity
discrepancy require reference-case clarification. Validate the full pipeline
against the same Pega snapshot, including boundary/missing/category cases,
before asserting reproduction. Exploration and arbitration remain separate.
