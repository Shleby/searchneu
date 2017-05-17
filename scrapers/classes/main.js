import elasticlunr from 'elasticlunr';
import path from 'path';
import mkdirp from 'mkdirp-promise';
import fs from 'fs-promise';
import algoliasearch from 'algoliasearch';
import _ from 'lodash';


import pageDataMgr from './pageDataMgr';
import macros from '../macros';
import utils from '../utils';
import Keys from '../../common/Keys';


const getSearchIndex = '/getSearchIndex';

class Main {

  constructor() {
    this.algoliaKey = null;

    this.getAlgoliaIndex()
  }


  async getAlgoliaIndex() {
    if (this.index) {
      return this.index
    }

    // This application ID is Public. 
    this.algoliaClient = algoliasearch('KTYX72Q2JT', (await this.getAlgoliaKey()));
    this.index = this.algoliaClient.initIndex('classes');
    console.log('Got index!', index)
  }

  // Grab they key from the env or the config file. 
  async getAlgoliaKey() {

    if (this.algoliaKey) {
      return this.algoliaKey;
    }

    if (process.env.ALGOLIA_KEY) {
      this.algoliaKey = process.env.ALGOLIA_KEY
      return process.env.ALGOLIA_KEY;
    }

    // Check two different paths for they API key. 
    let config;
    try {
      config = JSON.parse(await fs.readFile('/etc/searchneu/config.json'))
    }
    catch (e) {
      config = JSON.parse(await fs.readFile('/mnt/c/etc/searchneu/config.json'))
    }

    if (!config.algoliaSearchApiKey) {
      utils.critical("Could not get algolia search key!", config);
    }

    this.algoliaKey = config.algoliaSearchApiKey;

    return config.algoliaSearchApiKey;
  }

  async createDataDumps(termDump) {
    const termMapDump = {};


    for (const aClass of termDump.classes) {
      const hash = Keys.create(aClass).getHash();

      const termHash = Keys.create({
        host: aClass.host,
        termId: aClass.termId,
      }).getHash();

      if (!termMapDump[termHash]) {
        termMapDump[termHash] = {
          classMap: {},
          sectionMap: {},
          subjectMap: {},
          termId: aClass.termId,
          host: aClass.host,
        };
      }

      termMapDump[termHash].classMap[hash] = aClass;
    }

    for (const subject of termDump.subjects) {
      if (!subject.subject) {
        utils.error('Subject controller found in main.js????', subject);
        continue;
      }
      const hash = Keys.create(subject).getHash();

      const termHash = Keys.create({
        host: subject.host,
        termId: subject.termId,
      }).getHash();

      if (!termMapDump[termHash]) {
        console.log('Found subject with no class?');
        termMapDump[termHash] = {
          classMap: {},
          sectionMap: {},
          subjectMap: {},
          termId: subject.termId,
          host: subject.host,
        };
      }

      termMapDump[termHash].subjectMap[hash] = subject;
    }

    for (const section of termDump.sections) {
      const hash = Keys.create(section).getHash();

      const termHash = Keys.create({
        host: section.host,
        termId: section.termId,
      }).getHash();

      if (!termMapDump[termHash]) {
        console.log('Found section with no class?', termHash, hash);
        termMapDump[termHash] = {
          classMap: {},
          sectionMap: {},
          subjectMap: {},
          termId: section.termId,
          host: section.host,
        };
      }

      termMapDump[termHash].sectionMap[hash] = section;
    }

    const promises = [];

    for (const termHash in termMapDump) {
      const value = termMapDump[termHash];

      // Put them in a different file.
      if (!value.host || !value.termId) {
        utils.error('No host or Id?', value);
      }

      const folderPath = path.join(macros.PUBLIC_DIR, 'getTermDump', value.host);
      promises.push(mkdirp(folderPath).then(() => {
        return fs.writeFile(path.join(folderPath, value.termId + '.json'), JSON.stringify(value));
      }));
    }
    return Promise.all(promises);
  }


