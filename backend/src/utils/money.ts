// Utilidades de dinero exactas: los montos se manejan como centavos enteros o string decimal.
const MONEY_PATTERN = /^([+-])?(\d*)(?:\.(\d*))?$/;

// Convierte un monto ("1500.50" o número) a centavos enteros, redondeando a 2 decimales (mitad hacia arriba en magnitud).
export function toCents(value: string | number): number {
  const text = typeof value === 'number' ? value.toFixed(2) : String(value).trim();
  const match = MONEY_PATTERN.exec(text);
  if (!match || (match[2] === '' && (match[3] ?? '') === '')) {
    throw new Error('Monto inválido');
  }
  const sign = match[1] === '-' ? -1 : 1;
  const whole = Number(match[2] || '0');
  const fraction = (match[3] ?? '').padEnd(3, '0');
  let cents = whole * 100 + Number(fraction.slice(0, 2));
  if (Number(fraction[2]) >= 5) {
    cents += 1;
  }
  return cents === 0 ? 0 : sign * cents;
}

// Convierte centavos enteros a string decimal con 2 decimales ("1550.00").
export function fromCents(cents: number): string {
  const negative = cents < 0;
  const abs = Math.abs(Math.trunc(cents));
  const whole = Math.floor(abs / 100);
  const fraction = String(abs % 100).padStart(2, '0');
  return `${negative ? '-' : ''}${whole}.${fraction}`;
}

// Única función de redondeo a 2 decimales.
export function roundMoney(value: string | number): string {
  return fromCents(toCents(value));
}
