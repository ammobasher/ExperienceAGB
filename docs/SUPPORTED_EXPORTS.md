# Supported export boundary

## Compatibility matrix

| Input | Current behavior | Evidence / limit |
|---|---|---|
| `type: AdaptiveBoostScoringModel`, `algorithm: GRADIENT_BOOST`, `modelVersion: "2"` with the observed sample shape | Local exploration and **unverified preview** | Bundled sample and handcrafted regression cases; not a Pega-owned compatibility specification |
| Same observed structure with a UUID-v4 string in `modelVersion` | Local exploration and **unverified preview**; original tag retained | Two owner-supplied production exports structurally validated and exercised in the production browser; not score-oracle or general version compatibility evidence |
| Other model types, algorithms, tag formats or structural variants | Rejected with a path-specific diagnostic | No adapter evidence for other tag formats or constructs |
| Unknown fields, including scoring transformations, dimensions, calibration, or weights | Rejected rather than discarded | Conservative allow-list; valid but unconfirmed real exports can be rejected |
| Supported split syntax with missing/invalid/unknown profile values | Exploration remains available; unresolved routes withhold ensemble preview | Conservative explicit profile-state contract below |
| Malformed JSON, invalid structure, excessive limits | Rejected before rendering | Unit and production-browser regression tests |

Do not interpret acceptance as production compatibility or approval. No switch upgrades a preview into verified propensity. `modelVersion` is treated as a preserved **export tag**, not assumed to encode a schema version. UUID-v4 syntax alone does not establish compatibility: the complete strict structural/grammar/limit validation also applies. Future UUID-tagged exports that fit this shape are still unverified; unknown fields or scoring constructs are rejected.

The supplied production payloads remain private attachments, not repository fixtures or publicly hosted samples. Their use demonstrated the observed structure; authoritative field semantics and source-attributed scoring fixtures remain required to verify scoring.

On 2026-10-09 the owner authorized exploratory release with unverified scoring,
local-only hosting and publication of the **existing bundled sample only**.
That decision does not authorize either production payload, actual export
identities, profiles, private research or private test evidence for redistribution.

## Observed shape and limits

The root accepts only `type`, `algorithm`, `modelVersion`, `model`, `factoryUpdateTime`, `trainingStats`, `successRate`, and `auc`. `model` contains only `booster`; `booster` contains only nonempty `trees`.

Each node has a finite numeric `score` and nonnegative safe-integer `sampleCount`. Optional `gain` must be finite. Internal nodes have a nonempty `split` and both `left` and `right` nodes. Leaves omit split/children. The bundled sample's optional boolean `isLeaf` marker must agree with the structure. Null, false, zero, arrays, objects, and blank split fields are not leaf sentinels in this adapter.

Limits: 25 MiB file, 2,000 trees, 250,000 nodes, depth 64 edges from root, and 4,096 entries per categorical split. Diagnostics are bounded to 200 entries plus an explicit truncation notice; every detected error still prevents import. These are safety limits, not universal latency guarantees.

Canonical trees are detached from input JSON and retain parsed conditions. Pega-specific unknown data is never silently treated as zero or as a supported scoring transformation.

## Split and profile semantics

| Form / state | Preview rule |
|---|---|
| `Feature < finiteDecimalThreshold` | Numeric decimal comparison; equality goes False / Right |
| `Feature in [A, B]` or `Feature in {A, B}` | Exact, case-sensitive membership; True / Left if included |
| Single/double-quoted categories | Quoted whitespace, commas, and supported escapes retain identity; malformed quoting/escaping and empty categories are rejected |
| `Feature is Missing` | True / Left only when the feature-aware profile state is Missing |
| Numeric supplied value | Finite decimal or scientific notation; surrounding whitespace permitted; hexadecimal/Infinity/nonnumeric text invalid |
| Categorical supplied value | Exact category found somewhere for this feature in the export; whitespace inside a category is significant |
| Known category outside this particular split list | False / Right, not unknown |
| Category absent from all exported lists for this feature | Unknown; withhold its route because unknown-category parity is not verified |
| Empty input | Explicitly Missing; ordinary numeric/membership conditions do not assume a branch |
| Whitespace-only category present in the export | Supplied, not Missing; categorical identity also governs explicit missing splits |
| Missing-only feature | Blank/whitespace is Missing; nonblank is supplied |
| Mixed numeric and categorical conditions on one predictor | Unsupported profile type; explore the structure but withhold affected routes |
| Unsupported operators or scoring constructs | Reject at the import boundary, not a guessed route |

