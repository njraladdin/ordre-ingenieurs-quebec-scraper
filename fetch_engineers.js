require('dotenv').config();
const fs = require('fs');
const axios = require('axios');
const clc = require('cli-color');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const pLimit = require('p-limit');
const HttpsProxyAgent = require('https-proxy-agent');
const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');

// Colors for different types of logs
const log = {
    info: clc.cyan,
    success: clc.green,
    error: clc.red,
    warning: clc.yellow,
    highlight: clc.magentaBright
};

// Add this near the top with other constants
const PROXY_BASE_URL = `http://${process.env.PROXY_USERNAME}:${process.env.PROXY_PASSWORD}@premium-residential.geonode.com`;
const PROXY_PORTS = Array.from({length: 10}, (_, i) => 9000 + i);

// Add new function to get a random proxy
function getRandomProxy() {
    const randomPort = PROXY_PORTS[Math.floor(Math.random() * PROXY_PORTS.length)];
    const proxyUrl = `${PROXY_BASE_URL}:${randomPort}`;
    return new HttpsProxyAgent(proxyUrl);
}

let config = {
    method: 'get',
    maxBodyLength: Infinity,
    url: 'https://membres.oiq.qc.ca/OIQ/api/IQA?QueryName=$/OIQ/System/Bottin/Details_Bottin_An&queryId=46190',
    httpsAgent: getRandomProxy(),  // Use random proxy
    headers: { 
      'accept': 'application/json, text/plain, */*', 
      'accept-language': 'en-US,en;q=0.9,be;q=0.8,ar;q=0.7', 
      'cache-control': 'no-cache', 
      'cookie': 'ASP.NET_SessionId=lxck0soo0xu04brxzlatz3dg; __RequestVerificationToken_L09JUQ2=AQqUZolQdvprT_fQWu9entLICMsWruqG64twNvDMbaOOR4TPPg1mjQJJKe3NI6Tpy18SP04uFoqxzA9nEKM3f7J-cJ-dfuaJMVHRxgSzFIs1; visid_incap_2623010=C3OGqLJFTKmdRBF6VXbVZ8xzOmcAAAAAQUIPAAAAAAAf24KOlipT2GT9tRLMczOT; _gid=GA1.3.1769313204.1731886420; incap_ses_2107_2623010=EBAVLVQjNGrtsUt/gpE9HV5+OmcAAAAAVMxMH3sREDwzXAeHK07EMg==; incap_ses_477_2623010=XvfGNFNutFPaR3jwMKWeBh2IOmcAAAAAG0iNUJBWG4GH/nkV8s1qgg==; _gat_gtag_UA_23487542_24=1; _ga_T5CW2SM42S=GS1.1.1731889190.2.1.1731891979.0.0.0; _ga=GA1.1.1559630702.1731886420; incap_ses_477_2623010=VdAnTvHTEiRmGorwMKWeBs64OmcAAAAAPfXKVH6kTuF8YHp0ObDuvA==; __RequestVerificationToken_L09JUQ2=AQqUZolQdvprT_fQWu9entLICMsWruqG64twNvDMbaOOR4TPPg1mjQJJKe3NI6Tpy18SP04uFoqxzA9nEKM3f7J-cJ-dfuaJMVHRxgSzFIs1', 
      'dnt': '1', 
      'pragma': 'no-cache', 
      'priority': 'u=1, i', 
      'referer': 'https://membres.oiq.qc.ca/OIQ/Public/Public/En/Directory/Detail.aspx?QueryId=6037532&amp;Lang=en', 
      'requestverificationtoken': 'GCHuNBWapshflNtV4dCIdfomTgHvMNkdDMRdJ8BFoqnYv8khv7HylHNwPLe_qaPbmoVCR0B0S32jfZV8y5JMArwbDyWBdVdlmb4usAR3GYs1', 
      'sec-ch-ua': '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"', 
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
    }
  };

  // Add this near the top with other constants
  const DB_PATH = './data/engineers.db';
  const PHONE_BATCH_SIZE = 20;
  const MAX_RETRIES = 3;
  const RETRY_DELAY = 500; // 1 second delay between retries
  const CONCURRENCY_LIMIT = 15;  // Number of concurrent requests
  const CHUNK_SIZE = 100;  // Process IDs in chunks of 100
  const limit = pLimit(CONCURRENCY_LIMIT);

  // Add these constants near the top
  const START_TIME = Date.now();
  const TIMING_WINDOW_SIZE = 100; // Keep only last 1000 times for average
  let processedTimes = {
      times: new Array(TIMING_WINDOW_SIZE).fill(0),
      currentIndex: 0,
      count: 0,
      
      add(time) {
          this.times[this.currentIndex] = time;
          this.currentIndex = (this.currentIndex + 1) % TIMING_WINDOW_SIZE;
          this.count = Math.min(this.count + 1, TIMING_WINDOW_SIZE);
      },
      
      getAverage() {
          if (this.count === 0) return 0;
          const sum = this.times.reduce((a, b) => a + b, 0);
          return sum / this.count;
      }
  };

  // Add helper function to clean phone numbers
  function cleanPhoneNumber(phoneNumber) {
    // Extract just the main phone number (first 10 digits with area code)
    const match = phoneNumber.match(/(\d{3}[-\s]?\d{3}[-\s]?\d{4})/);
    return match ? match[1] : phoneNumber;
  }

  // Modify checkPhoneType function
  async function checkPhoneType(phoneNumber) {
    const cleanedNumber = cleanPhoneNumber(phoneNumber);
    let attempts = 0;
    
    while (attempts < MAX_RETRIES) {
        try {
            const config = {
                method: 'get',
                maxBodyLength: Infinity,
                url: `https://www.pagesjaunes.ca/fs/1-${cleanedNumber}`,
                httpsAgent: getRandomProxy(),  // Use random proxy
                timeout: 20000,  // Add 20 second timeout
                headers: { 
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7', 
                    'Accept-Language': 'en-US,en;q=0.9,be;q=0.8,ar;q=0.7', 
                    'Cache-Control': 'no-cache', 
                    'Connection': 'keep-alive', 
                    'DNT': '1', 
                    'Pragma': 'no-cache', 
                    'Sec-Fetch-Dest': 'document', 
                    'Sec-Fetch-Mode': 'navigate', 
                    'Sec-Fetch-Site': 'none', 
                    'Sec-Fetch-User': '?1', 
                    'Upgrade-Insecure-Requests': '1', 
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36', 
                    'sec-ch-ua': '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"', 
                    'sec-ch-ua-mobile': '?0', 
                    'sec-ch-ua-platform': '"Windows"', 
                    'Cookie': 'JSESSIONID=521103132E484149BC942C2A361A9A65; JSESSIONID=521103132E484149BC942C2A361A9A65; yp.theme=yellowpages'
                  }
            };

            const response = await axios.request(config);
            
            if (response.status !== 200) {
                throw new Error(`HTTP status ${response.status}`);
            }

            const html = response.data;
            if (html.includes('Téléphone fixe')) {
                return 'LANDLINE';
            } else if (html.includes('Téléphone mobile')) {
                return 'MOBILE';
            }
            return 'UNKNOWN';
            
        } catch (error) {
            attempts++;
            
            const errorDetails = {
                code: error.code || 'UNKNOWN',
                status: error.response?.status,
                statusText: error.response?.statusText,
                message: error.message
            };
            
            if (attempts === MAX_RETRIES) {
                console.warn(log.warning(
                    `Phone ${cleanedNumber}: Failed after ${MAX_RETRIES} attempts\n` +
                    `  Code: ${errorDetails.code}\n` +
                    `  Status: ${errorDetails.status || 'N/A'}\n` +
                    `  Status Text: ${errorDetails.statusText || 'N/A'}\n` +
                    `  Message: ${errorDetails.message}`
                ));
                return 'ERROR';
            }
            
            await delay(RETRY_DELAY);
        }
    }
}

  // Modify the fetchEngineer function to include phone type check
  async function fetchEngineer(id) {
    let attempts = 0;
    let currentProxy = getRandomProxy();
    
    while (attempts < MAX_RETRIES) {
        try {
            const url = `https://membres.oiq.qc.ca/OIQ/api/IQA?QueryName=$/OIQ/System/Bottin/Details_Bottin_An&queryId=${id}`;
            const requestConfig = {
                ...config,
                url,
                httpsAgent: currentProxy,  // Use current proxy
                timeout: 20000
            };
            const response = await axios(requestConfig);
            
            if (response.status !== 200) {
                throw new Error(`HTTP status ${response.status}`);
            }
            
            if (response.data.Items.$values.length > 0) {
                const engineer = response.data.Items.$values[0];
                const properties = engineer.Properties.$values.reduce((acc, prop) => {
                    acc[prop.Name] = prop.Value?.$value || prop.Value;
                    return acc;
                }, {});
                
                if (properties.Telephone && properties.Telephone !== 'N/A') {
                    const phoneType = await checkPhoneType(properties.Telephone);
                    properties.phoneType = phoneType;
                }
                
                return {
                    id: id,
                    found: true,
                    data: properties
                };
            }
            
            return {
                id: id,
                found: false
            };

        } catch (error) {
            attempts++;
            
            const errorDetails = {
                code: error.code || 'UNKNOWN',
                status: error.response?.status,
                statusText: error.response?.statusText,
                message: error.message
            };

            // Rotate proxy on connection errors
            if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
                currentProxy = getRandomProxy();
                console.log(log.warning(`Rotating proxy for ID ${id} after error: ${error.code}`));
            }
            
            if (attempts === MAX_RETRIES) {
                console.warn(log.warning(
                    `ID ${id}: Failed after ${MAX_RETRIES} attempts\n` +
                    `  Code: ${errorDetails.code}\n` +
                    `  Status: ${errorDetails.status || 'N/A'}\n` +
                    `  Status Text: ${errorDetails.statusText || 'N/A'}\n` +
                    `  Message: ${errorDetails.message}`
                ));
                return {
                    id: id,
                    found: false,
                    error: errorDetails
                };
            }
            
            await delay(RETRY_DELAY);
        }
    }
}

