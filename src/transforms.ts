import type { ScalarTransformName, ArrayTransformName } from './types/config.js';

const KNOTS_PER_MPH = 0.868976;

export function applyScalar(name: ScalarTransformName, value: string): string | null {
  switch (name) {
    case 'trim':
      return value.trim();
    case 'trim_or_null': {
      const v = value.trim();
      return v.length > 0 ? v : null;
    }
    case 'lowercase':
      return value.trim().toLowerCase();
    case 'uppercase':
      return value.trim().toUpperCase();
    case 'int_or_null': {
      const v = value.trim();
      if (v.length === 0) return null;
      const n = parseInt(v, 10);
      return Number.isNaN(n) ? null : String(n);
    }
    case 'float_or_null': {
      const v = value.trim();
      if (v.length === 0) return null;
      const n = parseFloat(v);
      return Number.isNaN(n) ? null : String(n);
    }
    case 'date_yyyymmdd_or_null': {
      const v = value.trim();
      if (v.length !== 8 || !/^\d{8}$/.test(v)) return null;
      const y = v.slice(0, 4);
      const m = v.slice(4, 6);
      const d = v.slice(6, 8);
      const date = new Date(`${y}-${m}-${d}T00:00:00Z`);
      return Number.isNaN(date.getTime()) ? null : `${y}-${m}-${d}`;
    }
    case 'mph_to_ktas_or_null': {
      const v = value.trim();
      if (v.length === 0) return null;
      const n = parseFloat(v);
      if (Number.isNaN(n) || n <= 0) return null;
      return String(Math.round(n * KNOTS_PER_MPH * 10) / 10);
    }
    case 'faa_cert_class': {
      const v = value.trim();
      return v.length > 0 ? v[0] : null;
    }
  }
}

export function applyArray(name: ArrayTransformName, value: string): string[] {
  switch (name) {
    case 'faa_cert_ops': {
      const v = value.trim();
      return v.length > 1 ? v.slice(1).split('') : [];
    }
  }
}
