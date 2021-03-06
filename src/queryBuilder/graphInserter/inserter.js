import _ from 'lodash';
import Promise from 'bluebird';
import {isPostgres} from '../../utils/knexUtils';

const POSTGRES_INSERT_BATCH_SIZE = 100;

/**
 * @param {QueryBuilder} builder
 * @return {function(TableInsertion)}
 */
export default function (builder) {
  // Postgres is the only db engine that returns identifiers of all inserted rows. Therefore
  // we can insert batches only with postgres.
  const batchSize = isPostgres(builder.knex()) ? POSTGRES_INSERT_BATCH_SIZE : 1;

  return (tableInsertion) => {
    const inputs = [];
    const others = [];
    const queries = [];

    let insertQuery = tableInsertion.modelClass
      .query()
      .childQueryOf(builder);

    for (let i = 0, l = tableInsertion.models.length; i < l; ++i) {
      const model = tableInsertion.models[i];

      // We need to validate here since at this point the models should no longer contain any special properties.
      const json = model.$validate();

      // Set the return value back to model in case defaults were set.
      model.$set(json);

      if (tableInsertion.isInputModel[i]) {
        inputs.push(model);
      } else {
        others.push(model);
      }
    }

    batchInsert(inputs, insertQuery.clone().copyFrom(builder, /returning/), batchSize, queries);
    batchInsert(others, insertQuery.clone(), batchSize, queries);

    return Promise.all(queries);
  };
}

function batchInsert(models, queryBuilder, batchSize, queries) {
  const batches = _.chunk(models, batchSize);

  for (let i = 0, l = batches.length; i < l; ++i) {
    queries.push(queryBuilder.clone().insert(batches[i]));
  }
}