// Keep only the directory check helper
function ensureDataDirectory() {
    const dataDir = './data';
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir);
        console.log(log.info('Created data directory'));
    }
}

// Add new function to initialize database
async function initializeDatabase() {
    ensureDataDirectory();
    
    const db = await open({
        filename: DB_PATH,
        driver: sqlite3.Database
    });
    
    await db.exec(`
        CREATE TABLE IF NOT EXISTS engineers (
            id INTEGER PRIMARY KEY,
            result_row INTEGER,
            nom TEXT,
            prenom TEXT,
            prenom_usuel TEXT,
            permis_original_description TEXT,
            droit_exercice TEXT,
            domaines_pratique TEXT,
            employeur TEXT,
            superviseur BOOLEAN,
            telephone TEXT,
            phone_type TEXT,
            type_membre TEXT,
            ville TEXT,
            permis_description TEXT,
            permis_date_debut TEXT,
            permis_original_date_debut TEXT,
            adresse TEXT,
            range_name TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
    
    return db;
}

// Replace savePhoneRecords function
async function savePhoneRecords(records, rangeName, db) {
    for (const record of records) {
        const data = record.data;
        
        await db.run(`
            INSERT OR REPLACE INTO engineers (
                id, result_row, nom, prenom, prenom_usuel,
                permis_original_description, droit_exercice,
                domaines_pratique, employeur, superviseur,
                telephone, phone_type, type_membre, ville,
                permis_description, permis_date_debut,
                permis_original_date_debut, adresse, range_name
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            record.id,
            data.ResultRow,
            data.Nom,
            data.Prenom,
            data.PrenomUsuel,
            data.PermisOriginalDescription,
            data.DroitExercice,
            data.DomainesPratique,
            data.Employeur,
            data.Superviseur?.$value,
            data.Telephone,
            data.phoneType,
            data.TypeMembre,
            data.Ville,
            data.PermisDescription,
            data.PermisDateDebut,
            data.PermisOriginalDateDebut,
            data.Adresse,
            rangeName
        ]);
    }
    
    console.log(log.highlight(`\nSaved ${records.length} records to database`));
}

