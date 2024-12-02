const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');
const { spawn } = require('child_process'); // Required to spawn a Python process
const bodyParser = require('body-parser');
const mysql = require('mysql2');
const app = express();
const PORT = 5000;
const LOCAL_IP = '192.168.5.217'

// Allow requests from your frontend's local IP
const allowedOrigins = ['http://localhost:3000', 'http://192.168.5.217:3000'] //'0.0.0.0']; // Replace with your actual IP and port

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  }
}));
app.use(bodyParser.json());

// Configure MySQL connection
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'password', // Replace with your MySQL root password
  database: 'test-streaming'
});

// Connect to the database
db.connect(err => {
  if (err) {
      console.error('Database connection failed:', err.stack);
      return;
  }
  console.log('Connected to MySQL database.');
});

// Directory for HLS output
const HLS_BASE_DIR = path.join(__dirname, 'stream');

// Ensure the base directory exists
if (!fs.existsSync(HLS_BASE_DIR)) {
  fs.mkdirSync(HLS_BASE_DIR, { recursive: true });
}

// Function to convert a file to HLS segments
function convertToHLS(inputFile, outputDir) {
  console.log(inputFile.replace(".wav", "").replace("audio\\", ""))
  let fileBase = inputFile.replace(".wav", "").replace("audio\\", "")
  console.log(`Attempting to convert file ${fileBase}`)
  return new Promise((resolve, reject) => {
    const outputFile = path.join(outputDir, `${fileBase}-playlist.m3u8`);
    const segmentPattern = path.join(outputDir, `${fileBase}-segment%d.ts`);

    ffmpeg(inputFile)
      .outputOptions([
        '-codec:a aac',
        '-strict -2',
        '-f hls',
        '-hls_time 10',
        '-hls_list_size 0',
        `-hls_segment_filename ${segmentPattern}`,
      ])
      .output(outputFile)
      .on('end', () => {
        console.log(`HLS conversion complete: ${outputFile}`);
        resolve(outputFile);
      })
      .on('error', (err) => {
        console.error('Error during HLS conversion:', err);
        reject(err);
      })
      .run();
  });
}
// Serve HLS segments
app.use('/audio', express.static(HLS_BASE_DIR));

// Route to handle audio streaming by file ID
app.get('/audio/:fileId', async (req, res) => {
  console.log('audio/fileID HIT')
  const { fileId } = req.params;
  const inputFile = path.join("audio", `${fileId}.wav`);  // Dynamically resolve the MP3 file
  const outputDir = HLS_BASE_DIR
  const converted = path.join("stream", `${fileId}-playlist.m3u8`);  // Dynamically resolve the MP3 file
  console.log(`converted: ${converted}`)
  if (!fs.existsSync(converted)) {
    try {
      console.log(`Converting ${fileId} to HLS...`);
      await convertToHLS(inputFile, outputDir);
    } catch (err) {
      return res.status(500).send('Error during HLS conversion');
    }
    // Serve the playlist.m3u8 file
    res.sendFile(path.join(outputDir, `${fileId}-playlist.m3u8`));
  }
  else {
    // Serve the playlist.m3u8 file
    res.sendFile(path.join(outputDir, `${fileId}-playlist.m3u8`));
  }
});


// Root endpoint
app.get('/', (req, res) => {
  res.send('HLS streaming server is running!');
});

// Function to get all filenames in a directory
function getFilenamesInDirectory(directoryPath) {
    // Use fs.readdirSync to read the directory contents synchronously
    try {
      const files = fs.readdirSync(directoryPath);
      
      // Filter to get only the filenames (not directories)
      const filenames = files.filter(file => fs.statSync(path.join(directoryPath, file)).isFile())
                            .map(file => path.basename(file, path.extname(file)).replaceAll('_', ' ')); // Remove file extension
      return filenames;
    } catch (err) {
      console.error('Error reading directory:', err);
      return [];
    }
  }
// Root endpoint
// Endpoint to get tracks from the database
app.get('/tracks', (req, res) => {
  const sql = `
      SELECT path, title, artist, insert_dt, release_dt, update_dt 
      FROM resources
      ORDER BY title DESC
  `;

  db.query(sql, (err, results) => {
      if (err) {
          console.error('Error fetching tracks:', err);
          return res.status(500).json({ error: 'Failed to fetch tracks.' });
      }

      if (results.length === 0) {
          return res.status(404).json({ message: 'No tracks found.' });
      }

      res.status(200).json({ tracks: results });
  });
});

