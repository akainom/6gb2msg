const crypto = require('crypto');
const bcrypt = require('bcryptjs');

class Encryptor {
    /**
     * @description returns a SHA-256 hash instance
     * @returns {crypto.Hash}
     */
    static getHash() {
        return crypto.createHash('sha256');
    }

    /**
     * @description hashes a value using SHA-256
     * @param {string} value
     * @returns {string} hex digest
     */
    static hash(value) {
        return this.getHash().update(value).digest('hex');
    }

    /**
     * @description encrypts sensitive DTO fields before storage
     * @param {regDTO} dto 
     * @returns {Promise<Object>} DTO with hashed password
     */
    static hashEmail(email) {
        return this.hash(email.toLowerCase().trim());
    }

    /**
     * @description encrypts sensitive DTO fields (password + email hash) before storage
     * @param {Object} dto
     * @returns {Promise<Object>} DTO with hashed password and email
     */
    static async encryptDTODefault(dto) {
        return {
            ...dto,
            password: dto.password ? await bcrypt.hash(dto.password, 10) : null,
            emailHash: Encryptor.hashEmail(dto.email)
        }
    }

    /**
     * @description compares a plain password against a bcrypt hash
     * @param {string} password
     * @param {string} hash
     * @returns {Promise<boolean>}
     */
    static async comparePasswords(password, hash) {
        return await bcrypt.compare(password, hash);
    }

    /**
     * @description hashes a plain password with bcrypt
     * @param {string} password
     * @returns {Promise<string>} bcrypt hash
     */
    static async hashPassword(password) {
        return await bcrypt.hash(password, 10);
    }

    /**
     * @description generates a random fingerprint and its claim hash
     * @returns {{ fprint: string, claim: string }}
     */
    static getFprint() {
        const bytes = this.getRandomBytes(32);
        const fprint = this.hash(bytes);
        const claim = this.hash(fprint);
        
        return {fprint, claim};
    }

    /**
     * @description verifies a fingerprint against its claim hash
     * @param {string} fprint
     * @param {string} claim
     * @returns {boolean}
     */
    static compareFprint(fprint, claim) {
        return this.hash(fprint) === claim;
    }

    /**
     * @description generates a random numeric string
     * @returns {string}
     */
    static genRandomizedString() {
        return `${Math.ceil(Math.random() * 10**9)}`;
    }
    
    /**
     * @description generates cryptographically secure random bytes
     * @param {number} size
     * @returns {string} hex-encoded random bytes
     */
    static getRandomBytes(size) {
        return crypto.randomBytes(size).toString('hex');
    }
}

module.exports = Encryptor;