The editor pages 25 features, shows up to 50 category suggestions, and permits exact exported categories beyond the suggestions. Every unresolved stage exposes its tree, feature, reason, and resolved route prefix. Illustrative values are deterministic thresholds/categories from the model, not realistic distributions. A new illustration can repeat values when only one candidate exists.

## Preview arithmetic and verification gate

Preview raw score sums one selected serialized leaf score per tree. Preview propensity applies sigmoid to that sum. Pega's official [The Gradient boosting technique](https://docs.pega.com/bundle/platform/page/platform/decision-management/adaptive-gradient-boosting.html), section **The score calculated by the model**, documents summing returned tree scores and applying sigmoid, and explicitly establishes that learning-rate scaling is incorporated during export serialization. Therefore no additional learning-rate multiplier is applied. Zero raw score yields 0.5. Internal-node scores are not summed.

This source was checked on 2026-10-07 in the current Platform '26 topic and its [Platform '25](https://docs.pega.com/bundle/platform-25/page/platform/decision-management/adaptive-gradient-boosting.html) and [Platform '24.2](https://docs.pega.com/bundle/platform-242/page/platform/decision-management/adaptive-gradient-boosting.html) counterparts; all three document the aggregation and serialization scaling. The product/version producing the supplied exports still needs to be recorded. This is authoritative **formula documentation**, not a source-attributed expected-output fixture for either supplied model.

Every route must complete, and all accumulated arithmetic must remain finite. Overflow stops cumulative scoring and withholds the preview even if later scores might cancel. A complete preview is **not** a final verified Pega/CDH propensity.

The remaining scoring gate is validation of exported-node interpretation, input/preprocessing and exact routing against expected Pega outputs, including numeric boundaries, categorical identity and unknown/missing/blank behavior, plus applicability to the actual export/product variants and any environment-specific post-processing. The linked topic does not define the complete JSON schema, the UUID export tag semantics or these edge-case routing rules. The repository's handcrafted tests and bundled sample are regression evidence, not oracle evidence. No additional weighting/calibration is invented; unsupported supplied fields remain rejected.

### Accepted exploratory scope (2026-10-09)

The owner accepted an **exploratory preview**, informed by official documentation and the public companion implementation, rather than requiring private Java source or an independent scoring oracle before continuing implementation. These remain certification checks, not blockers to local exploration or consent-based commentary. The UI must continue to say unverified preview.

Immutable companion references at pdstools commit `7634c8edd20a0f7e519331b9cc62b59b4746d92b`:

- [Encoded split decoding](https://github.com/pegasystems/pega-datascientist-tools/blob/7634c8edd20a0f7e519331b9cc62b59b4746d92b/python/pdstools/adm/trees/_model.py#L174-L247).
- [True/left, false/right traversal and leaf selection](https://github.com/pegasystems/pega-datascientist-tools/blob/7634c8edd20a0f7e519331b9cc62b59b4746d92b/python/pdstools/adm/trees/_model.py#L1234-L1288).
- [Additive scoring followed by sigmoid](https://github.com/pegasystems/pega-datascientist-tools/blob/7634c8edd20a0f7e519331b9cc62b59b4746d92b/python/pdstools/adm/trees/_model.py#L1303-L1314).

An isolated review executed 27 handcrafted cases against unchanged extracted companion methods, not its full package suite or the supplied production exports. It reproduced permissive invalid-number routing, string-substring missing checks, simplistic quoted-category parsing and extreme-negative sigmoid overflow. Those behaviors are **not** a Java contract and are intentionally not copied here. This adapter retains exact category parsing, explicit unresolved states, finite arithmetic and a stable sigmoid. Encoded datamart blobs are not supported merely because pdstools can decode them.

## Explanation scope

The current Platform topic also distinguishes local/global SHAP explanations and normalized predictor importance from raw tree structure. This app's branch/leaf walkthrough is **not SHAP**, and predictor occurrence counts are not Pega's normalized importance or causal attribution. Its generic illustrative profile must not be interpreted as every Action/Treatment's score: applicable model-context properties are inputs that must be included in any reference profile.

## Metadata

Observed compact UTC timestamps (`YYYYMMDDTHHmmss.sssZ`) and exact UTC ISO timestamps (`YYYY-MM-DDTHH:mm:ss.sssZ`) normalize to ISO. Invalid or unsupported dates are omitted with a warning, never fabricated. Training counts must be safe integers and positives plus negatives must equal total. Invalid optional AUC/successRate proportions are omitted with warnings. Export metadata is raw evidence, not calibration, fairness, or model-governance certification.