// Modify getLastProcessedId function
async function getLastProcessedId(rangeName, db) {
    try {
        const result = await db.get(
            'SELECT MAX(id) as lastId FROM engineers WHERE range_name = ?',
            rangeName
        );
        
        if (result && result.lastId) {
            console.log(log.info(`Found existing progress for ${rangeName}. Last ID: ${result.lastId}`));
            return result.lastId;
        }
    } catch (error) {
        console.error(log.error(`Error reading last processed ID: ${error.message}`));
    }
    return null;
}

// Add new constant
const LIGHT_MODE_INCREMENT = 5;  // In light mode, only check every 10th ID

// Modify scanRange function
async function scanRange(start, end, increment = 1, rangeName, db) {
    const rangeStartTime = Date.now();
    const totalIdsInRange = end - start + 1;
    const results = {
        foundCount: 0,
        notFoundCount: 0,
        errorCount: 0
    };
    
    let phoneRecords = [];
    let totalPhonesFound = 0;
    let totalPhonesSaved = 0;
    let processedCount = 0;
    
    console.log(log.highlight(`\nStarting scan from ${start} to ${end} with ${CONCURRENCY_LIMIT} concurrent requests`));
    
    let isLightMode = false;
    let foundValidIdInChunk = false;

    for (let chunkStart = start; chunkStart <= end; chunkStart += CHUNK_SIZE) {
        foundValidIdInChunk = false;
        
        const chunkEnd = Math.min(chunkStart + CHUNK_SIZE - 1, end);
        
        // Check if we should switch back to full mode based on previous chunk
        if (isLightMode && foundValidIdInChunk) {
            console.log(log.success('\nFound valid ID, switching back to FULL mode'));
            isLightMode = false;
        }
        
        // Modify how we generate chunk IDs based on mode
        const chunkIds = Array.from(
            { length: Math.ceil((chunkEnd - chunkStart + 1) / (isLightMode ? LIGHT_MODE_INCREMENT : increment)) },
            (_, i) => chunkStart + (i * (isLightMode ? LIGHT_MODE_INCREMENT : increment))
        );
        
        console.log(log.highlight(
            `\nProcessing chunk ${chunkStart}-${chunkEnd} in ${isLightMode ? 'LIGHT' : 'FULL'} mode ` +
            `(${chunkIds.length} IDs to check)`
        ));

        // Process chunk with concurrent requests
        const promises = chunkIds.map(id => limit(async () => {
            const itemStartTime = Date.now();
            const result = await fetchEngineer(id);
            const itemDuration = Date.now() - itemStartTime;
            processedTimes.add(itemDuration);
            
            processedCount++;
            const progress = (processedCount / totalIdsInRange * 100).toFixed(2);
            
            // Calculate time estimates using the rolling average
            const avgTime = processedTimes.getAverage();
            const avgTimeSeconds = avgTime / 1000; // Convert ms to seconds
            const remainingItems = totalIdsInRange - processedCount;
            const estimatedTimeLeftHours = (remainingItems * avgTime) / (1000 * 60 * 60); // Convert to hours
            const totalElapsedHours = (Date.now() - START_TIME) / (1000 * 60 * 60); // Convert to hours
            
            // Common timing info string
            const timingInfo = `${log.info(`Avg: ${avgTimeSeconds.toFixed(1)}s/item`)} | ` +
                             `${log.info(`Est: ${estimatedTimeLeftHours.toFixed(2)}h left`)} | ` +
                             `${log.info(`Total: ${totalElapsedHours.toFixed(2)}h`)}`;

            if (result.found) {
                results.foundCount++;
                foundValidIdInChunk = true;
                
                if (result.data.Telephone && result.data.Telephone !== 'N/A') {
                    phoneRecords.push(result);
                    totalPhonesFound++;
                    
                    console.log(
                        `${log.success(`[${progress}%]`)} ` +
                        `${log.info(`ID ${id}`)} | ` +
                        `${log.info(`Reg: ${result.data.PermisOriginalDateDebut || 'N/A'}`)} | ` +
                        `${log.info(`Phone: ${result.data.Telephone}`)} | ` +
                        `${log.info(`Type: ${result.data.phoneType}`)} | ` +
                        `${log.success(`Found #${totalPhonesFound}`)} ` +
                        `${log.warning(`(Batch: ${phoneRecords.length}/${PHONE_BATCH_SIZE})`)} | ` +
                        timingInfo
                    );
                    
                    // Save records when batch size is reached
                    if (phoneRecords.length >= PHONE_BATCH_SIZE) {
                        await savePhoneRecords([...phoneRecords], rangeName, db);
                        totalPhonesSaved += phoneRecords.length;
                        console.log(log.highlight(`\nBatch of ${phoneRecords.length} phone records saved. Total saved: ${totalPhonesSaved}`));
                        phoneRecords = [];
                    }
                }
            } else if (result.error) {
                results.errorCount++;
                console.error(log.error(
                    `[${progress}%] ID ${id}: Error\n` +
                    `  Code: ${result.error.code}\n` +
                    `  Status: ${result.error.status || 'N/A'}\n` +
                    `  Message: ${result.error.message}`
                ));
            } else {
                results.notFoundCount++;
                console.log(
                    `${log.error(`[${progress}%] ID ${id}: Invalid or inactive member`)} | ` +
                    timingInfo
                );
            }
            
            //await delay(500);
            return result;
        }));
        
        // Wait for current chunk to complete
        await Promise.all(promises);

        console.log(log.info(`Chunk complete. Found valid IDs: ${foundValidIdInChunk}, Light mode: ${isLightMode}`));

        // Only check for switching TO light mode after chunk completes
        if (!foundValidIdInChunk && !isLightMode) {
            console.log(log.warning(
                `\nNo valid IDs found in chunk ${chunkStart}-${chunkEnd}, switching to LIGHT mode\n` +
                `Debug - foundValidIdInChunk: ${foundValidIdInChunk}, isLightMode: ${isLightMode}`
            ));
            isLightMode = true;
        }
    }
    
    // Save any remaining phone records
    if (phoneRecords.length > 0) {
        await savePhoneRecords(phoneRecords, rangeName, db);
        totalPhonesSaved += phoneRecords.length;
    }

    console.log(log.success(`\nTotal phone records saved for this range: ${totalPhonesSaved}`));
    
    return { totalPhonesSaved, results };
}


