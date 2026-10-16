export default function ExactNumbers({ values }: { values: Record<string, number | null> }) {
  return <details className="exact-numbers"><summary>Exact numbers</summary><dl>
    {Object.entries(values).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value === null ? 'Not available' : String(value)}</dd></div>)}
  </dl></details>;
}
