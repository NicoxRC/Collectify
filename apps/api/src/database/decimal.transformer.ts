import { ValueTransformer } from 'typeorm';

// pg returns NUMERIC/DECIMAL columns as strings to avoid silent precision
// loss; the interest formula in docs/GLOSSARY.md operates on plain numbers,
// so every money/rate column needs this applied.
export const decimalTransformer: ValueTransformer = {
  to: (value?: number | null) => value,
  from: (value?: string | null) =>
    value === null || value === undefined ? value : parseFloat(value),
};
