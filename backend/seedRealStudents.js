const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const mongoose = require('mongoose');
const Student = require('./models/Student');
require('dotenv').config();

const parseCsv = () => {
  return new Promise((resolve, reject) => {
    const results = [];
    const csvFilePath = path.join(__dirname, 'students.csv');

    fs.createReadStream(csvFilePath)
      .pipe(csv())
      .on('data', (data) => {
        // Map the CSV headers (with fallbacks to match the actual CSV columns)
        const rollNo = (data.RollNo || '').trim();
        const name = (data.DuplicateName || data.Name || '').trim();
        const phoneNumber = (data.PhoneNumber || data.Number || '').trim();
        const village = (data.Village || '').trim();
        const points = data.Points ? Number(data.Points) || 0 : 0;

        // Skip rows that lack required schema fields (rollNo and name) to prevent Mongoose validation errors
        if (!rollNo || !name) {
          console.log(`Skipping row with missing required data: RollNo = "${rollNo}", Name = "${name}"`);
          return;
        }

        results.push({
          rollNo,
          name,
          phoneNumber,
          village,
          points
        });
      })
      .on('end', () => {
        resolve(results);
      })
      .on('error', (error) => {
        reject(error);
      });
  });
};

async function main() {
  try {
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
      console.error('Error: MONGO_URI is not defined in the environment variables.');
      process.exit(1);
    }

    console.log('Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB successfully.');

    console.log('Reading and parsing students.csv...');
    const studentsData = await parseCsv();
    console.log(`Parsed ${studentsData.length} students from CSV.`);

    console.log('Clearing existing students...');
    await Student.deleteMany({});
    console.log('Deleted all existing documents in the students collection.');

    console.log('Inserting new students into MongoDB...');
    const insertedDocs = await Student.insertMany(studentsData);
    console.log(`Successfully imported all students! Total: ${insertedDocs.length}`);

    // Disconnect and exit gracefully
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('An error occurred during the import process:', error);
    process.exit(1);
  }
}

main();
