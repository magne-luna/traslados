// deno test supabase/functions/facturar/codigoBarrasAfip.test.ts
import { assertEquals, assertMatch } from 'jsr:@std/assert@1';
import { codigoBarrasAfip, digitoVerificadorModulo10 } from './codigoBarrasAfip.ts';

Deno.test('digitoVerificadorModulo10: mod 10 con ponderación alterna 3-1 desde la derecha', () => {
  // '1' solo: posición 1 (impar) x3 = 3 -> (10 - 3%10) % 10 = 7
  assertEquals(digitoVerificadorModulo10('1'), 7);
  // '12': pos1(2)x3=6 + pos2(1)x1=1 -> total 7 -> (10-7)%10 = 3
  assertEquals(digitoVerificadorModulo10('12'), 3);
});

Deno.test('digitoVerificadorModulo10: string de ceros -> 0', () => {
  assertEquals(digitoVerificadorModulo10('0000000000'), 0);
});

Deno.test('codigoBarrasAfip: 42 dígitos, termina en el verificador', () => {
  const s = codigoBarrasAfip({
    cuitEmisor: '20-26756539-3',
    tipoComprobante: 'A',
    ptoVta: 1,
    cae: '65167211',
    caeVencimiento: '2008-07-25',
  });
  assertEquals(s.length, 42);
  assertMatch(s, /^\d{42}$/);
  assertEquals(s.slice(0, 11), '20267565393');
  assertEquals(s.slice(11, 14), '001'); // tipo A = 01 -> pad 3
  assertEquals(s.slice(14, 19), '00001'); // pto vta
});

Deno.test('codigoBarrasAfip: la letra determina el código de comprobante', () => {
  const base = { cuitEmisor: '20111111112', ptoVta: 2, cae: '12345678', caeVencimiento: '2026-01-01' } as const;
  assertEquals(codigoBarrasAfip({ ...base, tipoComprobante: 'A' }).slice(11, 14), '001');
  assertEquals(codigoBarrasAfip({ ...base, tipoComprobante: 'B' }).slice(11, 14), '006');
  assertEquals(codigoBarrasAfip({ ...base, tipoComprobante: 'C' }).slice(11, 14), '011');
});
