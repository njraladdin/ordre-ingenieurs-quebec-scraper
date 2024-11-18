const fs = require('fs');
const axios = require('axios');
const clc = require('cli-color');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// Colors for different types of logs
const log = {
    info: clc.cyan,
    success: clc.green,
    error: clc.red,
    warning: clc.yellow,
    highlight: clc.magentaBright
};

let config = {
    method: 'get',
    maxBodyLength: Infinity,
    url: 'https://membres.oiq.qc.ca/OIQ/api/IQA?QueryName=$/OIQ/System/Bottin/Details_Bottin_An&queryId=46190',
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
      'sec-ch-ua-mobile': '?0', 
      'sec-ch-ua-platform': '"Windows"', 
      'sec-fetch-dest': 'empty', 
      'sec-fetch-mode': 'cors', 
      'sec-fetch-site': 'same-origin', 
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
    }
  };

  // Add this near the top with other constants
  const PHONE_BATCH_SIZE = 5;  // Number of phone records to collect before saving
  const MAX_RETRIES = 3;
  const RETRY_DELAY = 1000; // 1 second delay between retries

  // Add helper function to clean phone numbers
  function cleanPhoneNumber(phoneNumber) {
    // Extract just the main phone number (first 10 digits with area code)
    const match = phoneNumber.match(/(\d{3}[-\s]?\d{3}[-\s]?\d{4})/);
    return match ? match[1] : phoneNumber;
  }

  // Modify checkPhoneType function
  async function checkPhoneType(phoneNumber) {
    try {
        const cleanedNumber = cleanPhoneNumber(phoneNumber);

        const config = {
            method: 'get',
            maxBodyLength: Infinity,
            url: `https://www.pagesjaunes.ca/fs/1-${cleanedNumber}`,
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
            return 'ERROR';
        }

        const html = response.data;
        if (html.includes('Téléphone fixe')) {
            return 'LANDLINE';
        } else if (html.includes('Téléphone mobile')) {
            return 'MOBILE';
        }
        return 'UNKNOWN';
    } catch (error) {
        console.error(log.error(`Error checking phone type for ${cleanedNumber}: ${error.message}`));
        return 'ERROR';
    }
  }

  // Modify the fetchEngineer function to include phone type check
  async function fetchEngineer(id) {
    let attempts = 0;
    
    while (attempts < MAX_RETRIES) {
        try {
            const url = `https://membres.oiq.qc.ca/OIQ/api/IQA?QueryName=$/OIQ/System/Bottin/Details_Bottin_An&queryId=${id}`;
            const response = await axios.get(url, config);
            
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
            
            if (attempts === MAX_RETRIES) {
                console.error(log.error(`ID ${id}: Final error after ${MAX_RETRIES} attempts - ${error.message}`));
                return {
                    id: id,
                    found: false,
                    error: error.message
                };
            }
            
            console.warn(log.warning(`ID ${id}: Attempt ${attempts}/${MAX_RETRIES} failed - ${error.message}. Retrying...`));
            await delay(RETRY_DELAY);
        }
    }
}

// Add this helper function to convert records to CSV format
function convertToCSV(records) {
    // Define CSV headers based on the data structure
    const headers = ['id', 'Nom', 'Prenom', 'Telephone', 'phoneType', 'PermisOriginalDateDebut', 'Courriel', 'Employeur'];
    
    // Create CSV header row
    let csv = headers.join(',') + '\n';
    
    // Add data rows
    records.forEach(record => {
        const row = headers.map(header => {
            // Handle 'id' separately as it's not in the data object
            if (header === 'id') return record.id;
            
            // Get value from data object, handle empty values
            const value = record.data[header] || '';
            // Escape commas and quotes in the value
            return `"${value.toString().replace(/"/g, '""')}"`;
        });
        csv += row.join(',') + '\n';
    });
    
    return csv;
}

// Add this helper function to ensure the data directory exists
function ensureDataDirectory() {
    const dataDir = './data';
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir);
        console.log(log.info('Created data directory'));
    }
}

// Modify the savePhoneRecords function
async function savePhoneRecords(records, rangeName) {
    ensureDataDirectory();
    
    // Save JSON
    const jsonFilename = `data/engineers_${rangeName}_with_phones.json`;
    let existingData = [];
    try {
        if (fs.existsSync(jsonFilename)) {
            existingData = JSON.parse(fs.readFileSync(jsonFilename, 'utf8'));
        }
    } catch (error) {
        console.error(log.error(`Error reading existing phone records: ${error.message}`));
    }

    const updatedData = [...existingData, ...records];
    fs.writeFileSync(jsonFilename, JSON.stringify(updatedData, null, 2));
    
    // Save CSV
    const csvFilename = `data/engineers_${rangeName}_with_phones.csv`;
    const csvContent = convertToCSV(updatedData);
    fs.writeFileSync(csvFilename, csvContent, 'utf8');
    
    console.log(log.highlight(`\nSaved ${records.length} records to:`));
    console.log(log.success(`- JSON: ${jsonFilename} (Total: ${updatedData.length})`));
    console.log(log.success(`- CSV: ${csvFilename}`));
}

