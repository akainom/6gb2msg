const dotenv = require('dotenv');
dotenv.config({
    path: __dirname + '/.env'
})

const app = require('./app');
const connectDB = require('./db/connect');
const initSocket = require('./ws/socket');
const stats = require('./services/stats.service');

const PORT = process.env.PORT || 3000;

(async () => {
    try {
        await connectDB();
        stats.startJob(15 * 60 * 1000);

        const server = app.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
        });
        initSocket(server, app);
    } catch (e) {
        console.error(`Startup failed: ${e.message}`);
        process.exit(1);
    }
})();
