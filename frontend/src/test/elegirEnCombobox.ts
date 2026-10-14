import userEvent from '@testing-library/user-event';

/**
 * Reemplazo de `userEvent.selectOptions` para `ComboboxBuscable`: abre la lista y hace click en la
 * opción con ese `valor` (atributo `data-valor`). `''` borra el texto, que deja el campo sin elegir.
 */
export async function elegirEnCombobox(input: HTMLElement, valor: string): Promise<void> {
  if (valor === '') {
    await userEvent.clear(input);
    return;
  }
  await userEvent.click(input);
  const listbox = document.getElementById(input.getAttribute('aria-controls') ?? '');
  const opcion = listbox?.querySelector<HTMLElement>(`[data-valor="${CSS.escape(valor)}"]`);
  if (!opcion) throw new Error(`elegirEnCombobox: no hay opción con valor "${valor}"`);
  await userEvent.click(opcion);
}
