require('dotenv').config();
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const clc = require('cli-color');
const fs = require('fs');

// Colors for different types of logs
const log = {
    info: clc.cyan,
    success: clc.green,
    error: clc.red
};

async function exportToCSV() {
    try {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const outputDir = './data/exports';
        const outputFile = path.join(outputDir, `engineers_${timestamp}.csv`);

        const db = new sqlite3.Database('./data/engineers2.db');
        
        console.log(log.info('Starting export...'));
        
        // Create header row
        db.all("SELECT * FROM engineers LIMIT 1", [], (err, rows) => {
            if (err) throw err;
            
            const headers = Object.keys(rows[0]).join(',') + '\n';
            fs.writeFileSync(outputFile, headers);

            // Get all data
            db.all("SELECT * FROM engineers", [], (err, rows) => {
                if (err) throw err;
                
                const csvContent = rows.map(row => 
                    Object.values(row).map(value => 
                        `"${String(value).replace(/"/g, '""')}"`
                    ).join(',')
                ).join('\n');

                fs.appendFileSync(outputFile, csvContent);
                console.log(log.success('Export completed successfully!'));
                console.log(log.info(`CSV file saved to: ${outputFile}`));
                db.close();
            });
        });

    } catch (error) {
        console.error(log.error('Error:'), error);
    }
}

// Run the export
exportToCSV();
