require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('../src/models');
const fs = require('fs');
const path = require('path');

async function seed() {
  try {
    console.log('Synchronizing database models...');
    await db.sequelize.sync({ force: true }); // Reset DB for fresh seed
    console.log('Database synced.');

    // 1. Create Plans
    console.log('Creating demo plans...');
    const basicPlan = await db.Plan.create({
      name: 'Basic',
      price_monthly: 1000,
      price_yearly: 10000,
      max_customers: 200,
      trial_days: 14
    });

    const premiumPlan = await db.Plan.create({
      name: 'Premium',
      price_monthly: 2500,
      price_yearly: 25000,
      max_customers: 999999, // unlimited
      trial_days: 14
    });

    // 2. Create Platform Admin
    console.log('Creating Platform Admin...');
    const adminPhone = process.env.ADMIN_PHONE || '0710000000';
    const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@123';
    await db.User.create({
      phone: adminPhone,
      password_hash: await bcrypt.hash(adminPassword, 10),
      name: 'Platform Admin',
      role: 'admin'
    });
    console.log(`Platform Admin created: ${adminPhone} / ${adminPassword}`);

    // 3. Create Demo Shop
    console.log('Creating Demo Shop...');
    const shop = await db.Shop.create({
      plan_id: premiumPlan.id,
      name: 'Demo Supermarket (Pvt) Ltd',
      phone: '0771234567',
      address: '123 Galle Road, Colombo 04',
      business_type: 'retail',
      language_pref: 'english',
      subscription_status: 'trial'
    });

    // 4. Create Shop Owner
    console.log('Creating Demo Shop Owner...');
    const ownerPhone = '0771112222';
    const ownerPassword = 'password123';
    await db.User.create({
      shop_id: shop.id,
      name: 'Kamal Perera',
      phone: ownerPhone,
      password_hash: await bcrypt.hash(ownerPassword, 10),
      role: 'owner'
    });
    console.log(`Demo Shop Owner created: ${ownerPhone} / ${ownerPassword}`);

    // 5. Create Sample Customers
    console.log('Creating Demo Customers...');
    const customer1 = await db.Customer.create({
      shop_id: shop.id,
      customer_code: `C-${shop.id}-0001`,
      name: 'Sunil Shantha',
      phone: '0714445555',
      type: 'weekly',
      balance: 1500.00,
      loan_limit: 5000.00,
      qr_code: 'sample-qr-code-1'
    });

    await db.Loan.create({
      shop_id: shop.id,
      customer_id: customer1.id,
      amount: 1500.00,
      note: 'Grocery credit',
      status: 'active',
      created_by: 2 // owner id approx
    });

    const customer2 = await db.Customer.create({
      shop_id: shop.id,
      customer_code: `C-${shop.id}-0002`,
      name: 'Nimal Silva',
      phone: '0789998888',
      type: 'monthly',
      balance: 0.00,
      loan_limit: 10000.00,
      qr_code: 'sample-qr-code-2'
    });

    console.log('Seed completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('Seed failed:', err);
    process.exit(1);
  }
}

seed();
