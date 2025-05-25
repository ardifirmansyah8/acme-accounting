// scripts/seed-database.ts
import { Sequelize } from 'sequelize-typescript';

import { Company } from '../db/models/Company';
import { User, UserRole } from '../db/models/User';

// Database connection setup
const sequelize = new Sequelize({
  dialect: 'postgres',
  database: 'task-dev',
  port: 5590,
  models: [Company, User],
  username: 'user',
  password: 'password',
  logging: console.log,
});

async function seedDatabase() {
  try {
    console.log('🌱 Starting companies and users seeding...\n');

    // Connect to database
    await sequelize.authenticate();
    console.log('✅ Database connected successfully');

    // Sync models (create tables if they don't exist)
    await sequelize.sync({ force: false }); // Set to true to recreate tables
    console.log('✅ Database tables synced');

    // Optional: Clear existing data (uncomment if you want to start fresh)
    // console.log('🧹 Clearing existing data...');
    // await User.destroy({ where: {}, truncate: true });
    // await Company.destroy({ where: {}, truncate: true });

    // Create Companies
    console.log('\n📊 Creating companies...');
    const companiesData = [
      { name: 'Tech Innovations Ltd' },
      { name: 'Global Marketing Corp' },
      { name: 'Healthcare Solutions Inc' },
      { name: 'Financial Services Group' },
      { name: 'Manufacturing Excellence Co' },
      { name: 'Retail Solutions Ltd' },
    ];

    const companies = await Company.bulkCreate(companiesData, {
      ignoreDuplicates: true, // Skip if already exists
      returning: true, // Return created instances
    });

    console.log(`✅ Created ${companies.length} companies`);

    // Get company IDs for user creation
    const allCompanies = await Company.findAll();
    const companyMap = new Map(allCompanies.map((c) => [c.name, c.id]));

    // Create Users with various role combinations for testing
    console.log('\n👥 Creating users...');
    const usersData = [
      // Tech Innovations Ltd - Complete setup (all roles)
      {
        name: 'Alice Johnson',
        role: UserRole.accountant,
        companyId: companyMap.get('Tech Innovations Ltd'),
      },
      {
        name: 'Bob Smith',
        role: UserRole.corporateSecretary,
        companyId: companyMap.get('Tech Innovations Ltd'),
      },
      {
        name: 'Carol Davis',
        role: UserRole.director,
        companyId: companyMap.get('Tech Innovations Ltd'),
      },

      // Global Marketing Corp - Director fallback scenario (no corporate secretary)
      {
        name: 'David Wilson',
        role: UserRole.accountant,
        companyId: companyMap.get('Global Marketing Corp'),
      },
      {
        name: 'Emma Brown',
        role: UserRole.director,
        companyId: companyMap.get('Global Marketing Corp'),
      },

      // Healthcare Solutions Inc - Corporate secretary available
      {
        name: 'Frank Miller',
        role: UserRole.corporateSecretary,
        companyId: companyMap.get('Healthcare Solutions Inc'),
      },
      {
        name: 'Grace Taylor',
        role: UserRole.accountant,
        companyId: companyMap.get('Healthcare Solutions Inc'),
      },
      {
        name: 'Henry Anderson',
        role: UserRole.director,
        companyId: companyMap.get('Healthcare Solutions Inc'),
      },

      // Financial Services Group - Multiple directors (error testing)
      {
        name: 'Iris Clark',
        role: UserRole.director,
        companyId: companyMap.get('Financial Services Group'),
      },
      {
        name: 'Jack Thompson',
        role: UserRole.director,
        companyId: companyMap.get('Financial Services Group'),
      },
      {
        name: 'Kate Williams',
        role: UserRole.accountant,
        companyId: companyMap.get('Financial Services Group'),
      },

      // Manufacturing Excellence Co - Multiple corporate secretaries (error testing)
      {
        name: 'Liam Martinez',
        role: UserRole.corporateSecretary,
        companyId: companyMap.get('Manufacturing Excellence Co'),
      },
      {
        name: 'Maya Singh',
        role: UserRole.corporateSecretary,
        companyId: companyMap.get('Manufacturing Excellence Co'),
      },
      {
        name: 'Noah Brown',
        role: UserRole.accountant,
        companyId: companyMap.get('Manufacturing Excellence Co'),
      },

      // Retail Solutions Ltd - Only accountants (missing other roles)
      {
        name: 'Olivia Davis',
        role: UserRole.accountant,
        companyId: companyMap.get('Retail Solutions Ltd'),
      },
      {
        name: 'Paul Wilson',
        role: UserRole.accountant,
        companyId: companyMap.get('Retail Solutions Ltd'),
      },
    ];

    const users = await User.bulkCreate(usersData, {
      ignoreDuplicates: true,
      returning: true,
    });

    console.log(`✅ Created ${users.length} users`);

    // Display detailed summary
    console.log('\n📊 Database Summary:');
    const totalCompanies = await Company.count();
    const totalUsers = await User.count();

    console.log(`  Companies: ${totalCompanies}`);
    console.log(`  Users: ${totalUsers}`);

    console.log('\n🚀 Ready to test ticket creation!');
  } catch (error) {
    console.error('❌ Seeding failed:', error);
  } finally {
    await sequelize.close();
  }
}

// Run the seeder
if (require.main === module) {
  void seedDatabase();
}

export { seedDatabase };
