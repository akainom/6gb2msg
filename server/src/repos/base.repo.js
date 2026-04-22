const mongoose = require('mongoose');
const { ApiError } = require('../mw/exception');

class BaseRepository {
    /**
     * @param {mongoose.Model} model - Mongoose model instance
     */
    constructor(model) {
        this.model = model;
    }

    /**
     * @description fetches a single document by its unique ID
     * @param {mongoose.ObjectId|string} id
     * @param {mongoose.ClientSession} session
     * @param {string} additionalFieldsQuery fields that would be passed to .select() method
     * @returns {Promise<Object|null>} plain object if found
     */
    async getById(id, session = null, additionalFieldsQuery = '') {
        let q = this.model.findById(id).session(session);
        if (additionalFieldsQuery != '') {
            q.select(additionalFieldsQuery);
        }

        return await q.lean();
    }

    /**
     * @description performs transactional creation of a single document
     * @param {Object} data - fields to be saved
     * @param {mongoose.ClientSession} [session=null]
     * @returns {Promise<Object>} plain object of the created instance
     */
    async create(data, session = null) {
        const [instance] = await this.model.create([data], { session });
        // Using toObject() as create returns a document even with session
        return instance.toObject(); 
    }

    /**
     * @description updates an existing document with validation
     * @param {mongoose.ObjectId|string} id 
     * @param {Object} data - fields to update
     * @param {mongoose.ClientSession} [session=null]
     * @returns {Promise<Object|null>} updated plain object
     */
    async update(id, data, session = null) {
        return this.model.findByIdAndUpdate(id, data, { 
            new: true, 
            runValidators: true, 
            session 
        }).lean();
    }

    /**
     * @description retrieves a paginated list of documents based on a filter
     * @param {Object} [filter={}] - Mongoose query filter
     * @param {Object} [opt={ limit: 20, skip: 0 }] - pagination options
     * @param {number} opt.limit
     * @param {number} opt.skip
     * @param {mongoose.ClientSession} [session=null]
     * @returns {Promise<Array<Object>>} array of plain objects sorted by createdAt desc
     */
    async getMany(filter = {}, opt = { limit: 20, skip: 0 }, session = null) {
        return this.model.find(filter)
            .limit(opt.limit)
            .skip(opt.skip)
            .sort({ createdAt: -1 })
            .session(session)
            .lean();
    }

    /**
     * @description safely calls func with transaction
     * @param {(self: BaseRepository, bag?, session: mongoose.ClientSession) } func
     * @param {*} bag stores internal scheiße used in func 
     * @param {{message: String, code: String, val?}} catchClause 
     * @returns success func call result
     */
    async transactCall(func, bag = null, catchClause) {
        const session = await mongoose.startSession();

        try {
            await session.startTransaction();

            const result = await func(this, bag, session);
            
            await session.commitTransaction();
            return result;
        } catch (e){
            await session.abortTransaction();
            if (e instanceof ApiError) throw e;
            throw ApiError.BadRequest(...catchClause);
        }
        finally {
            await session.endSession();
        }
    }
}

module.exports = BaseRepository;