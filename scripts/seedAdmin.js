const bcrypt = require('bcryptjs');
const db = require('../src/models');

async function seed() {
  try {
    const hash = await bcrypt.hash('Inzeedo@99', 10);
    const existing = await db.User.findOne({ where: { phone: 'mrjoon005@gmail.com' } });
    if (existing) {
      await existing.update({ password_hash: hash, role: 'admin', is_active: true });
      console.log('Updated existing super admin password');
    } else {
      await db.User.create({
        name: 'Super Admin',
        phone: 'mrjoon005@gmail.com',
        password_hash: hash,
        role: 'admin',
        shop_id: null
      });
      console.log('Created super admin successfully');
    }
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

seed();
