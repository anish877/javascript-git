const fs = require("fs");
const path = require("path");
const zlib = require("zlib"); // For decompression
const crypto = require('crypto');

// Uncomment this block to pass the first stage
const command = process.argv[2];
const option = process.argv[3];  // e.g., '-p' in 'cat-file -p'
const hash = process.argv[4];    // The hash (e.g., e88f7a929cd70b0274c4ea33b209c97fa845fdbc)

switch (command) {
    case "init":
      createGitDirectory();
      break;
    case "cat-file":
      if (option === '-p' && hash) {
        readBlob(hash);
      } else {
        throw new Error("Usage: cat-file -p <object-hash>");
      }
      break;
    case "hash-object":
        if(option === '-w' && hash){
            hashObject(hash,true)
        }
        else if(hash){
            hashObject(hash,false)
        }
        else{
            throw new Error("Usage: hash-object [-w] <file-name>");
        }
        break;
    default:
      throw new Error(`Unknown command ${command}`);
  }
  

function createGitDirectory() {
  fs.mkdirSync(path.join(process.cwd(), ".git"), { recursive: true });
  fs.mkdirSync(path.join(process.cwd(), ".git", "objects"), { recursive: true });
  fs.mkdirSync(path.join(process.cwd(), ".git", "refs"), { recursive: true });

  fs.writeFileSync(path.join(process.cwd(), ".git", "HEAD"), "ref: refs/heads/main\n");
  console.log("Initialized git directory");
}

// Function to read a blob from the .git/objects directory
function readBlob(hash) {
    // Break the hash into the directory (first two characters) and file name (remaining 38 characters)
    const dir = hash.substring(0, 2);
    const file = hash.substring(2);
  
    // Construct the path to the blob object file
    const objectPath = path.join(process.cwd(), ".git", "objects", dir, file);
  
    try {
      // Read the compressed blob file
      const compressedData = fs.readFileSync(objectPath);
  
      // Decompress the file using zlib
      const decompressedData = zlib.inflateSync(compressedData);
  
      // Decompressed data has the format: "blob <size>\0<content>"
      // We want to extract everything after the null byte (\0)
      const nullByteIndex = decompressedData.indexOf(0); // Find the position of \0
  
      // Extract the actual content by slicing after the \0
      const content = decompressedData.slice(nullByteIndex + 1); // Skip the header
  
      // Print the content without adding a newline at the end
      process.stdout.write(content);
    } catch (error) {
      console.error(`Error reading blob: ${error.message}`);
    }
  }

// Function to create a blob and optionally store it
function hashObject(filePath, write) {
    try {
        // Step 1: Read file content
        const content = fs.readFileSync(filePath);
        const size = content.length;

        // Step 2: Create the blob header (blob <size>\0)
        const header = `blob ${size}\0`;

        // Step 3: Combine header and file content
        const blob = Buffer.concat([Buffer.from(header), content]);

        // Step 4: Compute the SHA-1 hash of the combined header and content
        const hash = crypto.createHash('sha1').update(blob).digest('hex');

        // Step 5: Print the hash to the console
        console.log(hash);

        // Step 6: If the '-w' option is provided, write the blob to .git/objects
        if (write) {
            writeBlob(hash, blob);
        }
    } catch (error) {
        console.error(`Error processing file: ${error.message}`);
    }
}

// Function to write the blob to the .git/objects directory
function writeBlob(hash, blob) {
    // Step 1: Compress the blob using zlib
    zlib.deflate(blob, (err, compressedBlob) => {
        if (err) throw err;

        // Step 2: Create the path to the object file in .git/objects
        const dir = path.join('.git', 'objects', hash.substring(0, 2));
        const file = path.join(dir, hash.substring(2));

        // Step 3: Ensure the directory exists
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        // Step 4: Write the compressed blob to the file
        fs.writeFileSync(file, compressedBlob);
    });
}