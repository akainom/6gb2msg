const mongoose = require('mongoose');

async function connectDB() {
    await mongoose.connect('mongodb://192.168.100.8:2000/6gb2msg?directConnection=true&replicaSet=rs0');
    console.log('DB connected');    
    
    const admin = mongoose.connection.db.admin();
    await admin.command({ 
      setParameter: 1, 
      transactionLifetimeLimitSeconds: 5 
    })
}

module.exports = connectDB;
