const mongoose = require('mongoose');
const Class = require('./models/Class');
require('dotenv').config();

const STARTER_CLASSES = [
  { className: 'Bal Varg',     ageGroup: '5-10'  },
  { className: 'Kishore Varg', ageGroup: '11-15' },
  { className: 'Yuva Varg',    ageGroup: '16+'   },
];

async function main() {
  try {
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
      console.error('Error: MONGO_URI is not defined in .env');
      process.exit(1);
    }

    console.log('Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB.');

    // Only seed if no classes exist yet (idempotent)
    const existing = await Class.countDocuments();
    if (existing > 0) {
      console.log(`Classes already exist (${existing} found). Skipping seed.`);
      console.log('Existing classes:');
      const classes = await Class.find();
      classes.forEach(c => console.log(`  → ${c.className} (${c.ageGroup}) [_id: ${c._id}]`));
    } else {
      const created = await Class.insertMany(STARTER_CLASSES);
      console.log(`Successfully seeded ${created.length} classes:`);
      created.forEach(c => console.log(`  → ${c.className} (${c.ageGroup}) [_id: ${c._id}]`));
    }

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('Error seeding classes:', err.message);
    process.exit(1);
  }
}

main();
