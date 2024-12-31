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
const PROD_IP = 'ec2-3-128-188-22.us-east-2.compute.amazonaws.com'

// services
const collectionService = require('./services/collectionServices');

// Allow requests from your frontend's local IP
const allowedOrigins = ['http://localhost:3000', `${LOCAL_IP}:3000`, 'http://ec2-3-133-145-178.us-east-2.compute.amazonaws.com:3000'] //'0.0.0.0']; // Replace with your actual IP and port

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
  // host: 'localhost',
  // user: 'root',
  // password: 'password', // Replace with your MySQL root password
  // database: 'test-streaming'
  host:'test-streaming.ct22uy2kkba5.us-east-2.rds.amazonaws.com',  
  user:'admin',      
  password:'Ifuckingh8hack3r$', 
  database:'test-streaming'   
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

// ========================================================================== STREAMING ============================================================================

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

// ===================================================================== TRACKS ====================================================================================
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


// New endpoint that spawns the Python process
app.post('/process-url', (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).send({ error: 'URL is required' });
  }

  // Spawn the Python process and pass the URL as an argument
  const pythonProcess = spawn('venv/bin/python', [path.join(__dirname, 'main.py'), url]);

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

// =============================================================== LOGIN/CREATE USER ==================================================================================

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
      // Create Liked Playlist
      if(collectionService.createCollection(db, 0, username, "Liked", false)) {
        // Respond with the newly created user ID
        res.status(201).json({
            message: 'User created successfully.',
            user: {
                id: results.insertId,
                username
            }
        });
      }
      else {
        console.error('Error creating liked collection:', err.stack);
        return res.status(500).json({ message: 'Internal server error.' });
      }
  });
});

// =============================================================== COLLECTIONS ==================================================================================

app.post('/collection', (req, res) => {
  const { collection_id, username, collection_name, isPublic } = req.body;
  if(collectionService.createCollection(db, collection_id, username, collection_name, isPublic)) {
    res.status(201).json({
      message: 'Collection created successfully.',
      collection: { collection_id, username, collection_name },
    })
  }
  else {
    res.status(500).json({error: "Error creating collection"})
  }
})

// Endpoint to add a song to a collection
// TODO: Look at refactoring this next
app.post('/collection/insert', (req, res) => {
  const { collection_id, username, title, artist } = req.body;

  const insert_dt = new Date().toISOString().slice(0, 19).replace('T', ' '); // Format for MySQL DATETIME

  const sql = `
      INSERT INTO track_collection (collection_id, username, title, artist, insert_dt)
      VALUES (?, ?, ?, ?, ?)
  `;

  db.query(sql, [collection_id, username, title, artist, insert_dt], (err, result) => {
      if (err) {
          console.error('Error inserting song into collection:', err);
          return res.status(500).json({ error: 'Failed to add the song to the collection.' });
      }

      res.status(201).json({
          message: 'Song added to the collection successfully.',
          song: { collection_id, username, title, artist, insert_dt },
      });
  });
});

// Fetch tracks for a given user
app.get('/collection/:username', (req, res) => {
  const { username } = req.params;

  // Validate the user ID
  if (!username) {
      return res.status(400).json({ message: 'username is required.' });
  }

  // Query to fetch tracks for the user
  const query = `
      select user_collection.collection_id, user_collection.username, collection_name, is_public, resources.title, resources.artist, path, track_collection.insert_dt collection_insert_dt, release_dt
      from (
        user_collection left join 
          track_collection on ( 1=1 AND
          user_collection.collection_id = track_collection.collection_id AND
              user_collection.username = track_collection.username)
      ) left join resources on ( 1=1 AND
        track_collection.artist = resources.artist AND
        track_collection.title = resources.title)
      order by collection_id asc, collection_insert_dt asc;
  `;

  db.query(query, [username], (err, results) => {
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

// ===================================================================== USAGE ======================================================================================

// Endpoint to add a song to a collection
// TODO Refactor cause collection id is dependent on user_id
app.post('/streams/add', (req, res) => {
  console.log(req.body)
  const { user_id, title, artist, collection_id, length } = req.body;
  // Validate input
  if (!user_id || !title || !artist || !length) {
      console.log('Elements missing')
      return res.status(400).json({ error: 'All fields (user_id, title, artist, collection_id, length) are required.' });
  }

  const insert_dt = new Date().toISOString().slice(0, 19).replace('T', ' '); // Format for MySQL DATETIME

  const sql = `
      INSERT INTO streams (user_id, title, artist, collection_id, length, insert_dt)
      VALUES (?, ?, ?, ?, ?, ?)
  `;

  db.query(sql, [user_id, title, artist,  collection_id, length, insert_dt], (err, result) => {
      if (err) {
          console.error('Error collecting stream:', err);
          return res.status(500).json({ error: 'Failed to add the song to the collection.' });
      }

      res.status(201).json({
          message: 'Stream captured successfully.',
          song: { user_id, title, artist, collection_id, length, insert_dt },
      });
  });
});

// Start the server
app.listen(PORT, PROD_IP, () => {
  console.log(`Server is running at http://${PROD_IP}:${PORT}`);
});
