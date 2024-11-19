const express = require('express');
const path = require('path');
const scrapeEngineers = require('./fetch_engineers');
const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const os = require('os');

const app = express();
const port = process.env.PORT || 3000;

// Serve static files from 'public' directory
app.use(express.static('public'));

// Create a basic HTML endpoint to view the SQLite data
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Add new API endpoint for paginated data
app.get('/api/data', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const offset = (page - 1) * limit;

        const db = await open({
            filename: './data/engineers.db',
            driver: sqlite3.Database
        });

        const [total, engineers] = await Promise.all([
            db.get('SELECT COUNT(*) as count FROM engineers'),
            db.all(`
                SELECT 
                    id,
                    nom,
                    prenom,
                    droit_exercice,
                    domaines_pratique,
                    employeur,
                    telephone,
                    phone_type,
                    permis_date_debut,
                    adresse,
                    created_at
                FROM engineers 
                ORDER BY created_at DESC 
                LIMIT ? OFFSET ?
            `, [limit, offset])
        ]);

        await db.close();

        res.json({
            data: engineers,
            totalEngineers: total.count,
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(total.count / limit),
                totalRecords: total.count
            }
        });
    } catch (error) {
        console.error('Error fetching data:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Function to get the server's IP address
function getServerIP() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            // Skip internal and non-IPv4 addresses
            if (!iface.internal && iface.family === 'IPv4') {
                return iface.address;
            }
        }
    }
    return 'localhost'; // Fallback to localhost if no IP is found
}

// Start the server and run the scraper
async function startServer() {
    try {
        // Start the web server
        const serverIP = getServerIP();
        app.listen(port, () => {
            console.log(`Server running at:`);
            console.log(`- Local:   http://localhost:${port}`);
            console.log(`- Network: http://${serverIP}:${port}`);
        });

        // Run the engineer scraper
        console.log('Starting engineer data collection...');
        await scrapeEngineers();
        console.log('Engineer data collection completed!');
    } catch (error) {
        console.error('Error:', error);
    }
}

// Run everything
startServer(); 