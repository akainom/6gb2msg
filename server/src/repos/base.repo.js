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
     * @param {mongoose.ClientSession} [session=null]
     * @returns {Promise<Object|null>} plain object if found
     */
    async getById(id, session = null) {
        return this.model.findById(id).session(session).lean();
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
}

module.exports = BaseRepository;