// Endpoint to get similiar tracks from the database
app.get('/similiar_tracks/:fileId', (req, res) => {
  const { fileId } = req.params;
  const filePath = `${fileId}.wav`
  const sql = `
    with cte as (
    select resource_path, tag
      from tags
      where resource_path = '${filePath}'
    ),
    all_tags as (
      select resource_path rp, tag t
        from tags
    )
    select distinct path, title, artist, insert_dt, release_dt, update_dt 
    from cte 
    left join all_tags on (cte.tag = all_tags.t) 
    left join resources r on (all_tags.rp = r.path)
    where path != '${filePath}'`;

  db.query(sql, (err, results) => {
      if (err) {
          console.error('Error fetching tracks:', err);
          return res.status(500).json({ error: 'Failed to fetch tracks.' });
      }

      res.status(200).json({ tracks: results });
  });
});


// Fetch tracks for a given user
app.get('/collections/:userId', (req, res) => {
  const { userId } = req.params;

  // Validate the user ID
  if (!userId) {
      return res.status(400).json({ message: 'User ID is required.' });
  }

  // Query to fetch tracks for the user
  const query = `
      SELECT title, artist, insert_dt, name
      FROM collections
      WHERE user_id = ?
      ORDER BY name, insert_dt DESC
  `;

  db.query(query, [userId], (err, results) => {
      if (err) {
          console.error('Error executing query:', err.stack);
          return res.status(500).json({ message: 'Internal server error.' });
      }

      // Respond with the tracks
      res.json({
          message: 'Tracks fetched successfully.',
          tracks: results
      });
  });
});

// New endpoint that spawns the Python process
app.post('/process-url', (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).send({ error: 'URL is required' });
  }

  // Spawn the Python process and pass the URL as an argument
  const pythonProcess = spawn('.venv\\Scripts\\python.exe', [path.join(__dirname, 'main.py'), url]);

  pythonProcess.stderr.on('data', (data) => {
    console.error(`Python Error: ${data.toString()}`);
  });

  pythonProcess.on('close', (code) => {
    if (code === 0) {
      res.status(200).send({ message: 'URL processed successfully' });
    } else {
      res.status(500).send({ error: `Python script exited with code ${code}` });
    }
  });
});

// Login endpoint
app.post('/login', (req, res) => {
  const { username, password } = req.body;

  // Validate request body
  if (!username || !password) {
      return res.status(400).json({ message: 'Username and password are required.' });
  }

  // Query the database for the user
  const query = 'SELECT * FROM users WHERE username = ? AND password = ?';
  db.query(query, [username, password], (err, results) => {
      if (err) {
          console.error('Error executing query:', err.stack);
          return res.status(500).json({ message: 'Internal server error.' });
      }

      if (results.length > 0) {
          // User found
          res.json({
              message: 'Login successful',
              user: {
                  id: results[0].id,
                  username: results[0].username
              }
          });
      } else {
          // User not found
          res.status(401).json({ message: 'Invalid username or password.' });
      }
  });
});
// Create user endpoint
app.post('/create-user', (req, res) => {
  const { username, password } = req.body;

  // Validate request body
  if (!username || !password) {
      return res.status(400).json({ message: 'Username and password are required.' });
  }

  // Insert the user into the database
  const query = 'INSERT INTO users (username, password) VALUES (?, ?)';
  db.query(query, [username, password], (err, results) => {
      if (err) {
          if (err.code === 'ER_DUP_ENTRY') {
              // Handle duplicate username error
              return res.status(409).json({ message: 'Username already exists.' });
          }
          console.error('Error executing query:', err.stack);
          return res.status(500).json({ message: 'Internal server error.' });
      }

      // Respond with the newly created user ID
      res.status(201).json({
          message: 'User created successfully.',
          user: {
              id: results.insertId,
              username
          }
      });
  });
});

// Endpoint to add a song to a collection
app.post('/collections/add', (req, res) => {
  const { user_id, title, artist, name } = req.body;
  // Validate input
  if (!user_id || !title || !artist || !name) {
      return res.status(400).json({ error: 'All fields (user_id, title, artist, name) are required.' });
  }

  const insert_dt = new Date().toISOString().slice(0, 19).replace('T', ' '); // Format for MySQL DATETIME

  const sql = `
      INSERT INTO collections (user_id, title, artist, insert_dt, name)
      VALUES (?, ?, ?, ?, ?)
  `;

  db.query(sql, [user_id, title, artist, insert_dt, name], (err, result) => {
      if (err) {
          console.error('Error inserting song into collection:', err);
          return res.status(500).json({ error: 'Failed to add the song to the collection.' });
      }

      res.status(201).json({
          message: 'Song added to the collection successfully.',
          song: { user_id, title, artist, name, insert_dt },
      });
  });
});

// Start the server
app.listen(PORT, LOCAL_IP, () => {
  console.log(`Server is running at http://${LOCAL_IP}:${PORT}`);
});
