/**
 * 批處理工具
 * 用於優化批量數據操作
 */
const mongoose = require('mongoose');
const { clearModelCache } = require('./cacheUtils');

/**
 * 批量處理數據的通用函數
 * @param {Array} items - 需要處理的數據列表
 * @param {Function} processorFn - 處理單個數據項的函數
 * @param {Object} options - 批處理選項
 * @param {number} options.batchSize - 每批處理的數據數量，默認 100
 * @param {number} options.delay - 批次間延遲（毫秒），默認 0
 * @param {boolean} options.parallel - 是否並行處理，默認 true
 * @param {Function} options.onProgress - 進度回調函數
 * @returns {Promise<Array>} - 處理結果數組
 */
const processBatch = async (
  items,
  processorFn,
  { batchSize = 100, delay = 0, parallel = true } = {}
) => {
  if (!items || !Array.isArray(items) || items.length === 0) {
    return [];
  }

  const results = [];
  // 將數據分割成批次
  const batches = [];

  for (let i = 0; i < items.length; i += batchSize) {
    batches.push(items.slice(i, i + batchSize));
  }

  if (parallel) {
    // 並行處理批次
    for (const batch of batches) {
      const batchPromises = batch.map((item) => processorFn(item));
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      if (delay > 0 && batches.indexOf(batch) < batches.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  } else {
    // 順序處理批次
    for (const batch of batches) {
      for (const item of batch) {
        const result = await processorFn(item);
        results.push(result);
      }

      if (delay > 0 && batches.indexOf(batch) < batches.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  return results;
};

/**
 * 批量插入數據
 * @param {mongoose.Model} model - Mongoose 模型
 * @param {Array} documents - 要插入的文檔數組
 * @param {Object} options - 批處理選項
 * @returns {Promise<Array>} - 插入的文檔數組
 */
const batchInsert = async (model, documents, options = {}) => {
  if (!documents || !Array.isArray(documents) || documents.length === 0) {
    return [];
  }

  try {
    return await processBatch(
      documents,
      async (doc) => {
        const newDoc = new model(doc);
        return await newDoc.save();
      },
      options
    );
  } catch (error) {
    console.error('Batch insert error:', error);
    throw error;
  }
};

/**
 * 批量更新數據
 * @param {mongoose.Model} model - Mongoose 模型
 * @param {Array} updates - 更新操作數組，每個元素包含 { filter, update }
 * @param {Object} options - 批處理選項
 * @returns {Promise<Array>} - 更新結果數組
 */
const batchUpdate = async (model, updates, options = {}) => {
  if (!updates || !Array.isArray(updates) || updates.length === 0) {
    return [];
  }

  try {
    return await processBatch(
      updates,
      async ({ filter, update }) => {
        return await model.findOneAndUpdate(filter, update, { new: true });
      },
      options
    );
  } catch (error) {
    console.error('Batch update error:', error);
    throw error;
  }
};

/**
 * 批量刪除數據
 * @param {mongoose.Model} model - Mongoose 模型
 * @param {Array} filters - 刪除條件數組
 * @param {Object} options - 批處理選項
 * @returns {Promise<Array>} - 刪除結果數組
 */
const batchDelete = async (model, filters, options = {}) => {
  if (!filters || !Array.isArray(filters) || filters.length === 0) {
    return [];
  }

  try {
    return await processBatch(
      filters,
      async (filter) => {
        return await model.findOneAndDelete(filter);
      },
      options
    );
  } catch (error) {
    console.error('Batch delete error:', error);
    throw error;
  }
};

/**
 * 優化批量插入 - 使用 insertMany 而不是單個插入
 * @param {mongoose.Model} model - Mongoose 模型
 * @param {Array} documents - 要插入的文檔數組
 * @param {Object} options - 批處理選項
 * @returns {Promise<Array>} - 插入的文檔數組
 */
const bulkInsert = async (model, documents, { batchSize = 500, ordered = false } = {}) => {
  if (!documents || !Array.isArray(documents) || documents.length === 0) {
    return [];
  }

  const results = [];
  // 將數據分割成批次
  const batches = [];

  for (let i = 0; i < documents.length; i += batchSize) {
    batches.push(documents.slice(i, i + batchSize));
  }

  try {
    for (const batch of batches) {
      // 使用 insertMany 批量插入，設置 ordered 選項
      const insertedDocs = await model.insertMany(batch, { ordered });
      results.push(...insertedDocs);
    }

    // 清除相關緩存
    await clearModelCache(model.modelName.toLowerCase());

    return results;
  } catch (error) {
    console.error('Bulk insert error:', error);
    throw error;
  }
};

/**
 * 批量更新 - 使用 bulkWrite 進行高效更新
 * @param {mongoose.Model} model - Mongoose 模型
 * @param {Array} updates - 更新操作數組，每個元素包含 { filter, update }
 * @param {Object} options - 批處理選項
 * @returns {Promise<Object>} - 更新結果
 */
const bulkUpdate = async (model, updates, { batchSize = 500, ordered = false } = {}) => {
  if (!updates || !Array.isArray(updates) || updates.length === 0) {
    return { modifiedCount: 0, matchedCount: 0 };
  }

  // 將更新操作轉換為 bulkWrite 格式
  const operations = updates.map(({ filter, update }) => ({
    updateOne: {
      filter,
      update,
      upsert: false,
    },
  }));

  // 將操作分割成批次
  const batches = [];
  for (let i = 0; i < operations.length; i += batchSize) {
    batches.push(operations.slice(i, i + batchSize));
  }

  try {
    const results = {
      modifiedCount: 0,
      matchedCount: 0,
    };

    for (const batch of batches) {
      const result = await model.bulkWrite(batch, { ordered });
      results.modifiedCount += result.modifiedCount || 0;
      results.matchedCount += result.matchedCount || 0;
    }

    // 清除相關緩存
    await clearModelCache(model.modelName.toLowerCase());

    return results;
  } catch (error) {
    console.error('Bulk update error:', error);
    throw error;
  }
};

/**
 * 批量刪除 - 使用 bulkWrite 進行高效刪除
 * @param {mongoose.Model} model - Mongoose 模型
 * @param {Array} filters - 刪除條件數組
 * @param {Object} options - 批處理選項
 * @returns {Promise<Object>} - 刪除結果
 */
const bulkDelete = async (model, filters, { batchSize = 500, ordered = false } = {}) => {
  if (!filters || !Array.isArray(filters) || filters.length === 0) {
    return { deletedCount: 0 };
  }

  // 將刪除操作轉換為 bulkWrite 格式
  const operations = filters.map((filter) => ({
    deleteOne: { filter },
  }));

  // 將操作分割成批次
  const batches = [];
  for (let i = 0; i < operations.length; i += batchSize) {
    batches.push(operations.slice(i, i + batchSize));
  }

  try {
    let deletedCount = 0;

    for (const batch of batches) {
      const result = await model.bulkWrite(batch, { ordered });
      deletedCount += result.deletedCount || 0;
    }

    // 清除相關緩存
    await clearModelCache(model.modelName.toLowerCase());

    return { deletedCount };
  } catch (error) {
    console.error('Bulk delete error:', error);
    throw error;
  }
};

module.exports = {
  processBatch,
  batchInsert,
  batchUpdate,
  batchDelete,
  bulkInsert,
  bulkUpdate,
  bulkDelete,
};
