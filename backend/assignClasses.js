const mongoose = require('mongoose');

const mongoURI = 'mongodb+srv://Shrutmandir_superadmin:superadmin@shrutmandircluster.vka3i7d.mongodb.net/shrutmandir?appName=ShrutmandirCluster';

async function main() {
  await mongoose.connect(mongoURI);
  
  const Class = mongoose.model('Class', new mongoose.Schema({ className: String, ageGroup: String }, { strict: false }));
  const Student = mongoose.model('Student', new mongoose.Schema({ name: String, rollNo: String, age: Number, classId: mongoose.Schema.Types.ObjectId }, { strict: false }));
  
  const classes = await Class.find();
  const bal = classes.find(c => c.className === 'Bal Varg');
  const kishore = classes.find(c => c.className === 'Kishore Varg');
  const yuva = classes.find(c => c.className === 'Yuva Varg');
  
  if (!bal || !kishore || !yuva) {
    console.log('Missing classes!');
    process.exit(1);
  }
  
  const students = await Student.find();
  let updated = 0;
  
  for (const student of students) {
    const age = student.age || 0;
    let targetClassId = null;
    
    if (age > 0 && age <= 10) {
      targetClassId = bal._id;
    } else if (age >= 11 && age <= 15) {
      targetClassId = kishore._id;
    } else if (age >= 16) {
      targetClassId = yuva._id;
    } else {
      // Default to Bal Varg if age is 0 or missing? Or leave it?
      targetClassId = bal._id;
    }
    
    if (String(student.classId) !== String(targetClassId)) {
      await Student.updateOne({ _id: student._id }, { $set: { classId: targetClassId } });
      updated++;
    }
  }
  
  console.log(`Updated ${updated} students.`);
  process.exit(0);
}

main().catch(console.error);
