const express = require('express')
const multer = require('multer')
const jsdom = require('jsdom')
const yauzl = require('yauzl');
const { JSDOM } = jsdom;
const https = require('https')
const fs = require('fs')
const bcrypt = require('bcryptjs')
const dotenv = require('dotenv')
const jwt = require('jsonwebtoken')
const cors = require('cors')
const cookieParser = require('cookie-parser')
const result = dotenv.config({
    path: `.env.${process.env.NODE_ENV || 'development'}`
});
if (result.error) {
    throw result.error;
}
const isProduction = process.env.NODE_ENV === 'production';

const logoutCookieOptions = isProduction ? {
    httpOnly: true,        // Ensures the cookie is not accessible via JavaScript
    secure: isProduction,          // Ensures the cookie is only sent over HTTPS
    sameSite: 'None',      // Ensures the cookie is sent with cross-site requests
    domain: '.instagram-tool.duckdns.org',  // Make sure the domain has a dot in front
    path: '/',             // Ensure this matches the path where the cookie was set
} : { 
    httpOnly: true,
    sameSite: 'Strict',
    secure: isProduction, // Set secure cookies only in production
}

const allowedOrigins = isProduction ? 
    'https://instagram-tool.duckdns.org' : 
    'http://localhost';


const mysql = require('mysql2')
const app = express()
const port = 8383
app.use(express.static(process.env.ROUTE))
app.use(express.json())
app.use(cookieParser())
app.use(cors({
    origin: allowedOrigins, // Adjust as needed
    credentials: true
}))
const storage = multer.memoryStorage({
    storage: multer.memoryStorage() ,
    limits: { fileSize: 10 * 1024 * 1024 }
})
// Use enviornment variables because it prevents hard coding
// authentication, and allows user to change the value without
// coding it in javascript.

const pool = mysql.createPool({
    host: process.env.DB1_HOST,
    user: process.env.DB1_USER,
    password: process.env.DB1_PASSWORD,
    database: process.env.DB1_DATABASE
    
}).promise()

const uploads = multer({storage: storage})
// Get request that first authenticates user, then parses and sends the request information to client browser.
app.get('/data', authenticateToken, async (req,res) => {
    const result = await parse(req.user)
    if (result[0].length === 0) {
        return res.status(400).send('Records not found');
    }
    else {
        res.json(result)
    }
})
// Error handler for multer in order to catch and send information back to client browser
app.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        // A Multer error occurred when uploading.
        return res.status(400).send('An error occurred during the file upload.');
    } else if (err) {
        // An unknown error occurred when uploading.
        return res.status(400).send('An error occurred during the request.');
    }
    next();
});