async function scanRange(start, end, increment = 1, rangeName) {
    const totalIdsInRange = end - start + 1;
    
    // Keep tracking all results for logging purposes
    const results = {
        found: [],
        notFound: [],
        errors: []
    };
    
    let phoneRecords = [];
    let totalPhonesFound = 0;
    let totalPhonesSaved = 0;
    
    console.log(log.highlight(`\nStarting scan from ${start} to ${end}`));
    
    for (let id = start; id <= end; id += increment) {
        const progress = ((id - start) / totalIdsInRange * 100).toFixed(2);
        
        if (id % 100 === 0 && id > start) {
            console.log(
                log.highlight('\nProgress Update:') +
                log.info(`\nCurrent ID: ${id} (${progress}% complete)`) +
                log.success(`\nValid Members Found: ${results.found.length}`) +
                log.warning(`\nInvalid/Inactive: ${results.notFound.length}`) +
                log.error(`\nErrors: ${results.errors.length}`) +
                log.info(`\nMembers with Phone (current batch): ${phoneRecords.length}`) +
                log.success(`\nTotal Phones Found: ${totalPhonesFound}`) +
                log.info(`\nTotal Phones Saved: ${totalPhonesSaved}\n`)
            );
        }

        const result = await fetchEngineer(id);
        
        if (result.found) {
            results.found.push(result);
            
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
                    `${log.warning(`(Batch: ${phoneRecords.length}/${PHONE_BATCH_SIZE})`)}`
                );
                
                if (phoneRecords.length >= PHONE_BATCH_SIZE) {
                    await savePhoneRecords(phoneRecords, rangeName);
                    totalPhonesSaved += phoneRecords.length;
                    console.log(log.highlight(`\nBatch of ${phoneRecords.length} phone records saved. Total saved: ${totalPhonesSaved}`));
                    phoneRecords = [];
                }
            }
        } else if (result.error) {
            results.errors.push(result);
            console.error(log.error(`[${progress}%] ID ${id}: Error - ${result.error}`));
        } else {
            results.notFound.push(result.id);
            console.log(log.error(`[${progress}%] ID ${id}: Invalid or inactive member`));
        }
        
        await delay(500);
    }
    
    // Save any remaining phone records
    if (phoneRecords.length > 0) {
        await savePhoneRecords(phoneRecords, rangeName);
        totalPhonesSaved += phoneRecords.length;
    }

    console.log(log.success(`\nTotal phone records saved for this range: ${totalPhonesSaved}`));
    
    // Return both the total saved and the results for logging
    return { totalPhonesSaved, results };
}

// Modify the getLastProcessedId function
async function getLastProcessedId(rangeName) {
    const filename = `data/engineers_${rangeName}_with_phones.json`;
    try {
        if (fs.existsSync(filename)) {
            const data = JSON.parse(fs.readFileSync(filename, 'utf8'));
            if (data.length > 0) {
                const lastId = Math.max(...data.map(record => record.id));
                console.log(log.info(`Found existing progress for ${rangeName}. Last ID: ${lastId}`));
                return lastId;
            }
        }
    } catch (error) {
        console.error(log.error(`Error reading last processed ID: ${error.message}`));
    }
    return null;
}

async function main() {
    const ranges = [
        { start: 100000, end: 149999, name: 'primary' },
        { start: 20000, end: 49999, name: 'early' },
        { start: 5000000, end: 5068000, name: 'modern' }
    ];

    for (const range of ranges) {
        console.log(log.highlight(`\n=== Starting range: ${range.name} (${range.start}-${range.end}) ===`));
        
        // Check for existing progress
        const lastProcessedId = await getLastProcessedId(range.name);
        const startId = lastProcessedId ? lastProcessedId + 1 : range.start;
        
        if (startId > range.end) {
            console.log(log.success(`Range ${range.name} already completed. Skipping...`));
            continue;
        }
        
        if (lastProcessedId) {
            console.log(log.highlight(`Resuming ${range.name} range from ID ${startId}`));
        }
        
        const { totalPhonesSaved, results } = await scanRange(startId, range.end, 1, range.name);
        
        console.log(log.highlight(`\nCompleted ${range.name} range. Results:`));
        console.log(log.success(`- Found: ${results.found.length}`));
        console.log(log.warning(`- Not Found: ${results.notFound.length}`));
        console.log(log.error(`- Errors: ${results.errors.length}`));
        console.log(log.success(`- Total Engineers with Phone Numbers: ${totalPhonesSaved}`));
    }
}

(async () => {
    try {
        await main();
        console.log(log.success('\nAll ranges completed successfully'));
    } catch (error) {
        console.error(log.error('Script failed:', error));
    }
})();