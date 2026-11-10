const app = require('./app');
const config = require('./config');
const { sequelize } = require('./models');
const { sembrarPlanes } = require('./seed');

async function iniciar() {
  try {
    await sequelize.authenticate();
    if (config.db.sync) {
      await sequelize.sync(); // crea las tablas si no existen
      await sembrarPlanes();
    }
    app.listen(config.puerto, () => {
      console.log(`ConectaNet API en http://localhost:${config.puerto}`);
      console.log(`Swagger:        http://localhost:${config.puerto}/api/docs`);
    });
  } catch (err) {
    console.error('No se pudo iniciar la API:', err.message);
    process.exit(1);
  }
}

iniciar();
