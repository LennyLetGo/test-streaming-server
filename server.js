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

// Enable CORS and body-parser for JSON request bodies
app.use(cors());
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

// Route to handle audio streaming by file ID
app.get('/audio/:fileId', async (req, res) => {
  const { fileId } = req.params;
  const inputFile = path.join("audio", `${fileId}.wav`);  // Dynamically resolve the MP3 file
  const outputDir = HLS_BASE_DIR
  const converted = path.join("stream", `${fileId}`);  // Dynamically resolve the MP3 file
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
    res.sendFile(path.join(outputDir, `${fileId}`));
  }
});

// Serve HLS segments
app.use('/audio', express.static(HLS_BASE_DIR));

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
app.get('/tracks', (req, res) => {
    let directoryPath = "audio"
    const filenames = getFilenamesInDirectory(directoryPath);
    res.status(200).send(filenames)
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

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
