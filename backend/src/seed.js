const { Plan } = require('./models');

const PLANES = [
  { nombre: 'Internet Básico', tipo: 'internet', velocidad: '100 Mbps', precio: 55000, descripcion: 'Fibra óptica para navegar, estudiar y redes sociales.' },
  { nombre: 'Internet Hogar', tipo: 'internet', velocidad: '300 Mbps', precio: 75000, descripcion: 'Ideal para teletrabajo y varias pantallas en streaming.' },
  { nombre: 'Internet Ultra', tipo: 'internet', velocidad: '600 Mbps', precio: 99000, descripcion: 'Máxima velocidad para gaming y hogares conectados.' },
  { nombre: 'TV Esencial', tipo: 'tv', velocidad: null, precio: 45000, descripcion: '80 canales nacionales e internacionales.' },
  { nombre: 'Combo Familiar', tipo: 'combo', velocidad: '300 Mbps', precio: 110000, descripcion: 'Internet 300 Mbps + 120 canales de TV, incluye canales HD.' },
];

/** Inserta los planes solo si la tabla está vacía (idempotente). */
async function sembrarPlanes() {
  if ((await Plan.count()) === 0) {
    await Plan.bulkCreate(PLANES);
    console.log(`Se crearon ${PLANES.length} planes de ejemplo`);
  }
}

module.exports = { sembrarPlanes, PLANES };

// Permite ejecutar "npm run seed" directamente.
if (require.main === module) {
  const { sequelize } = require('./models');
  sequelize
    .sync()
    .then(sembrarPlanes)
    .then(() => sequelize.close())
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
