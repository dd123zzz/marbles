interface SegmentedControlProps<T extends string> {
  legend: string;
  name: string;
  value: T;
  options: ReadonlyArray<{ value: T; label: string }>;
  onChange: (value: T) => void;
}

/** A radio group drawn as a segmented control. The selected option shows a check mark. */
export default function SegmentedControl<T extends string>({
  legend,
  name,
  value,
  options,
  onChange,
}: SegmentedControlProps<T>) {
  return (
    <fieldset>
      <legend>{legend}</legend>
      <div className="segmented">
        {options.map((o) => (
          <label key={o.value}>
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={value === o.value}
              onChange={() => onChange(o.value)}
            />
            <span>{o.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
