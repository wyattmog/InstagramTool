const express = require('express')
const multer = require('multer')
const jsdom = require('jsdom')
const fs = require('fs')
const { JSDOM } = jsdom;
const bcrypt = require('bcryptjs')
const dotenv = require('dotenv')
const jwt = require('jsonwebtoken')
const cookieParser = require('cookie-parser')
dotenv.config()
const mysql = require('mysql2')
const app = express()
const port = 8383


app.use(express.static('/Users/wyattmogelson/Coding/InstagramTool/Frontend'))
app.use(express.json())
app.use(cookieParser())

const storage = multer.diskStorage({
    destination: function(req, file, callback) {
        if (file.originalname == 'following.html') {
            callback(null, __dirname + "/uploads/following")
        }
        else if (file.originalname == 'followers_1.html') {
        callback(null, __dirname + "/uploads/followers")
        }
    },
    filename: function(req, file, callback) {
        callback(null, file.originalname ) 
    }
})
// Use enviornment variables because it prevents hard coding
// authentication, and allows user to change the value without
// coding it in javascript. Sensitive info like password also
// shouldn't be hardcoded.
const pool = mysql.createPool({
    host: process.env.DB1_HOST,
    user: process.env.DB1_USER,
    password: process.env.DB1_PASSWORD,
    database: process.env.DB1_DATABASE
}).promise()


const uploads = multer({storage: storage})
// This communicates from backend to front end
// Will use to display information after processing in sql
// app.get('/info/:dynamic', (req,res) => {
//     const { dynamic } = req.params
//     const { key } = req.query
//     console.log(dynamic, key)
//     res.status(200).json({info: 'preset text'})
// })

// Recieves post request from frontend
// Puts followers file in /followers directory
// Puts following file in /following directory
// Uses JSDOM to parse and query and get all hyperlink content
// For both following and follower links, puts
// both into respective arrays.
app.post('/uploads', authenticateToken, uploads.array("files"), async (req, res) => {
    await deleteColumns(req.user)
    await new Promise((resolve, reject) => {
        fs.readFile("/Users/wyattmogelson/Coding/InstagramTool/Backend/uploads/followers/followers_1.html", "utf-8", async (err, data) => {
            if (err) {
            //   console.error("Error reading the file:", err);
              return res.status(500).send('File parsing error');
            }
            const dom = new JSDOM(data);
            const links = dom.window.document.querySelectorAll("a");
            for (let i = 0; i < links.length; i++) {
                await insertFollowers(links[i].textContent, req.user)
            }
            resolve()
        })
    })
    await new Promise((resolve, reject) => {
        fs.readFile("/Users/wyattmogelson/Coding/InstagramTool/Backend/uploads/following/following.html", "utf-8", async (err, data) => {
            if (err) {
                // console.error("Error reading the file:", err);
                return res.status(500).send('File parsing error');
            }
            const dom = new JSDOM(data);
            const links = dom.window.document.querySelectorAll("a");
            for (let i = 0; i < links.length; i++) {
                await insertFollowing(links[i].textContent, req.user)
                // insertFollowing(links[i].textContent)
            }
            resolve()
        })
    })  
    const result = await parse(req.user)
    // const result = await parse()
    res.json(result) 
    // res.json({status: 'form data recieved' }) 
})
app.post('/logout', (req, res) => {
    res.clearCookie('auth_token'); // Clear the auth_token cookie
    res.json({ message: 'Logout successful' });
});
app.post('/register', uploads.none(), async (req, res) => {
    // console.log(req.body)
    try {
        const { username, password } = req.body;
        const result = await pool.query('SELECT username FROM users WHERE username = ?', [username])
        if (result[0].length > 0) {
            return res.status(400).send('Username already taken')
        }
        const hashedPassword = await bcrypt.hash(password, 10)
        // bcrypt.hash(password, 10, (err, hash) => {
        //     if (err) {
        //         return res.status(500).send('Error hashing password');
        //     }
        await pool.query('INSERT INTO users (username, password) VALUES (?, ?)', [username, hashedPassword])
        res.json('User registered successfully')
    }
    catch(err) {
        return res.status(500).send('Database error');
    }
})

app.post('/login', uploads.none(), async (req, res) => {
    try {
        const { username, password } = req.body;
        // Find the user by username
        const result = await pool.query('SELECT * FROM users WHERE username = ?', [username]);
        if (result[0].length === 0) {
            return res.status(400).send('User not found');
        }

        // Compare passwords
        const user = result[0];
        const isMatch = await bcrypt.compare(password, user[0].password);
        if (!isMatch) {
            console.log("wowo")
            return res.status(400).send('Invalid password')
        }
        const accessToken = jwt.sign(username, process.env.ACCESS_TOKEN_SECRET)
        res.cookie('auth_token', accessToken, {
            httpOnly: true,     // Prevents JavaScript from accessing the cookie (helps prevent XSS)     // Cookie is only sent over HTTPS (use `false` during local development)
            sameSite: 'Strict', // Prevents the cookie from being sent with cross-site requests (helps prevent CSRF)
            maxAge: 3600000     // Sets cookie expiration time (1 hour in this example)
        })
        console.log("wowow")
        res.json( {message: "login sucess"})
    } catch (err) {
        console.error('Error during login:', err); // Log the error for debugging
        return res.status(500).send('Database error');
    }
});
app.listen(port, () => console.log(`server has started on port: ${port}`))

function insertFollowing(name, user){
    return pool.query(`
    INSERT INTO following (user_id, following_id)
    VALUES (?, ?)
    `, [user, name])
}

function parse(userId){
    return pool.query(`SELECT following_id 
    FROM following
    WHERE user_id = ? AND following_id NOT IN (SELECT follower_id FROM followers WHERE user_id = ?);
    `, [userId, userId])
}

function authenticateToken(req, res, next) {
    const token = req.cookies.auth_token
    // const authHeader = req.headers['authorization']
    // const token = authHeader && authHeader.split(' ')[1]
    if (token == null) {
        return res.sendStatus(401)
    }
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, user) => {
        if (err) {
            return res.sendStatus(403)
        }
        req.user = user
        next()
    })
}
function deleteColumns(user) {
    return pool.query(`
        DELETE FROM following WHERE user_id = ?
    `, [user])
    .then(() => {
        return pool.query(`
            DELETE FROM followers WHERE user_id = ?
        `, [user]);
    });
}
function insertFollowers(name, user){
    return pool.query(`
    INSERT INTO followers (user_id, follower_id)
    VALUES (?, ?)
    `, [user, name])
}