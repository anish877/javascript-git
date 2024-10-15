const fs = require("fs");
const path = require("path");
const zlib = require("zlib"); // For decompression
const crypto = require('crypto');

// Uncomment this block to pass the first stage
const command = process.argv[2];
const option  = process.argv[3];  // e.g., '-p' in 'cat-file -p'
const option2 = process.argv[4];    // The hash (e.g., e88f7a929cd70b0274c4ea33b209c97fa845fdbc)
const option3 = process.argv[5];
const option4 = process.argv[6];
const option5 = process.argv[7];

switch (command) {
    case "init":
      createGitDirectory();
      break;
    case "cat-file":
      if (option === '-p' && option2) {
        readBlob(option2);
      } else {
        throw new Error("Usage: cat-file -p <object-hash>");
      }
      break;
    case "hash-object":
        if(option === '-w' && option2){
            hashObject(option2,true)
        }
        else if(option2){
            hashObject(option2,false)
        }
        else{
            throw new Error("Usage: hash-object [-w] <file-name>");
        }
        break;
    case "ls-tree":
        if(option=="--name-only" && option2){
            lsTree(option2,true)
        }else if(option2){
            lsTree(option2,false)
        }else{
            throw new Error("Usage: ls-tree --name-only <tree_sha>");
        }
        break;
    case "write-tree":
        writeTreeCommand()
    break;
    case "commit-tree":
        if(option2=='-p' && option3){
            if(option && option4 == '-m' && option5){
                commitTree(option,option3,option5)
            }
            else{
                throw new Error(`Unknown command ${command}`);
            }
        }
        else if(option && option4 == '-m' && option5){
            commitTree(option,null,option5)
        }
        else{
            throw new Error(`Unknown command ${command}`);
        }
        break;
    case "show":
        showTree()
        break;
    default:
      throw new Error(`Unknown command ${command}`);
  }

  var latestCommitObject = null

  function sha1HashConverter(data){
    return crypto.createHash('sha1').update(data).digest('hex')
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

function lsTree(treeSha,onlyName) {
    const dir = treeSha.substring(0, 2);
    const file = treeSha.substring(2);
    const objectPath = path.join(".git", "objects", dir, file);
  
    try {
      const compressedData = fs.readFileSync(objectPath);
      const decompressedData = zlib.inflateSync(compressedData)
      parseTree(decompressedData,onlyName);
    } catch (error) {
      console.error(`Error reading tree object: ${error.message}`);
    }
  }

function parseTree(data,onlyName) {
    // Find the null byte after the header
    const nullByteIndex = data.indexOf(0);
    
    // Skip the header
    let currentIndex = nullByteIndex + 1;
  
    while (currentIndex < data.length) {
      // Extract the mode
      const modeEndIndex = data.indexOf(32, currentIndex); // 32 is ASCII for space
      const mode = data.slice(currentIndex, modeEndIndex).toString();
  
      // Extract the name
      const nameEndIndex = data.indexOf(0, modeEndIndex + 1); // 0 is null byte
      const name = data.slice(modeEndIndex + 1, nameEndIndex).toString();
      
      const hash = data.slice(nameEndIndex+1,nameEndIndex+20+1).toString();
      // Move the index past the name and the SHA (20 bytes)
      currentIndex = nameEndIndex + 1 + 20; // 20 bytes for the SHA
      
      if(onlyName){
        // Output the name (for --name-only flag)
        console.log(name);
      }
      else{
        console.log(mode,name,hash)
      }
    }
  }

  function writeTree(dirPath){
    // dngn
     let entries = fs.readdirSync(dirPath)
     let treeEntries = []
     entries.forEach(entry=>{
        const fullPath = path.join(dirPath,entry)
        const  stats  = fs.statSync(fullPath)
        if(entry==='.git') {return}
        if(stats.isFile()){
            const content = fs.readFileSync(fullPath)
            const header = `blob ${content.length}\0`
            const blob = Buffer.concat([Buffer.from(header), Buffer.from(content,'hex')]);
            const hash = sha1HashConverter(blob)
            writeBlob(hash,blob)
            const mode = '100644'
            const final = `${mode} ${entry}\0`
            const finalEntry = Buffer.concat([Buffer.from(final),Buffer.from(hash,'hex')])
            treeEntries.push(finalEntry)
        }
        else{
            const finalhashoutput = writeTree(fullPath)
            const directoryMode  = '40000'
            const directoryfinal = `${directoryMode} ${entry}\0`
            const finaldirectoryfinal = Buffer.concat([Buffer.from(directoryfinal),Buffer.from(finalhashoutput,'hex')])
            treeEntries.push(finaldirectoryfinal)

        }
     })
    const bufferTree = Buffer.concat(treeEntries.map(entry=>Buffer.from(entry,'binary')))
    const header = `tree ${bufferTree.length}\0`; // Correct size calculation
    const finalEntry = Buffer.concat([Buffer.from(header,'binary'),bufferTree])
    const finalHash = sha1HashConverter(finalEntry)
    writeBlob(finalHash,finalEntry)

    return finalHash
  }

  function writeTreeCommand(){
    const rootdir = process.cwd()
    const treeHash = writeTree(rootdir)
    process.stdout(treeHash)
  }

  function commitTree(treeHash,parentHash=null,message){
    const tree = `tree ${treeHash}`
    let parent
    if(parentHash){
        parent = `parent ${parentHash}`
    }
    const author_name = "ACoolName"
    const author_email = "ACoolEmail@NotGmail.Com"
    const author_date_seconds  = (new Date).getSeconds()
    const author_date_timezone = (new Date).getTimezoneOffset()
    const author = `author ${author_name} ${author_email} ${author_date_seconds} ${author_date_timezone}`
    const commiter = `commiter ${author_name} ${author_email} ${author_date_seconds} ${author_date_timezone}`
    const content = Buffer.concat([Buffer.from(tree),(parentHash)?Buffer.from(parent):null,Buffer.from(author),Buffer.from(commiter),Buffer.from(message)])
    const header = `commit ${content.length}\0`
    const final = Buffer.concat([Buffer.from(header),Buffer.from(content)])
    const hash = sha1HashConverter(final)
    writeBlob(hash,final)
    latestCommitObject = hash
  }

  function showTree(){
    if(!latestCommitObject){
        throw new Error('No commits made')
    }
    else{
        readBlob(latestCommitObject)
    }
  }