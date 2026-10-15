# Metric glossary

| Term | Meaning and provenance |
|---|---|
| Tree | A sequence of exported predictor questions. One profile selects one leaf contribution from each tree. |
| Split | A parsed condition. True goes left; false goes right under this adapter's explicitly unverified routing assumptions. |
| Leaf | Terminal node. Its serialized score contributes to the raw ensemble total; it is not itself a probability. |
| Internal score | An exported field shown under technical provenance. It is not summed when tracing a profile. |
| Raw score | Additive total of selected leaf scores. Running total includes only complete preceding stages and finite arithmetic. |
| Unverified propensity preview | Sigmoid of a complete finite raw total. Aggregation and export learning-rate scaling are documented by Pega; exact exported-node/input/routing parity remains unverified. |
| Export learning rate | Pega documents that learning-rate scaling is already applied to tree scores during serialization. Applying a second multiplier would double-scale those documented exported contributions. |
| `sampleCount` | Raw exported count. Its exact Pega training semantics require authoritative documentation; it does not establish population frequency. |
| `gain` | Raw training-time split statistic with exact definition still unverified. It is not a profile's propensity change or causal impact. |
| Predictor occurrence | A split referencing a predictor, indexed by tree and stable node path. Frequency is structural evidence, not causal importance. |
| SHAP / Pega predictor importance | Pega documents model explanations and normalized importance; these are distinct from this app's branch walkthrough and occurrence counts. This app does not compute SHAP or reproduce Pega's importance reports. |
| Ensemble | The complete collection of trees in one export. |
| Trees in ensemble | Number of trees across the entire model, not the number of nodes in one tree. |
| Nodes across all trees | All split nodes and terminal leaves summed across the ensemble. |
| Total nodes/leaves in selected tree | Full structural totals for the selected tree only. A collapsed split is still not a terminal leaf. |
| Diagram nodes/leaves shown | Currently drawn nodes and actual leaves within the selected tree or explicitly focused subtree. Progressive drawing, manual collapse and explicit focus can reduce this count; no automatic depth/node cutoff is used. |
| Unique predictors in ensemble | Distinct case-sensitive feature names from parsed splits across every tree. Not the total number of repeated occurrences. |
| Deepest path | Maximum accepted depth plus the root, expressed in levels. |
| Root / path / subtree | The root is a tree's starting node. A path records its left/right decisions. A subtree contains a chosen node and all descendants; focusing it changes diagram scope, not full-tree totals. |
| Training counts, successRate, AUC | Export metadata, checked for basic consistency/ranges. Not a production-performance, fairness, or calibration certificate. |
| Exported AUC | A zero-to-one ranking/discrimination metric, subject to the exported field's unverified evaluation/window semantics. A higher value in another export does not certify improved live performance. |
| Success rate / percentage points | The export supplies a proportion; evolution displays a percentage. Moving from 10% to 15% is +5 percentage points, not +5% relative uplift. |
| Export tag / modelVersion | Original tag, not a proven model identity, chronological order or software/schema version. |
| Export/snapshot time | Validated UTC factoryUpdateTime, or an explicitly supplied manual UTC override. Invalid/missing times are not inferred; duplicate times pause chronological charts and insights. |
| Model evolution | Local descriptive comparison of same-model exports confirmed by the user. Counts, available training/evaluation metadata and exact-name predictor changes do not prove causality, live drift or improved performance. |
| Illustrative profile | Deterministic synthetic values from known model thresholds/categories. Not a sampled, typical, or real customer. |
| Missing / invalid / unknown / unsupported | Distinct input states. They do not silently substitute a branch or a zero score. |
| Stored gain share / Pareto | Per-predictor nonnegative internal gain divided by complete positive total internal gain; Pareto accumulates shares in descending order. Not SHAP, causality or business lift. Missing leaf gains do not gate internal-gain calculations. |
| Mean gain in a half | Mean **total internal gain per tree**, not gain per split. The first half has ceil(treeCount/2) trees; the remaining half does not overlap. Export order is not verified tree age. |
| Literal namespace / inferred role / provenance | Prefix before the first dot; provisional name-based interpretation; independently established source. A `Param.Score` name retains namespace `Param`, and does not prove another model produced it. |
| Pooled exported AUC | Supplied `auc` metadata, not a reconstructed weighted average of action AUCs. No calibration or new performance test is inferred. |
| Observed membership cardinality | Distinct literal values actually stored in a predictor's membership splits, not the full training or customer vocabulary. |
| Numeric-looking / singleton membership | Structural review candidates, not proven numeric-encoding faults, identifiers, leakage or overfitting. |
| Threshold histogram | All numeric split thresholds for a predictor, in 12 equal-width bins (one for a constant value or when floating-point precision prevents distinct bin boundaries). Lower-inclusive/upper-exclusive except the last bin. These are boundaries used by the model, not customer measurements. |
| Leaf density | All exported leaves grouped by signed score and log(1 + sampleCount). Dot size counts leaves. Linked examples are not representative profiles; counters do not establish positives/confidence. |
| Category-set digest | SHA-256 of UTF-8 JSON of sorted distinct observed membership strings. Detects set changes even with unchanged cardinality, without retaining category values in the series. Not proof of stable customer populations. |
| Local audit / availability | Computed/exported facts with definitions, units, operands, validity, hashes and explicit limitations. Missing inputs disable only dependent metrics. Not the complete v6.4 audit or Pega certification. |

A contribution, split, gain, or occurrence is not evidence that changing a feature causes a business outcome. Optional Copilot commentary (or explicitly selected Anthropic) explains only approved, minimized computed context; it is not a calculation, verified explanation or certification. It never changes deterministic facts or verification status.

The workspace now provides **Technical terms and metric scopes** and keyboard-accessible metric disclosures. Fullscreen preserves these contextual node definitions, the complete drawing, selection and text outline; it does not change any counts or scores.

Authoritative aggregation/export-scaling and explanation reference: [Pega, The Gradient boosting technique](https://docs.pega.com/bundle/platform/page/platform/decision-management/adaptive-gradient-boosting.html), reviewed 2026-10-07. Formula documentation is not an oracle fixture or production certification.
