/* eslint-disable no-underscore-dangle */
/*
 * This file is part of Search NEU and licensed under AGPL3.
 * See the license file in the root folder for details.
 */

import { Client } from '@elastic/elasticsearch';
import _ from 'lodash';
import pMap from 'p-map';
import macros from './macros';
import { EsBulkData, EsQuery, EsMapping, EsMultiResult, EsResult } from './types';

const URL: string = macros.getEnvVariable('elasticURL') || 'http://localhost:9200';
const client = new Client({ node: URL });

const BULKSIZE = 5000;

export class Elastic {
  CLASS_INDEX: string;
  EMPLOYEE_INDEX: string;

  constructor() {
    // Because we export an instance of this class, put the constants on the instance.
    this.CLASS_INDEX = 'classes';
    this.EMPLOYEE_INDEX = 'employees';
  }

  async isConnected(): Promise<boolean> {
    try {
      await client.ping();
    } catch (err) {
      return false;
    }
    return true;
  }

  /**
   * @param  {string} indexName The index to insert into
   * @param  {Object} mapping   The new elasticsearch index mapping(schema)
   */
  async resetIndex(indexName: string, mapping: EsMapping): Promise<any> {
    const exists = (await client.indices.exists({ index: indexName })).statusCode === 200;
    if (exists) {
      // Clear out the index.
      macros.log('deleting index', indexName);
      await client.indices.delete({ index: indexName });
    }
    // Put in the new classes mapping (elasticsearch doesn't let you change mapping of existing index)
    macros.log('inserting mapping for index', indexName);
    await client.indices.create({
      index: indexName,
      body: mapping,
    });
  }

  /**
   * Bulk index a collection of documents using ids from hashmap
   * @param  {string} indexName The index to insert into
   * @param  {Object} map       A map of document ids to document sources to create
   */
  async bulkIndexFromMap(indexName: string, map: EsBulkData): Promise<any> {
    // TODO not sure what the type is here
    const chunks = _.chunk(Object.keys(map), BULKSIZE);
    return pMap(chunks, async (chunk, chunkNum) => {
      const bulk = [];
      for (const id of chunk) {
        bulk.push({ index: { _id: id } });
        bulk.push(map[id]);
      }
      const res = await client.bulk({ index: indexName, body: bulk });
      macros.log(`indexed ${chunkNum * BULKSIZE + chunk.length} docs into ${indexName}`);
      return res;
    },
    { concurrency: 1 });
  }

  /**
   * Bulk update a collection of documents using ids fromhashmap
   * @param  {string} indexName The index to update into
   * @param  {Object} map       A map of document ids to document sources to update
   * TODO: does this need the Elastic serializer? why does this exist?
   */
  async bulkUpdateFromMap(indexName: string, map: EsBulkData): Promise<void> {
    // TODO not sure what the type is here
    const bulk = [];
    for (const id of Object.keys(map)) {
      bulk.push({ update: { _id: id } });
      bulk.push({ doc: map[id] });
    }
    await client.bulk({ index: indexName, body: bulk });
  }

  async query(index: string, from: number, size: number, body: EsQuery): Promise<EsResult> {
    return client.search({
      index: index, from: from, size: size, body: body,
    });
  }

  async mquery(index: string, queries: EsQuery[]): Promise<EsMultiResult> {
    const multiQuery = [];
    for (const query of queries) {
      multiQuery.push({ index });
      multiQuery.push(query);
    }
    return client.msearch({ body: multiQuery });
  }
}

const instance = new Elastic();
export default instance;
