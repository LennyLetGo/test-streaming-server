const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');
const { spawn } = require('child_process'); // Required to spawn a Python process
const bodyParser = require('body-parser');
const app = express();
const PORT = 5000;

// Enable CORS and body-parser for JSON request bodies
app.use(cors());
app.use(bodyParser.json());

// Directory for HLS output
const HLS_BASE_DIR = path.join(__dirname, 'public/audio');

// Ensure the base directory exists
if (!fs.existsSync(HLS_BASE_DIR)) {
  fs.mkdirSync(HLS_BASE_DIR, { recursive: true });
}

// Function to convert a file to HLS segments
function convertToHLS(inputFile, outputDir) {
  return new Promise((resolve, reject) => {
    const outputFile = path.join(outputDir, 'playlist.m3u8');
    const segmentPattern = path.join(outputDir, 'segment%d.ts');

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
  const outputDir = path.join(HLS_BASE_DIR, fileId);

  // Ensure a unique directory for each stream
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });

    try {
      console.log(`Converting ${fileId} to HLS...`);
      await convertToHLS(inputFile, outputDir);
    } catch (err) {
      return res.status(500).send('Error during HLS conversion');
    }
  }

  // Serve the playlist.m3u8 file
  res.sendFile(path.join(outputDir, 'playlist.m3u8'));
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

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
