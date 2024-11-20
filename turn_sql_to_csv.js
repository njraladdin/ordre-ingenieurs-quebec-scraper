require('dotenv').config();
const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const fs = require('fs');
const path = require('path');
const clc = require('cli-color');

// Colors for different types of logs
const log = {
    info: clc.cyan,
    success: clc.green,
    error: clc.red,
    warning: clc.yellow,
    highlight: clc.magentaBright
};

// Configuration
const CHUNK_SIZE = 1000; // Process 1000 rows at a time

async function* fetchRowsInChunks(db, offset = 0) {
    let hasMore = true;
    
    while (hasMore) {
        const rows = await db.all(`
            SELECT 
                id,
                result_row,
                nom,
                prenom,
                prenom_usuel,
                permis_original_description,
                droit_exercice,
                domaines_pratique,
                employeur,
                superviseur,
                telephone,
                phone_type,
                type_membre,
                ville,
                permis_description,
                permis_date_debut,
                permis_original_date_debut,
                adresse,
                range_name,
                created_at
            FROM engineers
            ORDER BY created_at DESC
            LIMIT ${CHUNK_SIZE} OFFSET ${offset}
        `);
        
        if (rows.length === 0) {
            hasMore = false;
        } else {
            yield rows;
            offset += CHUNK_SIZE;
        }
    }
}

function formatValue(value) {
    if (value === null) return '';
    value = String(value);
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
        return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
}

async function exportToCSV() {
    try {
        // Open database connection
        const db = await open({
            filename: './data/engineers.db',
            driver: sqlite3.Database
        });

        console.log(log.info('Connected to database...'));

        // Get total count
        const { count } = await db.get('SELECT COUNT(*) as count FROM engineers');
        console.log(log.info(`Total records to process: ${count}`));

        // Create timestamp for filename
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const outputDir = './data/exports';
        const outputFile = path.join(outputDir, `engineers_${timestamp}.csv`);

        // Ensure exports directory exists
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        // Create write stream
        const writeStream = fs.createWriteStream(outputFile);

        // Write headers (get from first chunk)
        const firstChunk = await db.all('SELECT * FROM engineers LIMIT 1');
        if (firstChunk.length > 0) {
            const headers = Object.keys(firstChunk[0]).join(',');
            writeStream.write(headers + '\n');
        }

        let processedRows = 0;
        const startTime = Date.now();

        // Process chunks
        for await (const rows of fetchRowsInChunks(db)) {
            for (const row of rows) {
                const csvLine = Object.values(row).map(formatValue).join(',');
                writeStream.write(csvLine + '\n');
            }

            processedRows += rows.length;
            const progress = ((processedRows / count) * 100).toFixed(2);
            const elapsedSeconds = (Date.now() - startTime) / 1000;
            const rowsPerSecond = (processedRows / elapsedSeconds).toFixed(2);
            
            console.log(log.success(
                `Progress: ${progress}% | ` +
                `Processed: ${processedRows.toLocaleString()} rows | ` +
                `Speed: ${rowsPerSecond} rows/sec`
            ));
        }

        // Close the write stream
        await new Promise((resolve) => writeStream.end(resolve));

        console.log(log.success(`\nExport complete!`));
        console.log(log.info(`CSV file saved to: ${outputFile}`));
        console.log(log.info(`Total records exported: ${processedRows.toLocaleString()}`));
        
        const totalTimeSeconds = (Date.now() - startTime) / 1000;
        console.log(log.info(`Total time: ${totalTimeSeconds.toFixed(2)} seconds`));

        await db.close();

    } catch (error) {
        console.error(log.error('Error during export:'), error);
    }
}

// Run the export
exportToCSV();
