import { describe, expect, it } from 'vitest';
import { conRegionDeFunciones } from './regionFunciones';

const BASE = 'https://proyecto.supabase.co';

describe('conRegionDeFunciones', () => {
  it('fuerza la región de la base en las llamadas a Edge Functions', () => {
    expect(conRegionDeFunciones(`${BASE}/functions/v1/vehiculos/abc`, BASE)).toBe(
      `${BASE}/functions/v1/vehiculos/abc?forceFunctionRegion=us-east-1`,
    );
  });

  it('respeta la query existente', () => {
    expect(conRegionDeFunciones(`${BASE}/functions/v1/pacientes?page=2`, BASE)).toBe(
      `${BASE}/functions/v1/pacientes?page=2&forceFunctionRegion=us-east-1`,
    );
  });

  it('no toca PostgREST, auth ni otros hosts', () => {
    expect(conRegionDeFunciones(`${BASE}/rest/v1/permisos?select=*`, BASE)).toBe(`${BASE}/rest/v1/permisos?select=*`);
    expect(conRegionDeFunciones(`${BASE}/auth/v1/user`, BASE)).toBe(`${BASE}/auth/v1/user`);
    expect(conRegionDeFunciones('https://otro.com/functions/v1/x', BASE)).toBe('https://otro.com/functions/v1/x');
  });

  it('no duplica el parámetro si ya viene', () => {
    const url = `${BASE}/functions/v1/vehiculos?forceFunctionRegion=us-east-1`;
    expect(conRegionDeFunciones(url, BASE)).toBe(url);
  });
});
