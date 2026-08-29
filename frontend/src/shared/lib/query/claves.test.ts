import { describe, expect, it } from 'vitest';
import { claves } from './claves';

// tasks.md 1.3-1.5. Lo que estos tests protegen no es "que la clave sea la que es", sino la
// PROPIEDAD que hace correcta a toda la invalidación del change (design.md §D4): invalidar el
// prefijo de un dominio tiene que alcanzar a su lista Y a todas sus páginas. Una clave mal armada
// no falla — simplemente no invalida nada, y el bug aparece semanas después como un dato viejo en
// un selector (R1).

const rango = { pagina: 1, tamanio: 20 };

describe('claves de React Query', () => {
  it('la clave de lista comparte prefijo con la de página, para que invalidar el dominio alcance a ambas', () => {
    const dominio = claves.pacientes.todos();
    const lista = claves.pacientes.lista();
    const pagina = claves.pacientes.pagina({ ...rango, filtros: { busqueda: '' } });

    expect(lista.slice(0, dominio.length)).toEqual([...dominio]);
    expect(pagina.slice(0, dominio.length)).toEqual([...dominio]);
  });

  it('dos dominios distintos nunca comparten prefijo', () => {
    const dominios = [
      claves.pacientes.todos(),
      claves.vehiculos.todos(),
      claves.conductores.todos(),
      claves.obrasSociales.todos(),
      claves.facturas.todos(),
      claves.cobros.todos(),
      claves.presupuestos.todos(),
      claves.autorizaciones.todos(),
      claves.hojasDeRuta.todos(),
      claves.cuentas.todos(),
    ].map((c) => c[0]);

    expect(new Set(dominios).size).toBe(dominios.length);
  });

  it('dos consultas paginadas con filtros distintos producen claves distintas', () => {
    const a = claves.pacientes.pagina({ ...rango, filtros: { busqueda: 'perez' } });
    const b = claves.pacientes.pagina({ ...rango, filtros: { busqueda: 'gomez' } });

    expect(a).not.toEqual(b);
  });

  it('dos consultas paginadas con distinta página producen claves distintas', () => {
    const a = claves.pacientes.pagina({ pagina: 1, tamanio: 20, filtros: { busqueda: '' } });
    const b = claves.pacientes.pagina({ pagina: 2, tamanio: 20, filtros: { busqueda: '' } });

    expect(a).not.toEqual(b);
  });

  it('con los mismos argumentos, la clave es estable entre llamadas', () => {
    const query = { ...rango, filtros: { busqueda: 'perez' } };

    expect(claves.pacientes.pagina(query)).toEqual(claves.pacientes.pagina({ ...query }));
  });
});
