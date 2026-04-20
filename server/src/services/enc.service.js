const crypto = require('crypto');
const bcrypt = require('bcryptjs');

class Encryptor {
    static getHash() {
        return crypto.createHash('sha256');
    }

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

    static async encryptDTODefault(dto) {
        return {
            ...dto,
            password: dto.password ? await bcrypt.hash(dto.password, 10) : null,
            emailHash: Encryptor.hashEmail(dto.email)
        }
    }

    static async comparePasswords(password, hash) {
        return await bcrypt.compare(password, hash);
    }

    static getFprint() {
        const bytes = this.getRandomBytes(32);
        const fprint = this.hash(bytes);
        const claim = this.hash(fprint);
        
        return {fprint, claim};
    }

    static compareFprint(fprint, claim) {
        return this.hash(fprint) === claim;
    }

    static genRandomizedString() {
        return `${Math.ceil(Math.random() * 10**9)}`;
    }
    
    static getRandomBytes(size) {
        return crypto.randomBytes(size).toString('hex');
    }
}

module.exports = Encryptor;