  // Class Lists object is specific to this file, and is created below.
  async createSearchIndexFromClassLists(termData, outputExtention = '', includeDesc = true) {
    const keys = Keys.create(termData);

    const index = elasticlunr();

    index.saveDocument(false);

    index.setRef('key');

    // Description is not included on mobile because it is not *really* required, and removing it makes loading on mobile faster.
    if (includeDesc) {
      index.addField('desc');
    }
    index.addField('name');
    index.addField('classId');
    index.addField('subject');

    // Remove profs from here once this data is joined with the prof data and there are UI elements for showing which classes a prof teaches.
    index.addField('profsString');

    // Lets disable this until buildings are added to the index and the DB.
    // Dosen't make sense for classes in a building to come up when the building name is typed in the search box.
    // If this is ever enabled again, make sure to add it to the config in home.js too. 
    // index.addField('locations');
    index.addField('crnsString');

    let itemsToIndex = []

    for (const attrName2 in termData.classHash) {
      const searchResultData = termData.classHash[attrName2];

      let toIndex = {};

      Object.assign(toIndex, searchResultData.class)

      toIndex.classId = searchResultData.class.classId;
      toIndex.desc = searchResultData.class.desc;
      toIndex.subject = searchResultData.class.subject;
      toIndex.name = searchResultData.class.name;
      toIndex.objectID = Keys.create(searchResultData.class).getHash();
      toIndex.sections = searchResultData.sections

      let profs = [];
      // let locations = [];
      searchResultData.sections.forEach((section) => {
        if (section.meetings) {
          section.meetings.forEach((meeting) => {
            if (meeting.profs) {
              profs = profs.concat(meeting.profs);
            }

            // if (meeting.where) {
            //   locations.push(meeting.where);
            // }
          });
        }
      });

      _.pull(profs, 'TBA')
      profs = _.uniq(profs)
      toIndex.profsString = profs.join(' ');
      // toIndex.locations = locations.join(' ');
      if (searchResultData.class.crns) {
        toIndex.crnsString = searchResultData.class.crns.join(' ');
      }

      if (searchResultData.class.crns.length === 0) {
        continue;
      }

      // index.addDoc(toIndex);

      itemsToIndex.push(toIndex);
    }

    // Add to algolia
    if (includeDesc && termData.termId === '201810') {
      // console.log(termData.termId, termData.host, 'HERERERERER')
      // process.exit();
      // const apiKey = await this.getAlgoliaKey();
// 

    // console.log(JSON.stringify(itemsToIndex, null, 4))
    // process.exit()

      let index = await this.getAlgoliaIndex()
      const retVal = index.addObjects(itemsToIndex.slice(0, 10), function (err, items) {
        console.log(err, items)
      })

      console.log(retVal)

      // console.log(apiKey)
      // process.exit()

    }

    const searchIndexString = JSON.stringify(index.toJSON());

    const fileName = path.join(macros.PUBLIC_DIR, keys.getHashWithEndpoint(getSearchIndex) + outputExtention + '.json');
    const folderName = path.dirname(fileName);

    await mkdirp(folderName);
    await fs.writeFile(fileName, searchIndexString);
    console.log('Successfully saved', fileName);
  }


  createSerchIndex(termDump) {
    let errorCount = 0;

    const classLists = {};

    termDump.classes.forEach((aClass) => {
      const termHash = Keys.create({
        host: aClass.host,
        termId: aClass.termId,
      }).getHash();

      const classHash = Keys.create(aClass).getHash();

      if (!classLists[termHash]) {
        classLists[termHash] = {
          classHash: {},
          host: aClass.host,
          termId: aClass.termId,
        };
      }

      classLists[termHash].classHash[classHash] = {
        class: aClass,
        sections: [],
      };
    });


    termDump.sections.forEach((section) => {
      const termHash = Keys.create({
        host: section.host,
        termId: section.termId,
      }).getHash();

      const classHash = Keys.create({
        host: section.host,
        termId: section.termId,
        subject: section.subject,
        classUid: section.classUid,
      }).getHash();


      if (!classLists[termHash]) {
        // The objects should all have been created when looping over the classes.
        utils.error('Dont have obj in section for loop?', termHash, classHash, section);
        errorCount++;
        return;
      }

      if (!classLists[termHash].classHash[classHash]) {
        // Only error on CI if error occurs in the term that is shown.
        // TODO change to if this section occured in the past utils.log, if it is in the future, utils.error.
        if (section.host === 'neu.edu' && section.termId === '201810') {
          utils.error('No class exists with same data?', classHash, section.url);
        } else {
          utils.log('No class exists with same data?', classHash, section.url);
        }
        errorCount++;
        return;
      }

      classLists[termHash].classHash[classHash].sections.push(section);
    });


    const promises = [];

    for (const attrName in classLists) {
      const termData = classLists[attrName];
      promises.push(this.createSearchIndexFromClassLists(termData));
      promises.push(this.createSearchIndexFromClassLists(termData, '.mobile', false));
    }

    console.log('Errorcount: ', errorCount);

    return Promise.all(promises);
  }


  async main(hostnames) {
    if (!hostnames) {
      console.error('Need hostnames for scraping classes');
      return;
    }

    const termDump = await pageDataMgr.main(hostnames);
    console.log('HI', !!termDump);
    await this.createSerchIndex(termDump);
    await this.createDataDumps(termDump);
  }


}

const instance = new Main();


async function test() {
  console.log(await instance.getAlgoliaKey())
}

if (require.main === module) {
  instance.main(['neu']);
  // test()
}

export default instance;
