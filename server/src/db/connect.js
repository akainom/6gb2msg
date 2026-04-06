const mongoose = require('mongoose');
const MONGO_CONNSTRING = process.env.MONGO_CONNSTRING;


async function connectDB() {
    await mongoose.connect(MONGO_CONNSTRING);
    console.log('DB connected');    
}

module.exports = connectDB;
