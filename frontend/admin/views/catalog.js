import { html, setHTML } from '/js/core/dom.js';
import { crudSection } from '../crud.js';
import { bool } from '../ui.js';

export async function render(root) {
  setHTML(root, html`<div data-cats></div><div data-cols style="margin-top:16px"></div>`);
  await crudSection(root.querySelector('[data-cats]'), {
    title: 'Categorías', singular: 'categoría', newLabel: 'Nueva categoría', endpoint: '/admin/categories',
    empty: 'No hay categorías.', help: 'Aparecen en el menú de filtros y en la portada. Una categoría con productos no se puede borrar: desactívala.',
    columns: [{ label: 'Nombre', key: 'name' }, { label: 'Enlace', render: (c) => html`<span class="mono small">/categoria/${c.slug}</span>` }, { label: 'Productos', num: true, render: (c) => c._count?.products ?? 0 }, { label: 'Orden', key: 'sortOrder', num: true }, { label: 'Activa', render: (c) => bool(c.active) }],
    fields: [
      { name: 'name', label: 'Nombre', required: true }, { name: 'slug', label: 'Enlace', placeholder: 'se genera del nombre' },
      { name: 'description', label: 'Descripción', type: 'textarea', full: true, max: 300 },
      { name: 'imageUrl', label: 'Imagen', type: 'image' },
      { name: 'sortOrder', label: 'Orden', type: 'number', default: 0 }, { name: 'active', label: 'Activa', type: 'checkbox' },
    ],
  });
  await crudSection(root.querySelector('[data-cols]'), {
    title: 'Colecciones y drops', singular: 'colección', newLabel: 'Nueva colección', endpoint: '/admin/collections',
    empty: 'No hay colecciones.', help: 'Asigna productos a una colección desde la ficha de cada producto.',
    columns: [{ label: 'Nombre', key: 'name' }, { label: 'Tipo', render: (c) => (c.isDrop ? 'Drop' : 'Colección') }, { label: 'Productos', num: true, render: (c) => c._count?.products ?? 0 }, { label: 'Activa', render: (c) => bool(c.active) }],
    fields: [
      { name: 'name', label: 'Nombre', required: true }, { name: 'slug', label: 'Enlace', placeholder: 'se genera del nombre' },
      { name: 'description', label: 'Descripción', type: 'textarea', full: true },
      { name: 'imageUrl', label: 'Imagen', type: 'image' },
      { name: 'releaseDate', label: 'Fecha de lanzamiento', type: 'date' },
      { name: 'isDrop', label: 'Es un drop (lanzamiento)', type: 'checkbox', default: false }, { name: 'active', label: 'Activa', type: 'checkbox' },
    ],
  });
}
