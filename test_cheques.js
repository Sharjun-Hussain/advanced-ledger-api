const db = require('./src/models');
async function run() {
  const cheques = await db.Cheque.findAll({ raw: true });
  console.log('Cheques in DB:', cheques);
  process.exit(0);
}
run();