// Extracts html files from the zip file
// Puts target files in array to return
async function extractHtml(zipBuffer, targetFiles) {
    return new Promise((resolve, reject) => {
    const extractedFiles = [];
    yauzl.fromBuffer(zipBuffer, { lazyEntries: true }, (err, zipfile) => {
        if (err) return reject(err);
        zipfile.readEntry();
        zipfile.on("entry", (entry) => {
            if (targetFiles.includes(entry.fileName)) {
                // Read the entry into memory
                zipfile.openReadStream(entry, (err, readStream) => {
                    if (err) return reject(err);
                    
                    let buffers = [];
                    readStream.on('data', (chunk) => {
                        buffers.push(chunk); // Collect chunks of data
                    });
                    readStream.on('end', () => {
                        const htmlBuffer = Buffer.concat(buffers); // Concatenate the collected buffers
                        extractedFiles.push({
                            originalname: entry.fileName,
                            buffer: htmlBuffer // Store the HTML file contents in memory
                        });
                        zipfile.readEntry(); // Read the next entry
                    });
                });
          } else {
            zipfile.readEntry();
          }
        });
        zipfile.on('end', () => {
            resolve(extractedFiles); // Resolve the promise with the collected HTML files
          });
      });
    })
}
// Recieves post request from frontend
// Puts followers file in /followers directory
// Puts following file in /following directory
// Uses JSDOM to parse and query and get all hyperlink content
// For both following and follower links, puts
// both into respective arrays.
app.post('/uploads', authenticateToken, uploads.single('zipfile'), async (req, res) => {
    const zipBuffer = req.file.buffer;
    const targetFiles = ['connections/followers_and_following/followers_1.html', 'connections/followers_and_following/following.html'];
    try {
        const htmlFiles = await extractHtml(zipBuffer, targetFiles);
        // Checks if needed files were found in zip file
        const followersFile = htmlFiles.find(file => (file.originalname === 'connections/followers_and_following/followers_1.html'));
        const followingFile = htmlFiles.find(file => (file.originalname === 'connections/followers_and_following/following.html'));
        if (!followersFile || !followingFile) {
            return res.status(500).send('Required files are missing.');
        }
        await deleteColumns(req.user)
        // Promise that is used to inject user information information into sql database
        await new Promise( async (resolve, reject) => {
            try {
                const data = followersFile.buffer.toString("utf-8")
                const dom = new JSDOM(data);
                const links = dom.window.document.querySelectorAll("a");
                for (let i = 0; i < links.length; i++) {
                    await insertFollowers(links[i].textContent,links[i].href, req.user)
                }
                resolve()
            }
            catch (err) {
                reject(err)
            }
        })
        // Promise that is used to inject user information information into sql database
        await new Promise( async (resolve, reject) => {
            try {
                const data = followingFile.buffer.toString("utf-8")
                const dom = new JSDOM(data);
                const links = dom.window.document.querySelectorAll("a");
                for (let i = 0; i < links.length; i++) {
                    await insertFollowing(links[i].textContent, links[i].href, req.user)
                }
                resolve()
            }
            catch (err) {
                reject(err)
            }
        })
        const result = await parse(req.user)
        res.json(result) 
    }
    // Various error handling
    catch(err) {
        return res.status(500).send('Upload error');
    }}, (err, req, res, next) => {
        if (err instanceof multer.MulterError) {
            // A Multer error occurred when uploading.
            return res.status(500).send('An error occurred during the file upload.');
        } else if (err) {
            // An unknown error occurred when uploading.
            return res.status(500).send('An error occurred during the request.'); 
        } else {
          // Handle other errors
          return res.status(500).json({ error: 'Internal server error' });
        }
    }
)
// Handles user logout
app.post('/logout', (req, res) => {
    res.clearCookie('auth_token', logoutCookieOptions);
    res.json({ message: 'Logout successful' });
});
// Handles user registration
// Stores information in database table for easy and secure lookup
app.post('/register', uploads.none(), async (req, res) => {
    try {
        const { username, password } = req.body;
        const result = await pool.query('SELECT username FROM users WHERE username = ?', [username])
        if (result[0].length > 0) {
            return res.status(400).send('Username already taken')
        }
        // Use bcrypt in order to store hashed version of password for increased security
        const hashedPassword = await bcrypt.hash(password, 10)
        await pool.query('INSERT INTO users (username, password) VALUES (?, ?)', [username, hashedPassword])
        res.json('User registered successfully')
    }
    catch(err) {
        return res.status(500).send('Database error');
    }
})
// Checks if user is authenticated
app.get('/protected', authenticateToken, (req, res) => {
    res.sendStatus(200);
});
app.post('/login', uploads.none(), async (req, res) => {
    try {
        const username = req.body.username;
        const password = req.body.password; 
        const remember = req.body.remember;     
        // Find the user by username
        const result = await pool.query('SELECT * FROM users WHERE username = ?', [username]);
        if (result[0].length === 0) {
            return res.status(400).send('User not found');
        }
        // Compare passwords
        const user = result[0];
        const isMatch = await bcrypt.compare(password, user[0].password);
        if (!isMatch) {
            return res.status(400).send('Invalid password')
        }
        const accessToken = jwt.sign(username, process.env.ACCESS_TOKEN_SECRET)
        // Sets expiration to 1 week and one hour respectively
        const maxAges = String(remember) == "true" ? 604800000 : 3600000;
        res.cookie('auth_token', accessToken, isProduction ? {
            httpOnly: true,
            sameSite: 'None',
            maxAge: maxAges, // Example maxAge
            domain: 'instagram-tool.duckdns.org',
            secure: isProduction, // Set secure cookies only in production
        } :  {
            httpOnly: true,
            sameSite: 'Strict',
            maxAge: maxAges, // Example maxAge
            secure: isProduction, // Set secure cookies only in production
        });
        res.json( {message: "login success"})
    } catch (err) {
        return res.status(500).send('Database error');
    }
});
// Inserts user information into database
function insertFollowing(name, user, link){
    return pool.query(`
    INSERT INTO following (user_id, following_link, following_id)
    VALUES (?, ?, ?)
    `, [link, user, name])
}
// Parses user information from database and stores in dictionary to be returned to client browser
function parse(userId){
    return pool.query(`SELECT following_id, following_link
    FROM following
    WHERE user_id = ? AND following_id NOT IN (SELECT follower_id FROM followers WHERE user_id = ?);
    `, [userId, userId])
}
// Authentices user information 
function authenticateToken(req, res, next) {
    const token = req.cookies.auth_token
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
// Deletes user information upon new upload in order to save space 
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
// Inserts user information into database
function insertFollowers(name, link, user){
    return pool.query(`
    INSERT INTO followers (user_id, follower_link, follower_id)
    VALUES (?, ?, ?)
    `, [user, link, name])
}

if (isProduction) {
    const options = {
      key: fs.readFileSync('/etc/letsencrypt/live/instagram-tool.duckdns.org/privkey.pem'),
      cert: fs.readFileSync('/etc/letsencrypt/live/instagram-tool.duckdns.org/fullchain.pem')
    };
  
    https.createServer(options, app).listen(port, '0.0.0.0', () => {
      console.log('Server is running on https://instagram-tool.duckdns.org:8383');
    });
} else {
    app.listen(port, 'localhost', () => {
      console.log('Server is running on http://localhost:8383');
    });
}
