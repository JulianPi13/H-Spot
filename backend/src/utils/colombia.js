// Departamentos de Colombia (32 + Bogotá D.C.)
const DEPARTAMENTOS = [
  'Amazonas', 'Antioquia', 'Arauca', 'Atlántico', 'Bogotá D.C.', 'Bolívar', 'Boyacá', 'Caldas',
  'Caquetá', 'Casanare', 'Cauca', 'Cesar', 'Chocó', 'Córdoba', 'Cundinamarca', 'Guainía',
  'Guaviare', 'Huila', 'La Guajira', 'Magdalena', 'Meta', 'Nariño', 'Norte de Santander',
  'Putumayo', 'Quindío', 'Risaralda', 'San Andrés y Providencia', 'Santander', 'Sucre',
  'Tolima', 'Valle del Cauca', 'Vaupés', 'Vichada',
];

// Celular colombiano: 10 dígitos que empiezan por 3. Fijo nacional: 60 + 8 dígitos.
// Acepta +57, espacios y guiones; devuelve solo los 10 dígitos o null.
function normalizeColombianPhone(input) {
  let digits = String(input || '').replace(/[^\d]/g, '');
  if (digits.startsWith('57') && digits.length === 12) digits = digits.slice(2);
  if (/^3\d{9}$/.test(digits) || /^60\d{8}$/.test(digits)) return digits;
  return null;
}

module.exports = { DEPARTAMENTOS, normalizeColombianPhone };
