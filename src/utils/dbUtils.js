/**
 * 數據庫查詢優化工具
 * 提供了優化的資料庫查詢函數
 */

const mongoose = require('mongoose');
const { withModelCache, clearEntityCache, clearModelCache } = require('./cacheUtils');

/**
 * 獲取單筆資料（帶緩存）
 *
 * @param {mongoose.Model} model - Mongoose模型
 * @param {string|Object} condition - ID或查詢條件
 * @param {Object} options - 查詢選項
 * @param {string} options.populate - 要填充的字段
 * @param {string} options.select - 要選擇的字段
 * @param {number} options.cacheExpiration - 緩存過期時間（秒）
 * @returns {Promise<Object>} - 查詢結果
 */
const findOne = async (model, condition, options = {}) => {
  const { populate = '', select = '', cacheExpiration = 3600, lean = true } = options;

  // 構建查詢條件
  const query =
    typeof condition === 'string' && mongoose.Types.ObjectId.isValid(condition)
      ? { _id: condition }
      : condition;

  // 緩存鍵
  const modelName = model.modelName.toLowerCase();
  const queryStr = JSON.stringify(query);
  const cacheKey = `${modelName}:one:${queryStr}:${populate}:${select}`;

  // 使用緩存包裝查詢
  return await withModelCache(
    modelName,
    query,
    async () => {
      let queryBuilder = model.findOne(query);

      if (populate) {
        queryBuilder = queryBuilder.populate(populate);
      }

      if (select) {
        queryBuilder = queryBuilder.select(select);
      }

      if (lean) {
        queryBuilder = queryBuilder.lean();
      }

      return await queryBuilder.exec();
    },
    cacheExpiration
  );
};

/**
 * 獲取多筆資料（帶緩存）
 *
 * @param {mongoose.Model} model - Mongoose模型
 * @param {Object} condition - 查詢條件
 * @param {Object} options - 查詢選項
 * @param {string} options.populate - 要填充的字段
 * @param {string} options.select - 要選擇的字段
 * @param {Object} options.sort - 排序選項
 * @param {number} options.limit - 限制結果數量
 * @param {number} options.skip - 跳過結果數量
 * @param {number} options.cacheExpiration - 緩存過期時間（秒）
 * @returns {Promise<Array>} - 查詢結果
 */
const find = async (model, condition = {}, options = {}) => {
  const {
    populate = '',
    select = '',
    sort = { createdAt: -1 },
    limit = 0,
    skip = 0,
    cacheExpiration = 3600,
    lean = true,
  } = options;

  // 緩存鍵
  const modelName = model.modelName.toLowerCase();
  const queryStr = JSON.stringify(condition);
  const optionsStr = JSON.stringify({ populate, select, sort, limit, skip });
  const cacheKey = `${modelName}:many:${queryStr}:${optionsStr}`;

  // 使用緩存包裝查詢
  return await withModelCache(
    modelName,
    { ...condition, _options: options },
    async () => {
      let queryBuilder = model.find(condition);

      if (populate) {
        queryBuilder = queryBuilder.populate(populate);
      }

      if (select) {
        queryBuilder = queryBuilder.select(select);
      }

      if (sort) {
        queryBuilder = queryBuilder.sort(sort);
      }

      if (skip > 0) {
        queryBuilder = queryBuilder.skip(skip);
      }

      if (limit > 0) {
        queryBuilder = queryBuilder.limit(limit);
      }

      if (lean) {
        queryBuilder = queryBuilder.lean();
      }

      return await queryBuilder.exec();
    },
    cacheExpiration
  );
};

/**
 * 分頁查詢（帶緩存）
 *
 * @param {mongoose.Model} model - Mongoose模型
 * @param {Object} condition - 查詢條件
 * @param {Object} options - 查詢選項
 * @param {number} options.page - 頁碼（從1開始）
 * @param {number} options.limit - 每頁數量
 * @param {string} options.populate - 要填充的字段
 * @param {string} options.select - 要選擇的字段
 * @param {Object} options.sort - 排序選項
 * @param {number} options.cacheExpiration - 緩存過期時間（秒）
 * @returns {Promise<Object>} - 分頁結果
 */
