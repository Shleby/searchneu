import fs from 'fs-extra';
import path from 'path';
import { MajorData } from '../backend/database/models/index';

interface Major {
  name: string;
  majorId: string;
  major: string;
  plans: string;
}

type MajorJSON = Record<string, Major[]>

// return the javascript object equivalent of a file in data/
function fetchData(filename: string): Object {
  return JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', filename)));
}

// migrate all majors in the directory to the DB
function migrateData(majorDirectory: MajorJSON): void {
  Object.entries(majorDirectory).forEach(([termId, majors]) => {
    majors.forEach((m: Major) => {
      const majorObj = fetchData(m.major);
      const planObj  = fetchData(m.plans);

      MajorData.create({
        requirements: majorObj,
        plansOfStudy: planObj,
        catalogYear: termId,
        name: m.name,
        majorId: m.majorId,
      });
    });
  });
}

migrateData(fetchData('major.json') as MajorJSON);
