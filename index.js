const express = require('express');
const cors = require('cors');
const AuthRoutes = require('./Routers/Auth');
const ConnectDB = require('./DB/connect');
const cookieParser = require('cookie-parser');
require('dotenv').config();
const app = express();
const PORT = 5500 || process.env.PORT;
const rateLimit = require('express-rate-limit');
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());



app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
    rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 100
    })
);


app.use('/auth', AuthRoutes);
app.use('/backup', require('./Routers/backup'));




ConnectDB(process.env.MONGO_URL);


app.get('/', (req, res) => {
    res.send('Hello from Express server!');
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});