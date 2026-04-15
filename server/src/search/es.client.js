const { Client } = require('@elastic/elasticsearch');

const ELASTIC_URL = process.env.ELASTIC_URL;
const ELASTIC_USERNAME = process.env.ELASTIC_USERNAME;
const ELASTIC_PASSWORD = process.env.ELASTIC_PASSWORD;
const opts = {
    node: ELASTIC_URL,
    auth: {
        username: ELASTIC_USERNAME,
        password: ELASTIC_PASSWORD,
    },
    tls: {
        rejectUnauthorized: false,
    },
};

const es = new Client(opts);

module.exports = es;