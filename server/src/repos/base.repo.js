class BaseRepository {
    constructor(model) {
        this.model = model;
    }

    async getById(id, session = null) {
        return this.model.findById(id).session(session).lean();
    }

    async create(data, session = null) {
        const [instance] = await this.model.create([data], { session });
        return instance.toObject(); 
    }

    async update(id, data, session = null) {
        return this.model.findByIdAndUpdate(id, data, { new: true, runValidators: true, session }).lean()
    }

    async getMany(filter = {}, opt = { limit: 20, skip: 0 }, session = null) {
        return this.model.find(filter)
        .limit(opt.limit)
        .skip(opt.skip)
        .sort({ createdAt: -1 })
        .session(session)
        .lean()
    }
}

module.exports = BaseRepository;