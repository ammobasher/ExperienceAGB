import { useState } from 'react';
import { MODEL_TERMS } from '../domain/glossary';
import type { ModelTerm } from '../domain/glossary';

export function Term({ term, label }: { term: ModelTerm; label?: string }) {
  const entry = MODEL_TERMS[term];
  return <details className="term-help">
    <summary>{label ?? entry.title} <span aria-hidden="true">?</span></summary>
    <p>{entry.definition}</p>
  </details>;
}

export default function TechnicalTerms() {
  const [open, setOpen] = useState(false);
  return <details className="technical-terms" onToggle={event => setOpen(event.currentTarget.open)}>
    <summary>Technical terms and metric scopes</summary>
    {open && <><p>Ensemble metrics cover every tree. Selected-tree metrics cover one tree. Diagram counts cover only the current drawing scope.</p>
    <dl>{Object.entries(MODEL_TERMS).map(([key, entry]) => <div key={key}><dt>{entry.title}</dt><dd>{entry.definition}</dd></div>)}</dl></>}
  </details>;
}
