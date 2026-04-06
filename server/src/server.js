const dotenv = require('dotenv');
dotenv.config({
    path: __dirname + '/tests/server.test.env'
})

const app = require('./app');
const connectDB = require('./db/connect');

const PORT = process.env.PORT || 3000;

(async () => {
    try {
        await connectDB();
        app.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
        });
    } catch (e) {
        console.error(`Startup failed: ${e.message}`);
        process.exit(1);
    }
})();