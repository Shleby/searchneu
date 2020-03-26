<<<<<<< HEAD
// An NU employee
export interface Employee {
  name: string,
  firstName: string,
  lastName: string,
  primaryDepartment?: string,
  primaryRole?: string,
  phone?: string,
  emails: string[],
  url?: string,
  streetAddress?: string,
  personalSite?: string,
  googleScholarId?: string,
  bigPictureUrl?: string,
  pic?: string,
  link?: string,
  officeRoom?: string
}

// A course within a semester
export interface Course {
  host: string,
  termId: string,
  subject: string,
  classId: string,
  classAttributes: string[],
  desc: string,
  prettyUrl: string,
  name: string,
  url: string,
  lastUpdateTime: number,
  maxCredits: number,
  minCredits: number,
  coreqs: Requisite,
  prereqs: Requisite,
}

// A co or pre requisite object.
export type Requisite = string | BooleanReq | CourseReq;
export interface BooleanReq {
  type: 'and' | 'or';
  values: Requisite[];
}
export interface CourseReq {
  classId: string;
  subject: string;
  missing?: true;
}
export function isBooleanReq(req: Requisite): req is BooleanReq {
  return (req as BooleanReq).type !== undefined;
}
export function isCourseReq(req: Requisite): req is CourseReq {
  return (req as CourseReq).classId !== undefined;
}

// A section of a course
export interface Section {
  host: string,
  termId: string,
  subject: string,
  classId: string,
  crn: string,
  seatsCapacity: number,
  seatsRemaining: number,
  waitCapacity: number,
  waitRemaining: number,
  online: boolean,
  honors: boolean,
  url: string,
  profs: string[],
  meetings: Meeting[],
}

// A block of meetings, ex: "Tuesdays+Fridays, 9:50-11:30am"
export interface Meeting {
  startDate: number,
  endDate: number,
  where: string,
  type: string,
  times: Record<'0'|'1'|'2'|'3'|'4'|'5'|'6', MeetingTime>
}

// A single meeting time, ex: "9:50-11:30am"
export interface MeetingTime {
  start: number,
  end: number,
}

/*
 * This file is part of Search NEU and licensed under AGPL3.
 * See the license file in the root folder for details.
 *
 * ONLY PUT COMMONLY USED TYPES HERE
 */

// ======= Search =========
// this is a TODO list, not the final types
export type ESReturn = any; 
export type EsBulkData = any;
export type EsMapping = any;
// how should FilterStruct work if I don't know they keys?
// that crazy lodash shit you saw
export type FilterStruct = any;
export type UserFilters = any;

export type EsQuerySort = any;
export type BoolOpts = any;
export type EsAggregation = any;

export interface EsQuery {
  from: number,
  size: number,
  sort: EsQuerySort,
  query: BoolQuery
  aggregations?: EsAggregation
};

export interface BoolQuery {
  bool: BoolOpts;
};
