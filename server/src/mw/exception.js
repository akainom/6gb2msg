class ApiError extends Error {
    /**
     * @param {string} message 
     * @param {number} status status code for response 
     * @param {string} code internal error identifier
     * @param {*?} val cause of error 
     */
    constructor(message, status, code, val = null) {
        super(message);
        this.status = status;
        this.code = code;
        this.val = val;
        Error.captureStackTrace(this, this.constructor);
    }

    /**
     * @param {string} message 
     * @param {string} code internal error identifier
     * @param {*?} val cause of error 
     */
    static BadRequest(message, code, val = null) {
        return new this(message, 400, code, val)
    }

    /**
     * @param {string} message 
     * @param {string} code internal error identifier
     * @param {*?} val cause of error 
     */
    static Forbidden(message, code, val = null) {
        return new this(message, 403, code, val)
    }

    /**
     * @param {string} message 
     * @param {string} code internal error identifier
     * @param {*?} val cause of error 
     */
    static NotFound(message, code, val = null) {
        return new this(message, 404, code, val)
    }
}

/**
/* @param {ApiError|Error} err
/*/
const ApiErrorMiddlewareFunction = function (err, req, res, next) {
    console.error(`[FATAL]: ${err.message}`);
    if (err instanceof ApiError) {
        return res.status(err.status).json({
            status: 'error',
            code: err.code,
            message: err.message,
            target: err.val
        })
    }

    return res.status(500).json({
        status: 'panic',
        code: 'ERR_INTERNAL'
    })
}

module.exports = { ApiError, ApiErrorMiddlewareFunction };