// Modify main function
async function main() {
    const db = await initializeDatabase();
    
    const ranges = [
        { start: 100000, end: 149999, name: 'primary' },
        { start: 20000, end: 49999, name: 'early' },
        { start: 5000000, end: 5068000, name: 'modern' }
    ];

    try {
        for (const range of ranges) {
            console.log(log.highlight(`\n=== Starting range: ${range.name} (${range.start}-${range.end}) ===`));
            
            // Check for existing progress
            const lastProcessedId = await getLastProcessedId(range.name, db);
            const startId = lastProcessedId ? lastProcessedId + 1 : range.start;
            
            if (startId > range.end) {
                console.log(log.success(`Range ${range.name} already completed. Skipping...`));
                continue;
            }
            
            if (lastProcessedId) {
                console.log(log.highlight(`Resuming ${range.name} range from ID ${startId}`));
            }
            
            // Pass db to relevant functions
            const { totalPhonesSaved, results } = await scanRange(
                startId, 
                range.end, 
                1, 
                range.name, 
                db
            );
            
            console.log(log.highlight(`\nCompleted ${range.name} range. Results:`));
            console.log(log.success(`- Found: ${results.foundCount}`));
            console.log(log.warning(`- Not Found: ${results.notFoundCount}`));
            console.log(log.error(`- Errors: ${results.errorCount}`));
            console.log(log.success(`- Total Engineers with Phone Numbers: ${totalPhonesSaved}`));
        }
    } finally {
        await db.close();
    }
}

// Modify the bottom to export the main function instead of running it
module.exports = main;