const paginate = async (model, condition = {}, options = {}) => {
  const {
    page = 1,
    limit = 10,
    populate = '',
    select = '',
    sort = { createdAt: -1 },
    cacheExpiration = 3600,
    lean = true,
  } = options;

  const skip = (page - 1) * limit;

  // 緩存鍵
  const modelName = model.modelName.toLowerCase();
  const queryStr = JSON.stringify(condition);
  const optionsStr = JSON.stringify({ page, limit, populate, select, sort });
  const cacheKey = `${modelName}:page:${queryStr}:${optionsStr}`;

  // 使用緩存包裝查詢
  return await withModelCache(
    modelName,
    { ...condition, _page: page, _limit: limit },
    async () => {
      // 執行查詢並獲取總數
      const [total, data] = await Promise.all([
        model.countDocuments(condition),
        find(model, condition, { populate, select, sort, limit, skip, lean }),
      ]);

      // 計算分頁信息
      const totalPages = Math.ceil(total / limit);

      return {
        data,
        pagination: {
          total,
          page,
          limit,
          totalPages,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
      };
    },
    cacheExpiration
  );
};

/**
 * 創建資料並清除相關緩存
 *
 * @param {mongoose.Model} model - Mongoose模型
 * @param {Object} data - 要創建的數據
 * @returns {Promise<Object>} - 創建的數據
 */
const create = async (model, data) => {
  const result = await model.create(data);
  const modelName = model.modelName.toLowerCase();

  // 清除該模型的列表緩存
  await clearModelCache(modelName);

  return result;
};

/**
 * 更新資料並清除相關緩存
 *
 * @param {mongoose.Model} model - Mongoose模型
 * @param {string|Object} condition - ID或查詢條件
 * @param {Object} data - 要更新的數據
 * @param {Object} options - 更新選項
 * @returns {Promise<Object>} - 更新後的數據
 */
const update = async (model, condition, data, options = { new: true }) => {
  // 構建查詢條件
  const query =
    typeof condition === 'string' && mongoose.Types.ObjectId.isValid(condition)
      ? { _id: condition }
      : condition;

  const result = await model.findOneAndUpdate(query, data, options);

  if (result) {
    const modelName = model.modelName.toLowerCase();
    // 清除特定實體緩存
    if (result._id) {
      await clearEntityCache(modelName, result._id.toString());
    }
    // 清除該模型的列表緩存
    await clearModelCache(modelName);
  }

  return result;
};

/**
 * 刪除資料並清除相關緩存
 *
 * @param {mongoose.Model} model - Mongoose模型
 * @param {string|Object} condition - ID或查詢條件
 * @returns {Promise<Object>} - 刪除的數據
 */
const remove = async (model, condition) => {
  // 構建查詢條件
  const query =
    typeof condition === 'string' && mongoose.Types.ObjectId.isValid(condition)
      ? { _id: condition }
      : condition;

  const result = await model.findOneAndDelete(query);

  if (result) {
    const modelName = model.modelName.toLowerCase();
    // 清除特定實體緩存
    if (result._id) {
      await clearEntityCache(modelName, result._id.toString());
    }
    // 清除該模型的列表緩存
    await clearModelCache(modelName);
  }

  return result;
};

/**
 * 聚合查詢（帶緩存）
 *
 * @param {mongoose.Model} model - Mongoose模型
 * @param {Array} pipeline - 聚合管道
 * @param {Object} options - 查詢選項
 * @param {number} options.cacheExpiration - 緩存過期時間（秒）
 * @returns {Promise<Array>} - 聚合結果
 */
const aggregate = async (model, pipeline, options = {}) => {
  const { cacheExpiration = 3600 } = options;

  // 緩存鍵
  const modelName = model.modelName.toLowerCase();
  const pipelineStr = JSON.stringify(pipeline);
  const cacheKey = `${modelName}:agg:${pipelineStr}`;

  // 使用緩存包裝查詢
  return await withModelCache(
    modelName,
    { _pipeline: pipeline },
    async () => {
      // 添加優化選項
      const aggOptions = { allowDiskUse: true, maxTimeMS: 60000 };
      return await model.aggregate(pipeline).option(aggOptions).exec();
    },
    cacheExpiration
  );
};

module.exports = {
  findOne,
  find,
  paginate,
  create,
  update,
  remove,
  aggregate,
};
