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

export type EsBulkData = any;
export type BoolOpts = any;
export type EsAggregation = any;
export type SearchResult = any; // SearchResult form HydrateSerializer

// ======== Results ==========
export type EsResult = any;
export type EsMultiResult = {
  body: {
    responses: EsResultBody[]
  }
};

export interface EsResultBody {
  took: number,
  hits: {
    hits: {
      // blah
    }
  }
}

export interface EsResultAgg {
};

// ======== Queries ==========

export interface EsQuery {
  from: number,
  size: number,
  sort: SortQuery,
  query: QueryNode,
  aggregations?: EsAggregation
};

// every query is either a leaf query or a bool query
export type QueryNode = BoolQuery | LeafQuery;

export interface BoolQuery {
  bool: BoolType;
};

export type BoolType = MustQuery | ShouldQuery | FilterQuery;

// THESE ARE THE SAME. The only difference is what string shows up first.
export interface MustQuery {
  must: OneOrMany<QueryNode>;
};

export interface ShouldQuery {
  should: OneOrMany<QueryNode>;
};

export interface FilterQuery {
  filter: OneOrMany<QueryNode>;
};

export type LeafQuery = TermQuery 
                      | TermsQuery 
                      | ExistsQuery 
                      | MultiMatchQuery 
                      | typeof MATCH_ALL_QUERY;

export interface TermQuery {
  term: FieldQuery
}

export interface TermsQuery {
  terms: FieldQuery
}

export interface MultiMatchQuery {
  multi_match: {
    query: string,
    type: string,
    fuzziness: string,
    fields: string[]
  }
}

export const MATCH_ALL_QUERY = { match_all: {} };

export interface ExistsQuery {
  exists: { field: string };
}

// don't like the any
export interface FieldQuery {
  [fieldName: string]: any;
}

export type SortQuery = [string, SortStruct];

// I hate this name
export interface SortStruct {
  [fieldName: string]: {
    order: string,
    unmapped_type: string
  }
}

export interface QueryAgg {
  [aggName: string]: {
    terms: { field: string }
  }
}

type OneOrMany<T> = T | T[];



// this should be moved elsewhere, and is nearly the same as SearchOutput
// how do you aggregate that information?
export interface IntermediateOutput {
  output: EsResult,
  resultCount: number,
  took: number,
  aggregations: Record<string, EsAggregation>,
};

export interface SearchOutput {
  searchContent: SearchResult[],
  resultCount: number,
  took: number, // not sure about this
  aggregations: Record<string, EsAggregation>, // THIS IS TOTALLY WRONG
};

// ========= Filters =========
// how should FilterStruct work if I don't know they keys?
// that crazy lodash shit you saw


// what do FilterInput look like?

export type FilterInput = {
  [filterName: string]: ValidFilterInput
}

export interface FilterStruct<Input> {
  validate: (input: Input) => boolean,
  create: (input: Input) => BoolOpts,
  agg: false | string,
};


type ValidFilterInput = string | string[] | boolean;

// will revisit this, don't like the ValidFilterInput pattern
export type FilterPrelude = Record<string, FilterStruct<ValidFilterInput>>;


/*
type ReallyYes<T extends { [key: string]: any; }, K extends keyof T> = {
  [P in K]: FilterStruct<T[P]>
};
*/
