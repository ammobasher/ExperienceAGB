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
| Tree/node/predictor counts | Canonical structure counts. Predictor names come from parsed split conditions. |
| Deepest path | Maximum accepted depth plus the root, expressed in levels. |
| Training counts, successRate, AUC | Export metadata, checked for basic consistency/ranges. Not a production-performance, fairness, or calibration certificate. |
| Illustrative profile | Deterministic synthetic values from known model thresholds/categories. Not a sampled, typical, or real customer. |
| Missing / invalid / unknown / unsupported | Distinct input states. They do not silently substitute a branch or a zero score. |

A contribution, split, gain, or occurrence is not evidence that changing a feature causes a business outcome. The optional local AI context preview is not a calculation or explanation from a model. Live AI commentary is blocked because the originally selected GitHub Models service retired; it never changes deterministic facts or verification status.

Authoritative aggregation/export-scaling and explanation reference: [Pega, The Gradient boosting technique](https://docs.pega.com/bundle/platform/page/platform/decision-management/adaptive-gradient-boosting.html), reviewed 2026-10-07. Formula documentation is not an oracle fixture or production certification.
