/*
 * This file is part of Search NEU and licensed under AGPL3.
 * See the license file in the root folder for details.
 */

import _ from 'lodash';

import DataLib from './DataLib';

import classesScrapers from './scrapers/classes/main';

import macros from './macros';
import database from './database';
import Keys from '../common/Keys';
import ellucianCatalogParser from './scrapers/classes/parsers/ellucianCatalogParser';
import notifyer from './notifyer';


class Updater {
  // Don't call this directly, call .create instead.
  constructor() {
    // 5 min if prod, 30 sec if dev.
    // In dev the cache will be used so we are not actually hitting NEU's servers anyway.
    const intervalTime = macros.PROD ? 300000 : 30000;

    setInterval(() => {
      try {
        this.onInterval();
      } catch (e) {
        macros.warn('Updater failed with :', e);
      }
    }, intervalTime);
  }


  static create() {
    return new this();
  }

  // This runs every couple of minutes and checks to see if any seats opened (or anything else changed) in any of the classes that people are watching
  // The steps of this process:
  // Fetch the user data from the database.
  // List the classes and sections that people are watching
  //   - This data is stored as hashes (Keys...getHash()) in the user DB
  // Access the data stored in elasticsearch
  // Access the URLs from these objects and use them to scrape the latest data about these classes
  // Compare with the existing data
  // Notify users about any changes
  // Update the local data about the changes
  async onInterval() {
    macros.log('updating');
    const startTime = Date.now();

    let users = await database.get('users');
    if (!users) {
      return;
    }

    users = Object.values(users);

    let classHashes = [];
    let sectionHashes = [];

    const sectionHashToUsers = {};
    const classHashToUsers = {};

    for (const user of users) {
      if (!user.facebookMessengerId) {
        macros.warn('User has no FB id?', JSON.stringify(user));
        continue;
      }

      // Firebase, for some reason, strips leading 0s from the Facebook messenger id.
      // Add them back here.
      while (user.facebookMessengerId.length < 16) {
        user.facebookMessengerId = `0${user.facebookMessengerId}`;
      }


      if (!user.watchingClasses) {
        user.watchingClasses = [];
      }

      if (!user.watchingSections) {
        user.watchingSections = [];
      }

      // When an item is deleted from an array in firebase, firebase dosen't shift the rest of the items down one index.
      // Instead, it adds an undefined item to the array.
      // This removes any possible undefined items from the array.
      // The warnings can be added back when unsubscribing is done with code.
      _.pull(user.watchingClasses, null);
      _.pull(user.watchingSections, null);

      classHashes = classHashes.concat(user.watchingClasses);
      sectionHashes = sectionHashes.concat(user.watchingSections);

      for (const classHash of user.watchingClasses) {
        if (!classHashToUsers[classHash]) {
          classHashToUsers[classHash] = [];
        }

        classHashToUsers[classHash].push(user.facebookMessengerId);
      }

      for (const sectionHash of user.watchingSections) {
        if (!sectionHashToUsers[sectionHash]) {
          sectionHashToUsers[sectionHash] = [];
        }

        sectionHashToUsers[sectionHash].push(user.facebookMessengerId);
      }
    }

    // Remove duplicates. This will occur if multiple people are watching the same class.
    classHashes = _.uniq(classHashes);
    sectionHashes = _.uniq(sectionHashes);

    // Track all section hashes of classes that are being watched. Used for sanity check
    const sectionHashesOfWatchedClasses = [];

    // Get the data for these hashes
    const classes = [];

    for (const classHash of classHashes) {
      const aClass = await DataLib.getClassServerDataFromHash(classHash);

      if (!aClass) {
        // TODO: fix, and then re-enable this line
        // need to make sure outdated classes are not being processed.
        // https://github.com/ryanhugh/searchneu/issues/83
        // macros.warn('Unable to fetch class for hash!', classHash);
        continue;
      }

      classes.push(aClass);

      if (aClass.crns) { // TODO this can just loop through aClass.sections???
        for (const crn of aClass.crns) {
          const sectionHash = Keys.getSectionHash({
            host: aClass.host,
            termId: aClass.termId,
            subject: aClass.subject,
            classId: aClass.classId,
            crn: crn,
          });
          sectionHashesOfWatchedClasses.push(sectionHash);
        }
      }
    }

    // Sanity check: Find the sections that are being watched, but are not part of a watched class
    for (const sectionHash of _.difference(sectionHashes, sectionHashesOfWatchedClasses)) {
      macros.warn('Section', sectionHash, "is being watched but it's class is not being watched?");
    }

    // Scrape the latest data
    const promises = classes.map((aClass) => {
      return ellucianCatalogParser.main(aClass.prettyUrl).then((newClass) => {
        if (!newClass) {
          // TODO: This should be changed into a notification that the class probably no longer exists. Shoudn't unsubscribe people.
          macros.warn('New class data is null?', aClass.prettyUrl, aClass);
          return null;
        }


        // Copy over some fields that are not scraped from this scraper.
        newClass.value.host = aClass.host;
        newClass.value.termId = aClass.termId;
        newClass.value.subject = aClass.subject;

        return newClass;
      });
    });

    // Remove the instances where newClass was null
    _.pull(promises, null);

    let allParsersOutput;

    try {
      allParsersOutput = await Promise.all(promises);
    } catch (e) {
      macros.warn('ellucianCatalogParser call failed in updater with error:', e);
      return;
    }

    // Remove any instances where the output was null.
    // This can happen if the class at one of the urls that someone was watching dissapeared or was taken down
    // In this case the output of the ellucianCatalogParser will be null.
    _.pull(allParsersOutput, null);

    const rootNode = {
      type: 'ignore',
      deps: allParsersOutput,
      value: {},
    };

    // Because ellucianCatalogParser returns a list of classes, instead of a singular class, we need to run it on all of them
    const output = classesScrapers.restructureData(rootNode);

    if (!output.sections) {
      output.sections = [];
    }

    if (!output.classes) {
      output.classes = [];
    }

    // Keep track of which terms have classes that we are updating.
    const updatingTerms = {};
    for (const aClass of classes) {
      updatingTerms[aClass.termId] = true;
    }

    for (const termId of Object.keys(updatingTerms)) {
      // Copy over every class we didn't just update from the old data.
      // eslint-disable-next-line no-await-in-loop
      const oldClasses = await DataLib.getClassesInTerm(termId);

      for (const aClass of oldClasses) {
        const hash = Keys.getClassHash(aClass);

        // TODO: Change this from classHashes to a hash of the output classes after the re-factor away classUid
        if (!classHashes.includes(hash)) {
          output.classes.push(aClass);
        }
      }

      const oldSections = await DataLib.getSectionsInTerm(termId);


      // THIS WILL COPY OVER EVERY section from the old to the new data, even ones that no longer exist in the new data.
      // need a way to figure out how to exclude sections that no longer exist in the new data. TODOOOO
      for (const section of oldSections) {
        const hash = Keys.getSectionHash(section);

        // TODO: Change this from classHashes to a hash of the output classes after the re-factor away classUid
        if (!sectionHashes.includes(hash)) {
          output.sections.push(section);
        }
      }
    }

    classesScrapers.runProcessors(output);
    console.log("Test output", output);


    // Keep track of which messages to send which users.
    // The key is the facebookMessengerId and the value is a list of messages.
    const userToMessageMap = {};

    for (const aNewClass of output.classes) {
      const hash = Keys.getClassHash(aNewClass);

      const oldClass = await DataLib.getClassServerDataFromHash(hash);

      // Count how many sections are present in the new but not in the old.
      let count = 0;
      if (aNewClass.crns) {
        for (const crn of aNewClass.crns) {
          if (!oldClass.crns.includes(crn)) {
            count++;
          }
        }
      }

      let message = '';
      const classCode = `${aNewClass.subject} ${aNewClass.classId}`;

      if (count === 1) {
        message = `A section was added to ${classCode}!`;
      } else if (count > 1) {
        message = `${count} sections were added to ${classCode}!`;
      }

      if (message) {
        // If there is no space between the classId and the exclamation mark
        // Facebook Messenger on mobile will include the exclamation mark in the hyperlink
        // Oddly enough, Facebook messenger on desktop will not include the exclamation mark in the URL.
        message += ` Check it out at https://searchneu.com/${aNewClass.termId}/${aNewClass.subject}${aNewClass.classId} !`;

        // Get the list of users who were watching this class
        const usersToMessage = classHashToUsers[hash];
        if (!usersToMessage) {
          continue;
        }

        // Send them all a notification.
        for (const user of usersToMessage) {
          if (!userToMessageMap[user]) {
            userToMessageMap[user] = [];
          }

          userToMessageMap[user].push(message);
        }
      }
    }

    for (const newSection of output.sections) {
      const hash = Keys.getSectionHash(newSection);

      const oldSection = await DataLib.getSectionServerDataFromHash(hash);

      // This may run in the odd chance that that the following 3 things happen:
      // 1. a user signes up for a section.
      // 2. the section dissapears (eg. it is removed from Banner).
      // 3. the section re appears again.
      // If this happens just ignore it for now, but the best would probably to be notifiy if there are seats open now
      if (!oldSection) {
        macros.warn('Section was added?', hash, newSection, sectionHashToUsers, classHashToUsers);
        continue;
      }

      let message;

      if (newSection.seatsRemaining > 0 && oldSection.seatsRemaining <= 0) {
        // See above comment about space before the exclamation mark.
        message = `A seat opened up in ${newSection.subject} ${newSection.classId} (CRN: ${newSection.crn}). Check it out at https://searchneu.com/${newSection.termId}/${newSection.subject}${newSection.classId} !`;
      } else if (newSection.waitRemaining > 0 && oldSection.waitRemaining <= 0) {
        message = `A waitlist seat opened up in ${newSection.subject} ${newSection.classId} (CRN: ${newSection.crn}). Check it out at https://searchneu.com/${newSection.termId}/${newSection.subject}${newSection.classId} !`;
      }

      if (message) {
        const usersToMessage = sectionHashToUsers[hash];
        if (!usersToMessage) {
          continue;
        }

        for (const user of usersToMessage) {
          if (!userToMessageMap[user]) {
            userToMessageMap[user] = [];
          }

          userToMessageMap[user].push(message);
        }
      }
    }

    // Update dataLib with the updated termDump
    // If we ever move to a real database, we would want to change this so it only updates the classes that the scrapers found.
    for (const aClass of output.classes) {
      await DataLib.setClass(aClass);
    }

    for (const section of output.sections) {
      await DataLib.setSection(section);
    }


    // Loop through the messages and send them.
    // Do this as the very last stage on purpose.
    // If something crashes/breaks above, the new data is saved to the database
    // and does not cause a notification to be sent to users every five minutes
    // (because the new data will be saved, the next time this runs it will compare against the new data)
    // If this is ran before the data is saved, this could happen:
    // Fetch new data -> send notification -> crash (repeat), and never save the updated data.
    for (const fbUserId of Object.keys(userToMessageMap)) {
      for (const message of userToMessageMap[fbUserId]) {
        notifyer.sendFBNotification(fbUserId, message);
      }
      setTimeout(((facebookUserId) => {
        notifyer.sendFBNotification(facebookUserId, 'Reply with "stop" to unsubscribe from notifications.');
      }).bind(this, fbUserId), 100);

      macros.logAmplitudeEvent('Facebook message sent out', {
        toUser: fbUserId,
        messages: userToMessageMap[fbUserId],
        messageCount: userToMessageMap[fbUserId].length,
      });
    }


    const totalTime = Date.now() - startTime;

    macros.log('Done running updater onInterval. It took', totalTime, 'ms.');

    macros.logAmplitudeEvent('Updater', {
      totalTime: totalTime,
    });
  }
}

export default Updater;
